import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ListQuerySchema, buildPagination } from "../shared/list-query.js";
import { HttpError, type PaginatedResponse } from "../../types/http.js";
import { escapeForMongoRegexSubstring } from "../shared/searchTextRegex.js";

const COLLECTION = "tz_unit_issues";

const ObjectIdLikeSchema = z.string().min(1);

export const UnitIssueStatusSchema = z.enum(["open", "in_progress", "resolved", "closed"]);
export const UnitIssuePrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const UnitIssueCreateSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  apartmentId: ObjectIdLikeSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(20000).default(""),
  status: UnitIssueStatusSchema.default("open"),
  priority: UnitIssuePrioritySchema.default("medium"),
  assigneeUserId: z.string().min(1).optional(),
  contractorNote: z.string().max(10000).optional(),
  photoUrls: z.array(z.string().min(1).max(2000)).max(50).default([]),
  clientId: ObjectIdLikeSchema.optional(),
  requestId: ObjectIdLikeSchema.optional(),
});

export const UnitIssuePatchSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(20000).optional(),
  status: UnitIssueStatusSchema.optional(),
  priority: UnitIssuePrioritySchema.optional(),
  assigneeUserId: z.string().min(1).nullable().optional(),
  contractorNote: z.string().max(10000).nullable().optional(),
  photoUrls: z.array(z.string().min(1).max(2000)).max(50).optional(),
  clientId: ObjectIdLikeSchema.nullable().optional(),
  requestId: ObjectIdLikeSchema.nullable().optional(),
});

export type UnitIssueRow = {
  _id: string;
  workspaceId: string;
  projectId: string;
  apartmentId: string;
  title: string;
  description: string;
  status: z.infer<typeof UnitIssueStatusSchema>;
  priority: z.infer<typeof UnitIssuePrioritySchema>;
  assigneeUserId?: string;
  contractorNote?: string;
  photoUrls: string[];
  clientId?: string;
  requestId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

type RawUnitIssue = Document & {
  _id: ObjectId;
  workspaceId: string;
  projectId: string;
  apartmentId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assigneeUserId?: string;
  contractorNote?: string;
  photoUrls?: string[];
  clientId?: string;
  requestId?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
};

const toObjectId = (value: string): ObjectId => {
  if (!ObjectId.isValid(value)) throw new HttpError(`ID non valido: ${value}`, 400);
  return new ObjectId(value);
};

const mapRow = (doc: RawUnitIssue): UnitIssueRow => ({
  _id: doc._id.toHexString(),
  workspaceId: doc.workspaceId,
  projectId: doc.projectId,
  apartmentId: doc.apartmentId,
  title: doc.title,
  description: doc.description ?? "",
  status: doc.status as UnitIssueRow["status"],
  priority: doc.priority as UnitIssueRow["priority"],
  assigneeUserId: doc.assigneeUserId,
  contractorNote: doc.contractorNote,
  photoUrls: Array.isArray(doc.photoUrls) ? doc.photoUrls : [],
  clientId: doc.clientId,
  requestId: doc.requestId,
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

export async function queryUnitIssues(raw: unknown): Promise<PaginatedResponse<UnitIssueRow>> {
  const q = ListQuerySchema.parse(raw);
  const db = getDb();
  const coll = db.collection<RawUnitIssue>(COLLECTION);
  const { skip, limit } = buildPagination(q.page, q.perPage);

  const match: Record<string, unknown> = {
    workspaceId: q.workspaceId,
    projectId: { $in: q.projectIds },
  };

  const apartmentId = q.filters?.apartmentId;
  if (typeof apartmentId === "string" && apartmentId.trim()) {
    match.apartmentId = apartmentId.trim();
  }
  const status = q.filters?.status;
  if (typeof status === "string" && status.trim()) {
    match.status = status.trim();
  }

  if (q.searchText && q.searchText.trim()) {
    const esc = escapeForMongoRegexSubstring(q.searchText.trim());
    match.$or = [{ title: { $regex: esc, $options: "i" } }, { description: { $regex: esc, $options: "i" } }];
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

export async function getUnitIssueById(
  issueId: string,
  workspaceId: string
): Promise<{ issue: UnitIssueRow }> {
  if (!workspaceId.trim()) throw new HttpError("workspaceId obbligatorio", 400);
  const db = getDb();
  const coll = db.collection<RawUnitIssue>(COLLECTION);
  const doc = await coll.findOne({ _id: toObjectId(issueId), workspaceId });
  if (!doc) throw new HttpError("Segnalazione non trovata", 404);
  return { issue: mapRow(doc) };
}

export async function createUnitIssue(
  raw: unknown,
  opts: { userId?: string }
): Promise<{ issue: UnitIssueRow }> {
  const input = UnitIssueCreateSchema.parse(raw);
  await assertApartmentInProject(input.apartmentId, input.workspaceId, input.projectId);
  const now = new Date().toISOString();
  const db = getDb();
  const coll = db.collection<RawUnitIssue>(COLLECTION);
  const doc: RawUnitIssue = {
    _id: new ObjectId(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apartmentId: input.apartmentId,
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    assigneeUserId: input.assigneeUserId,
    contractorNote: input.contractorNote,
    photoUrls: input.photoUrls,
    clientId: input.clientId,
    requestId: input.requestId,
    createdAt: now,
    updatedAt: now,
    createdBy: opts.userId,
  };
  await coll.insertOne(doc);
  return { issue: mapRow(doc) };
}

export async function patchUnitIssue(
  issueId: string,
  raw: unknown,
  _opts: { userId?: string }
): Promise<{ issue: UnitIssueRow }> {
  const input = UnitIssuePatchSchema.parse(raw);
  const db = getDb();
  const coll = db.collection<RawUnitIssue>(COLLECTION);
  const existing = await coll.findOne({
    _id: toObjectId(issueId),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
  });
  if (!existing) throw new HttpError("Segnalazione non trovata", 404);

  const now = new Date().toISOString();
  const $set: Record<string, unknown> = { updatedAt: now };
  if (input.title !== undefined) $set.title = input.title;
  if (input.description !== undefined) $set.description = input.description;
  if (input.status !== undefined) $set.status = input.status;
  if (input.priority !== undefined) $set.priority = input.priority;
  if (input.assigneeUserId !== undefined) $set.assigneeUserId = input.assigneeUserId ?? undefined;
  if (input.contractorNote !== undefined) $set.contractorNote = input.contractorNote ?? undefined;
  if (input.photoUrls !== undefined) $set.photoUrls = input.photoUrls;
  if (input.clientId !== undefined) $set.clientId = input.clientId ?? undefined;
  if (input.requestId !== undefined) $set.requestId = input.requestId ?? undefined;

  await coll.updateOne({ _id: existing._id }, { $set });
  const updated = await coll.findOne({ _id: existing._id });
  if (!updated) throw new HttpError("Aggiornamento fallito", 500);
  return { issue: mapRow(updated) };
}

export async function deleteUnitIssue(
  issueId: string,
  workspaceId: string,
  projectId: string
): Promise<{ deleted: boolean }> {
  if (!workspaceId.trim() || !projectId.trim()) throw new HttpError("workspaceId e projectId obbligatori", 400);
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const res = await coll.deleteOne({
    _id: toObjectId(issueId),
    workspaceId,
    projectId,
  });
  if (res.deletedCount === 0) throw new HttpError("Segnalazione non trovata", 404);
  return { deleted: true };
}
