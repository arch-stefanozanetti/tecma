/**
 * Product Discovery: features (concrete dev items).
 * Collection: tz_features. Admin only.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_features";

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

export interface FeatureRow {
  _id: string;
  title: string;
  description?: string;
  initiative_id?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

const CreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  initiative_id: z.string().optional(),
  status: z.string().max(50).optional(),
});

const UpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  initiative_id: z.string().optional(),
  status: z.string().max(50).optional(),
});

export const listFeatures = async (opts?: {
  initiativeId?: string;
}): Promise<FeatureRow[]> => {
  const db = getDb();
  const filter: Record<string, unknown> = {};
  if (opts?.initiativeId && opts.initiativeId.trim()) {
    filter.initiative_id = opts.initiativeId;
  }
  const docs = await db
    .collection(COLLECTION)
    .find(filter)
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d: Record<string, unknown>) => ({
    _id: String(d._id ?? ""),
    title: typeof d.title === "string" ? d.title : "",
    description: typeof d.description === "string" ? d.description : undefined,
    initiative_id: typeof d.initiative_id === "string" ? d.initiative_id : undefined,
    status: typeof d.status === "string" ? d.status : undefined,
    createdAt: toIsoDate(d.createdAt),
    updatedAt: toIsoDate(d.updatedAt),
  }));
};

export const getFeatureById = async (rawId: unknown): Promise<FeatureRow> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) throw new HttpError("Feature not found", 404);
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  if (!doc) throw new HttpError("Feature not found", 404);
  const d = doc as Record<string, unknown>;
  return {
    _id: String(d._id ?? ""),
    title: typeof d.title === "string" ? d.title : "",
    description: typeof d.description === "string" ? d.description : undefined,
    initiative_id: typeof d.initiative_id === "string" ? d.initiative_id : undefined,
    status: typeof d.status === "string" ? d.status : undefined,
    createdAt: toIsoDate(d.createdAt),
    updatedAt: toIsoDate(d.updatedAt),
  };
};

export const createFeature = async (rawInput: unknown): Promise<FeatureRow> => {
  const input = CreateSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    title: input.title.trim(),
    description: input.description?.trim(),
    initiative_id: input.initiative_id?.trim() || undefined,
    status: input.status?.trim(),
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection(COLLECTION).insertOne(doc);
  return {
    _id: result.insertedId.toHexString(),
    title: doc.title,
    description: doc.description,
    initiative_id: doc.initiative_id,
    status: doc.status,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateFeature = async (
  rawId: unknown,
  rawInput: unknown
): Promise<FeatureRow> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  const input = UpdateSchema.parse(rawInput);
  if (!ObjectId.isValid(id)) throw new HttpError("Feature not found", 404);
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.description !== undefined) update.description = input.description?.trim();
  if (input.initiative_id !== undefined)
    update.initiative_id = input.initiative_id?.trim() || null;
  if (input.status !== undefined) update.status = input.status?.trim();
  const result = await coll.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) throw new HttpError("Feature not found", 404);
  const d = result as Record<string, unknown>;
  return {
    _id: String(d._id ?? ""),
    title: typeof d.title === "string" ? d.title : "",
    description: typeof d.description === "string" ? d.description : undefined,
    initiative_id: typeof d.initiative_id === "string" ? d.initiative_id : undefined,
    status: typeof d.status === "string" ? d.status : undefined,
    createdAt: toIsoDate(d.createdAt),
    updatedAt: toIsoDate(d.updatedAt),
  };
};
