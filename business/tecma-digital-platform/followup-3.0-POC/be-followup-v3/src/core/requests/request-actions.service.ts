import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

/** Tipo azione timeline (trattative). */
export type RequestActionType = "note" | "call" | "email" | "meeting" | "other";

export interface RequestActionRow {
  _id: string;
  workspaceId: string;
  /** Trattative associate (almeno una). */
  requestIds: string[];
  type: RequestActionType;
  title?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

const COLLECTION = "tz_request_actions";

const CreateSchema = z.object({
  workspaceId: z.string().min(1),
  requestIds: z.array(z.string().min(1)).min(1),
  type: z.enum(["note", "call", "email", "meeting", "other"]),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
});

const UpdateSchema = z.object({
  requestIds: z.array(z.string().min(1)).min(1).optional(),
  type: z.enum(["note", "call", "email", "meeting", "other"]).optional(),
  title: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
});

function toRow(d: {
  _id: ObjectId;
  workspaceId?: string;
  requestIds?: string[];
  type?: string;
  title?: string;
  description?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  userId?: string;
}): RequestActionRow {
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    workspaceId: d.workspaceId ?? "",
    requestIds: Array.isArray(d.requestIds) ? d.requestIds : [],
    type: (d.type as RequestActionType) ?? "note",
    title: d.title,
    description: d.description,
    createdAt:
      typeof d.createdAt === "string"
        ? d.createdAt
        : d.createdAt instanceof Date
          ? d.createdAt.toISOString()
          : "",
    updatedAt:
      typeof d.updatedAt === "string"
        ? d.updatedAt
        : d.updatedAt instanceof Date
          ? d.updatedAt.toISOString()
          : "",
    userId: d.userId,
  };
}

/**
 * Recupera un'azione per id (per access check).
 */
export async function getRequestActionById(rawId: unknown): Promise<RequestActionRow | null> {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  return doc ? toRow(doc as Parameters<typeof toRow>[0]) : null;
}

/**
 * Lista azioni del workspace, opzionalmente filtrate per una trattativa.
 * Ordine: dalla più recente alla più vecchia.
 */
export async function listRequestActions(
  workspaceId: string,
  requestId?: string
): Promise<{ actions: RequestActionRow[] }> {
  if (!workspaceId) {
    throw new HttpError("workspaceId required", 400);
  }
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const match: Record<string, unknown> = { workspaceId };
  if (requestId && requestId.trim()) {
    match.requestIds = requestId.trim();
  }
  const docs = await coll.find(match).sort({ createdAt: -1 }).toArray();
  const actions = docs.map((d) => toRow(d as Parameters<typeof toRow>[0]));
  return { actions };
}

/**
 * Crea una nuova azione (associata a una o più trattative).
 */
export async function createRequestAction(
  rawBody: unknown,
  options?: { userId?: string }
): Promise<{ action: RequestActionRow }> {
  const body = CreateSchema.parse(rawBody);
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const now = new Date().toISOString();
  const doc = {
    workspaceId: body.workspaceId,
    requestIds: body.requestIds,
    type: body.type,
    title: body.title ?? undefined,
    description: body.description ?? undefined,
    createdAt: now,
    updatedAt: now,
    userId: options?.userId,
  };
  const result = await coll.insertOne(doc);
  const inserted = await coll.findOne({ _id: result.insertedId });
  if (!inserted) throw new HttpError("Failed to read created action", 500);
  return { action: toRow(inserted as Parameters<typeof toRow>[0]) };
}

/**
 * Aggiorna un'azione esistente.
 */
export async function updateRequestAction(
  rawId: unknown,
  rawBody: unknown,
  options?: { userId?: string }
): Promise<{ action: RequestActionRow }> {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  const body = UpdateSchema.parse(rawBody);
  if (!ObjectId.isValid(id)) throw new HttpError("Action not found", 404);
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const doc = await coll.findOne({ _id: new ObjectId(id) });
  if (!doc) throw new HttpError("Action not found", 404);
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updatedAt: now };
  if (body.requestIds !== undefined) update.requestIds = body.requestIds;
  if (body.type !== undefined) update.type = body.type;
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description;
  await coll.updateOne({ _id: new ObjectId(id) }, { $set: update });
  const updated = await coll.findOne({ _id: new ObjectId(id) });
  if (!updated) throw new HttpError("Failed to read updated action", 500);
  return { action: toRow(updated as Parameters<typeof toRow>[0]) };
}

/**
 * Elimina un'azione.
 */
export async function deleteRequestAction(rawId: unknown): Promise<{ deleted: true }> {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) throw new HttpError("Action not found", 404);
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const result = await coll.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) throw new HttpError("Action not found", 404);
  return { deleted: true };
}
