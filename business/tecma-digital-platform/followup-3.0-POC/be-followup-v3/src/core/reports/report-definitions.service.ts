/**
 * Definizioni report salvate per workspace (FASE 4): tipo report, filtri data, progetti.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_report_definitions";

export const REPORT_DEFINITION_TYPES = [
  "pipeline",
  "clients_by_status",
  "apartments_by_availability",
  "kpi_summary",
  "activity_per_period",
  "conversions_per_project",
  "avg_times",
] as const;

export type ReportDefinitionType = (typeof REPORT_DEFINITION_TYPES)[number];

export interface ReportDefinitionRow {
  _id: string;
  workspaceId: string;
  name: string;
  reportType: ReportDefinitionType;
  projectIds: string[];
  dateFrom: string | null;
  dateTo: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

const CreateSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(200),
  reportType: z.enum(REPORT_DEFINITION_TYPES),
  projectIds: z.array(z.string().min(1)).min(1),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

const UpdateSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  reportType: z.enum(REPORT_DEFINITION_TYPES).optional(),
  projectIds: z.array(z.string().min(1)).min(1).optional(),
  dateFrom: z.union([z.string(), z.literal("")]).optional(),
  dateTo: z.union([z.string(), z.literal("")]).optional(),
});

function mapDoc(doc: Record<string, unknown>): ReportDefinitionRow {
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? ""),
    workspaceId: typeof doc.workspaceId === "string" ? doc.workspaceId : "",
    name: typeof doc.name === "string" ? doc.name : "",
    reportType: (typeof doc.reportType === "string" ? doc.reportType : "pipeline") as ReportDefinitionType,
    projectIds: Array.isArray(doc.projectIds) ? doc.projectIds.map((x) => String(x)) : [],
    dateFrom: typeof doc.dateFrom === "string" && doc.dateFrom.trim() ? doc.dateFrom : null,
    dateTo: typeof doc.dateTo === "string" && doc.dateTo.trim() ? doc.dateTo : null,
    createdAt:
      doc.createdAt instanceof Date
        ? doc.createdAt.toISOString()
        : typeof doc.createdAt === "string"
          ? doc.createdAt
          : "",
    updatedAt:
      doc.updatedAt instanceof Date
        ? doc.updatedAt.toISOString()
        : typeof doc.updatedAt === "string"
          ? doc.updatedAt
          : "",
    createdBy: typeof doc.createdBy === "string" ? doc.createdBy : null,
  };
}

export async function listReportDefinitions(workspaceId: string): Promise<{ data: ReportDefinitionRow[] }> {
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ workspaceId })
    .sort({ updatedAt: -1 })
    .limit(100)
    .toArray();
  return { data: docs.map((d) => mapDoc(d as Record<string, unknown>)) };
}

export async function createReportDefinition(
  rawInput: unknown,
  options: { userId?: string }
): Promise<{ data: ReportDefinitionRow }> {
  const input = CreateSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();
  const doc: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    name: input.name.trim(),
    reportType: input.reportType,
    projectIds: input.projectIds,
    dateFrom: input.dateFrom?.trim() || null,
    dateTo: input.dateTo?.trim() || null,
    createdAt: now,
    updatedAt: now,
    createdBy: options.userId ?? null,
  };
  const r = await db.collection(COLLECTION).insertOne(doc);
  const inserted = await db.collection(COLLECTION).findOne({ _id: r.insertedId });
  if (!inserted) throw new HttpError("Insert failed", 500);
  return { data: mapDoc(inserted as Record<string, unknown>) };
}

export async function updateReportDefinition(
  id: string,
  rawInput: unknown,
  options: { userId?: string }
): Promise<{ data: ReportDefinitionRow }> {
  if (!ObjectId.isValid(id)) throw new HttpError("Invalid id", 400);
  const input = UpdateSchema.parse(rawInput);
  const db = getDb();
  const existing = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  if (!existing) throw new HttpError("Report definition not found", 404);
  if (String(existing.workspaceId ?? "") !== input.workspaceId) throw new HttpError("Report definition not found", 404);

  const $set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.name !== undefined) $set.name = input.name.trim();
  if (input.reportType !== undefined) $set.reportType = input.reportType;
  if (input.projectIds !== undefined) $set.projectIds = input.projectIds;
  if (input.dateFrom !== undefined) $set.dateFrom = input.dateFrom.trim() === "" ? null : input.dateFrom.trim();
  if (input.dateTo !== undefined) $set.dateTo = input.dateTo.trim() === "" ? null : input.dateTo.trim();
  if (options.userId) $set.updatedBy = options.userId;

  await db.collection(COLLECTION).updateOne({ _id: new ObjectId(id) }, { $set });
  const updated = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  if (!updated) throw new HttpError("Report definition not found", 404);
  return { data: mapDoc(updated as Record<string, unknown>) };
}

export async function getReportDefinitionById(id: string, workspaceId: string): Promise<ReportDefinitionRow | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id), workspaceId });
  if (!doc) return null;
  return mapDoc(doc as Record<string, unknown>);
}

export async function deleteReportDefinition(id: string, workspaceId: string): Promise<{ data: { deleted: boolean } }> {
  if (!ObjectId.isValid(id)) throw new HttpError("Invalid id", 400);
  const db = getDb();
  const r = await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id), workspaceId });
  if (r.deletedCount === 0) throw new HttpError("Report definition not found", 404);
  return { data: { deleted: true } };
}
