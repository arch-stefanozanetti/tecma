import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ListQuerySchema, buildPagination } from "../shared/list-query.js";
import { HttpError, type PaginatedResponse } from "../../types/http.js";
import { HANDOVER_CHECKLIST_TEMPLATE } from "./handover-checklist-template.js";

const COLLECTION = "tz_handovers";

const ObjectIdLikeSchema = z.string().min(1);

export const HandoverSessionStatusSchema = z.enum(["not_started", "in_progress", "completed"]);

const ChecklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean(),
  doneAt: z.string().optional(),
  photoUrls: z.array(z.string().min(1).max(2000)).default([]),
  notes: z.string().max(5000).optional(),
});

export const HandoverCreateSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  apartmentId: ObjectIdLikeSchema,
  requestId: ObjectIdLikeSchema.optional(),
});

export const HandoverPatchSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  sessionStatus: HandoverSessionStatusSchema.optional(),
  /** Aggiorna voci per id template */
  checklist: z
    .array(
      z.object({
        itemId: z.string().min(1),
        done: z.boolean().optional(),
        photoUrls: z.array(z.string().min(1).max(2000)).max(50).optional(),
        notes: z.string().max(5000).nullable().optional(),
      })
    )
    .optional(),
});

export type HandoverChecklistItemRow = z.infer<typeof ChecklistItemSchema>;

export type HandoverRow = {
  _id: string;
  workspaceId: string;
  projectId: string;
  apartmentId: string;
  requestId?: string;
  sessionStatus: z.infer<typeof HandoverSessionStatusSchema>;
  checklist: HandoverChecklistItemRow[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

type RawHandover = Document & {
  _id: ObjectId;
  workspaceId: string;
  projectId: string;
  apartmentId: string;
  requestId?: string;
  sessionStatus: string;
  checklist: HandoverChecklistItemRow[];
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

const toObjectId = (value: string): ObjectId => {
  if (!ObjectId.isValid(value)) throw new HttpError(`ID non valido: ${value}`, 400);
  return new ObjectId(value);
};

function buildInitialChecklist(): HandoverChecklistItemRow[] {
  return HANDOVER_CHECKLIST_TEMPLATE.map((t) => ({
    id: t.id,
    label: t.label,
    required: t.required,
    doneAt: undefined,
    photoUrls: [],
    notes: undefined,
  }));
}

const mapRow = (doc: RawHandover): HandoverRow => ({
  _id: doc._id.toHexString(),
  workspaceId: doc.workspaceId,
  projectId: doc.projectId,
  apartmentId: doc.apartmentId,
  requestId: doc.requestId,
  sessionStatus: doc.sessionStatus as HandoverRow["sessionStatus"],
  checklist: Array.isArray(doc.checklist) ? doc.checklist : [],
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
  createdBy: doc.createdBy,
});

async function assertApartmentInProject(
  apartmentId: string,
  workspaceId: string,
  projectId: string
): Promise<void> {
  const db = getDb();
  const apt = await db.collection("tz_apartments").findOne({
    _id: toObjectId(apartmentId),
    workspaceId,
    projectId,
  });
  if (!apt) throw new HttpError("Appartamento non trovato o non coerente con progetto", 404);
}

export async function queryHandovers(raw: unknown): Promise<PaginatedResponse<HandoverRow>> {
  const q = ListQuerySchema.parse(raw);
  const db = getDb();
  const coll = db.collection<RawHandover>(COLLECTION);
  const { skip, limit } = buildPagination(q.page, q.perPage);

  const match: Record<string, unknown> = {
    workspaceId: q.workspaceId,
    projectId: { $in: q.projectIds },
  };
  const apartmentId = q.filters?.apartmentId;
  if (typeof apartmentId === "string" && apartmentId.trim()) {
    match.apartmentId = apartmentId.trim();
  }

  const sortField = q.sort?.field === "createdAt" ? "createdAt" : "updatedAt";
  const sortDir = q.sort?.direction === 1 ? 1 : -1;

  const [total, rows] = await Promise.all([
    coll.countDocuments(match),
    coll
      .find(match)
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limit)
      .toArray(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / q.perPage));
  return {
    data: rows.map(mapRow),
    pagination: {
      page: q.page,
      perPage: q.perPage,
      total,
      totalPages,
    },
  };
}

export async function getHandoverById(handoverId: string, workspaceId: string): Promise<{ handover: HandoverRow }> {
  if (!workspaceId.trim()) throw new HttpError("workspaceId obbligatorio", 400);
  const db = getDb();
  const coll = db.collection<RawHandover>(COLLECTION);
  const doc = await coll.findOne({ _id: toObjectId(handoverId), workspaceId });
  if (!doc) throw new HttpError("Consegna non trovata", 404);
  return { handover: mapRow(doc) };
}

/**
 * Una sessione per unità: se esiste restituisce quella, altrimenti la crea.
 */
export async function getOrCreateHandover(
  raw: unknown,
  opts: { userId?: string }
): Promise<{ handover: HandoverRow; created: boolean }> {
  const input = HandoverCreateSchema.parse(raw);
  await assertApartmentInProject(input.apartmentId, input.workspaceId, input.projectId);
  const db = getDb();
  const coll = db.collection<RawHandover>(COLLECTION);
  const existing = await coll.findOne({
    workspaceId: input.workspaceId,
    apartmentId: input.apartmentId,
  });
  if (existing) {
    return { handover: mapRow(existing), created: false };
  }
  const now = new Date().toISOString();
  const doc: RawHandover = {
    _id: new ObjectId(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apartmentId: input.apartmentId,
    requestId: input.requestId,
    sessionStatus: "not_started",
    checklist: buildInitialChecklist(),
    createdAt: now,
    updatedAt: now,
    createdBy: opts.userId,
  };
  try {
    await coll.insertOne(doc);
  } catch (err: unknown) {
    const code = err && typeof err === "object" && "code" in err ? (err as { code?: number }).code : undefined;
    if (code === 11000) {
      const again = await coll.findOne({ workspaceId: input.workspaceId, apartmentId: input.apartmentId });
      if (again) return { handover: mapRow(again), created: false };
    }
    throw err;
  }
  return { handover: mapRow(doc), created: true };
}

export async function getHandoverForApartment(
  workspaceId: string,
  projectId: string,
  apartmentId: string
): Promise<{ handover: HandoverRow | null }> {
  const db = getDb();
  const coll = db.collection<RawHandover>(COLLECTION);
  const doc = await coll.findOne({ workspaceId, projectId, apartmentId });
  return { handover: doc ? mapRow(doc) : null };
}

export async function patchHandover(
  handoverId: string,
  raw: unknown,
  _opts: { userId?: string }
): Promise<{ handover: HandoverRow }> {
  const input = HandoverPatchSchema.parse(raw);
  const db = getDb();
  const coll = db.collection<RawHandover>(COLLECTION);
  const existing = await coll.findOne({
    _id: toObjectId(handoverId),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
  });
  if (!existing) throw new HttpError("Consegna non trovata", 404);

  const now = new Date().toISOString();
  let checklist = [...(existing.checklist ?? [])];
  if (input.checklist && input.checklist.length > 0) {
    const byId = new Map(checklist.map((c) => [c.id, { ...c }]));
    for (const patch of input.checklist) {
      const cur = byId.get(patch.itemId);
      if (!cur) continue;
      if (patch.done === true) cur.doneAt = now;
      if (patch.done === false) cur.doneAt = undefined;
      if (patch.photoUrls !== undefined) cur.photoUrls = patch.photoUrls;
      if (patch.notes !== undefined) cur.notes = patch.notes ?? undefined;
      byId.set(patch.itemId, cur);
    }
    checklist = [...byId.values()];
  }

  const $set: Record<string, unknown> = { updatedAt: now, checklist };
  if (input.sessionStatus !== undefined) {
    $set.sessionStatus = input.sessionStatus;
    if (input.sessionStatus === "in_progress" && existing.sessionStatus === "not_started") {
      /* ok */
    }
  }

  await coll.updateOne({ _id: existing._id }, { $set });
  const updated = await coll.findOne({ _id: existing._id });
  if (!updated) throw new HttpError("Aggiornamento fallito", 500);
  return { handover: mapRow(updated) };
}
