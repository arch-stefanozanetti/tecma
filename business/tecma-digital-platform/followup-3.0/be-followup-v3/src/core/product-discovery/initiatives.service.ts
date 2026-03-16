/**
 * Product Discovery: initiatives (roadmap).
 * Collection: tz_initiatives. Admin only.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_initiatives";

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

export interface InitiativeRow {
  _id: string;
  title: string;
  description?: string;
  product_area?: string;
  priority?: string;
  status?: string;
  opportunity_ids?: string[];
  estimated_dev_effort?: number;
  estimated_business_impact?: number;
  /** Computed: estimated_business_impact / estimated_dev_effort when both set. */
  roi_score?: number;
  createdAt: string;
  updatedAt: string;
}

const CreateSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  product_area: z.string().max(100).optional(),
  priority: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  opportunity_ids: z.array(z.string()).optional(),
  estimated_dev_effort: z.number().min(0).optional(),
  estimated_business_impact: z.number().min(0).optional(),
});

const UpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(2000).optional(),
  product_area: z.string().max(100).optional(),
  priority: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  opportunity_ids: z.array(z.string()).optional(),
  estimated_dev_effort: z.number().min(0).optional(),
  estimated_business_impact: z.number().min(0).optional(),
});

function mapDocToInitiativeRow(d: Record<string, unknown>): InitiativeRow {
  const effort =
    typeof d.estimated_dev_effort === "number" ? d.estimated_dev_effort : undefined;
  const impact =
    typeof d.estimated_business_impact === "number" ? d.estimated_business_impact : undefined;
  let roi_score: number | undefined;
  if (effort != null && impact != null && effort > 0) {
    roi_score = Math.round((impact / effort) * 100) / 100;
  }
  return {
    _id: String(d._id ?? ""),
    title: typeof d.title === "string" ? d.title : "",
    description: typeof d.description === "string" ? d.description : undefined,
    product_area: typeof d.product_area === "string" ? d.product_area : undefined,
    priority: typeof d.priority === "string" ? d.priority : undefined,
    status: typeof d.status === "string" ? d.status : undefined,
    opportunity_ids: Array.isArray(d.opportunity_ids) ? d.opportunity_ids.map(String) : undefined,
    estimated_dev_effort: effort,
    estimated_business_impact: impact,
    roi_score,
    createdAt: toIsoDate(d.createdAt),
    updatedAt: toIsoDate(d.updatedAt),
  };
}

export const listInitiatives = async (): Promise<InitiativeRow[]> => {
  const db = getDb();
  const docs = await db.collection(COLLECTION).find({}).sort({ updatedAt: -1 }).toArray();
  return docs.map((d: Record<string, unknown>) => mapDocToInitiativeRow(d));
};

const SUGGESTED_ROADMAP_LIMIT = 5;

/** Top initiatives by ROI score (estimated_business_impact / estimated_dev_effort). */
export const listSuggestedRoadmap = async (): Promise<InitiativeRow[]> => {
  const all = await listInitiatives();
  const withRoi = all.filter((i) => i.roi_score != null) as (InitiativeRow & { roi_score: number })[];
  withRoi.sort((a, b) => b.roi_score - a.roi_score);
  return withRoi.slice(0, SUGGESTED_ROADMAP_LIMIT);
};

export const getInitiativeById = async (rawId: unknown): Promise<InitiativeRow> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) throw new HttpError("Initiative not found", 404);
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  if (!doc) throw new HttpError("Initiative not found", 404);
  return mapDocToInitiativeRow(doc as Record<string, unknown>);
};

export const createInitiative = async (rawInput: unknown): Promise<InitiativeRow> => {
  const input = CreateSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    title: input.title.trim(),
    description: input.description?.trim(),
    product_area: input.product_area?.trim(),
    priority: input.priority?.trim(),
    status: input.status?.trim(),
    opportunity_ids: input.opportunity_ids ?? [],
    estimated_dev_effort: input.estimated_dev_effort,
    estimated_business_impact: input.estimated_business_impact,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection(COLLECTION).insertOne(doc);
  return mapDocToInitiativeRow({
    ...doc,
    _id: result.insertedId,
    createdAt: now,
    updatedAt: now,
  });
};

export const updateInitiative = async (
  rawId: unknown,
  rawInput: unknown
): Promise<InitiativeRow> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  const input = UpdateSchema.parse(rawInput);
  if (!ObjectId.isValid(id)) throw new HttpError("Initiative not found", 404);
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.description !== undefined) update.description = input.description?.trim();
  if (input.product_area !== undefined) update.product_area = input.product_area?.trim();
  if (input.priority !== undefined) update.priority = input.priority?.trim();
  if (input.status !== undefined) update.status = input.status?.trim();
  if (input.opportunity_ids !== undefined) update.opportunity_ids = input.opportunity_ids;
  if (input.estimated_dev_effort !== undefined) update.estimated_dev_effort = input.estimated_dev_effort;
  if (input.estimated_business_impact !== undefined)
    update.estimated_business_impact = input.estimated_business_impact;
  const result = await coll.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) throw new HttpError("Initiative not found", 404);
  return mapDocToInitiativeRow(result as Record<string, unknown>);
};
