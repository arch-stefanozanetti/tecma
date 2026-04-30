/**
 * Additional infos service.
 * Custom campi per workspace (tz_additional_infos), ereditate da tutti i progetti del workspace.
 * Solo scrittura su test-zanetti.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_additional_infos";

export type AdditionalInfoType = "text" | "radio" | "slider" | "number" | "checkbox";

export interface AdditionalInfoRow {
  _id: string;
  workspaceId: string;
  name: string;
  type: AdditionalInfoType;
  label: string;
  path?: string;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  position?: number;
  subSection?: string;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
}

const CreateSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/, "Solo lettere, numeri e underscore"),
  type: z.enum(["text", "radio", "slider", "number", "checkbox"]),
  label: z.string().min(1).max(200),
  path: z.string().max(50).optional(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  required: z.boolean().optional(),
  position: z.number().int().optional(),
  subSection: z.string().max(100).optional(),
  active: z.boolean().optional(),
});

const UpdateSchema = CreateSchema.partial().omit({ workspaceId: true });

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

const mapDoc = (d: Record<string, unknown>): AdditionalInfoRow => ({
  _id: String(d._id ?? ""),
  workspaceId: String(d.workspaceId ?? ""),
  name: typeof d.name === "string" ? d.name : "",
  type: (["text", "radio", "slider", "number", "checkbox"].includes(String(d.type)) ? d.type : "text") as AdditionalInfoType,
  label: typeof d.label === "string" ? d.label : "",
  path: typeof d.path === "string" ? d.path : undefined,
  options: Array.isArray(d.options) ? d.options.filter((x): x is string => typeof x === "string") : undefined,
  min: typeof d.min === "number" ? d.min : undefined,
  max: typeof d.max === "number" ? d.max : undefined,
  step: typeof d.step === "number" ? d.step : undefined,
  required: typeof d.required === "boolean" ? d.required : undefined,
  position: typeof d.position === "number" ? d.position : undefined,
  subSection: typeof d.subSection === "string" ? d.subSection : undefined,
  active: typeof d.active === "boolean" ? d.active : true,
  createdAt: toIsoDate(d.createdAt),
  updatedAt: toIsoDate(d.updatedAt),
});

/** Singolo record per id Mongo (per audit prima di delete). */
export const getAdditionalInfoById = async (rawId: unknown): Promise<AdditionalInfoRow | null> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  return mapDoc(doc as unknown as Record<string, unknown>);
};

/** Lista additional infos per workspace. */
export const listByWorkspace = async (rawWorkspaceId: unknown): Promise<AdditionalInfoRow[]> => {
  const workspaceId = typeof rawWorkspaceId === "string" ? rawWorkspaceId : String(rawWorkspaceId);
  if (!workspaceId.trim()) throw new HttpError("workspaceId required", 400);
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ workspaceId })
    .sort({ position: 1, createdAt: 1 })
    .toArray();
  return docs.map((d) => mapDoc(d as unknown as Record<string, unknown>));
};

/** Crea additional info (admin). */
export const createAdditionalInfo = async (rawInput: unknown): Promise<{ additionalInfo: AdditionalInfoRow }> => {
  const input = CreateSchema.parse(rawInput);
  const db = getDb();
  const wsColl = db.collection("tz_workspaces");
  const workspaceId = input.workspaceId.trim();
  if (!ObjectId.isValid(workspaceId)) {
    throw new HttpError("Invalid workspaceId", 400);
  }
  const ws = await wsColl.findOne({ _id: new ObjectId(workspaceId) });
  if (!ws) throw new HttpError("Workspace not found", 404);

  const coll = db.collection(COLLECTION);
  const existing = await coll.findOne({ workspaceId, name: input.name.trim().toLowerCase() });
  if (existing) {
    throw new HttpError(`Campo "${input.name}" già esistente per questo workspace`, 400);
  }

  const now = new Date().toISOString();
  const doc = {
    workspaceId,
    name: input.name.trim().toLowerCase(),
    type: input.type,
    label: input.label.trim(),
    path: input.path?.trim() ?? "additionalInfo",
    options: input.options ?? undefined,
    min: input.min,
    max: input.max,
    step: input.step,
    required: input.required ?? false,
    position: input.position ?? 0,
    subSection: input.subSection?.trim(),
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
  const result = await coll.insertOne(doc);
  return {
    additionalInfo: mapDoc({ ...doc, _id: result.insertedId } as unknown as Record<string, unknown>),
  };
};

/** Aggiorna additional info (admin). */
export const updateAdditionalInfo = async (
  rawId: unknown,
  rawInput: unknown
): Promise<{ additionalInfo: AdditionalInfoRow }> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  const input = UpdateSchema.parse(rawInput);
  if (!ObjectId.isValid(id)) throw new HttpError("Not found", 404);
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name.trim().toLowerCase();
  if (input.type !== undefined) update.type = input.type;
  if (input.label !== undefined) update.label = input.label.trim();
  if (input.path !== undefined) update.path = input.path?.trim();
  if (input.options !== undefined) update.options = input.options;
  if (input.min !== undefined) update.min = input.min;
  if (input.max !== undefined) update.max = input.max;
  if (input.step !== undefined) update.step = input.step;
  if (input.required !== undefined) update.required = input.required;
  if (input.position !== undefined) update.position = input.position;
  if (input.subSection !== undefined) update.subSection = input.subSection?.trim();
  if (input.active !== undefined) update.active = input.active;

  const result = await coll.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) throw new HttpError("Not found", 404);
  return { additionalInfo: mapDoc(result as unknown as Record<string, unknown>) };
};

/** Elimina additional info (admin). */
export const deleteAdditionalInfo = async (rawId: unknown): Promise<{ deleted: boolean }> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) throw new HttpError("Not found", 404);
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) throw new HttpError("Not found", 404);
  return { deleted: true };
};
