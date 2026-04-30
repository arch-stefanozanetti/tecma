/**
 * Product Discovery: opportunities (cluster of customer needs).
 * Collection: tz_opportunities. feedback_count denormalized. Admin only.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_opportunities";
const CUSTOMER_NEEDS_COLLECTION = "tz_customer_needs";

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

export interface OpportunityRow {
  _id: string;
  title: string;
  problem_statement?: string;
  affected_users?: string[];
  feedback_count: number;
  impact_score?: string;
  initiative_id?: string;
  createdAt: string;
  updatedAt: string;
}

const CreateSchema = z.object({
  title: z.string().min(1).max(500),
  problem_statement: z.string().max(2000).optional(),
  affected_users: z.array(z.string()).optional(),
  impact_score: z.string().max(50).optional(),
  initiative_id: z.string().optional(),
});

const UpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  problem_statement: z.string().max(2000).optional(),
  affected_users: z.array(z.string()).optional(),
  impact_score: z.string().max(50).optional(),
  initiative_id: z.string().optional(),
});

/** Recompute and set feedback_count for an opportunity from tz_customer_needs. */
export const refreshOpportunityFeedbackCount = async (opportunityId: string): Promise<number> => {
  if (!ObjectId.isValid(opportunityId)) return 0;
  const db = getDb();
  const count = await db
    .collection(CUSTOMER_NEEDS_COLLECTION)
    .countDocuments({ opportunity_id: opportunityId });
  await db
    .collection(COLLECTION)
    .updateOne(
      { _id: new ObjectId(opportunityId) },
      { $set: { feedback_count: count, updatedAt: new Date().toISOString() } }
    );
  return count;
};

const TOP_PROBLEMS_LIMIT = 5;

/** Top opportunities by feedback_count (for Suggested Roadmap / Top Problems view). */
export const listTopProblems = async (): Promise<OpportunityRow[]> => {
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({})
    .sort({ feedback_count: -1 })
    .limit(TOP_PROBLEMS_LIMIT)
    .toArray();
  return docs.map((d: Record<string, unknown>) => ({
    _id: String(d._id ?? ""),
    title: typeof d.title === "string" ? d.title : "",
    problem_statement: typeof d.problem_statement === "string" ? d.problem_statement : undefined,
    affected_users: Array.isArray(d.affected_users) ? d.affected_users.map(String) : undefined,
    feedback_count: typeof d.feedback_count === "number" ? d.feedback_count : 0,
    impact_score: typeof d.impact_score === "string" ? d.impact_score : undefined,
    initiative_id: typeof d.initiative_id === "string" ? d.initiative_id : undefined,
    createdAt: toIsoDate(d.createdAt),
    updatedAt: toIsoDate(d.updatedAt),
  }));
};

export const listOpportunities = async (opts?: {
  initiativeId?: string;
}): Promise<OpportunityRow[]> => {
  const db = getDb();
  const filter: Record<string, unknown> = {};
  if (opts?.initiativeId && opts.initiativeId.trim()) {
    if (ObjectId.isValid(opts.initiativeId)) {
      filter.initiative_id = opts.initiativeId;
    }
  }
  const docs = await db
    .collection(COLLECTION)
    .find(filter)
    .sort({ updatedAt: -1 })
    .toArray();
  return docs.map((d: Record<string, unknown>) => ({
    _id: String(d._id ?? ""),
    title: typeof d.title === "string" ? d.title : "",
    problem_statement: typeof d.problem_statement === "string" ? d.problem_statement : undefined,
    affected_users: Array.isArray(d.affected_users) ? d.affected_users.map(String) : undefined,
    feedback_count: typeof d.feedback_count === "number" ? d.feedback_count : 0,
    impact_score: typeof d.impact_score === "string" ? d.impact_score : undefined,
    initiative_id: typeof d.initiative_id === "string" ? d.initiative_id : undefined,
    createdAt: toIsoDate(d.createdAt),
    updatedAt: toIsoDate(d.updatedAt),
  }));
};

export const getOpportunityById = async (rawId: unknown): Promise<OpportunityRow> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) throw new HttpError("Opportunity not found", 404);
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  if (!doc) throw new HttpError("Opportunity not found", 404);
  const d = doc as Record<string, unknown>;
  return {
    _id: String(d._id ?? ""),
    title: typeof d.title === "string" ? d.title : "",
    problem_statement: typeof d.problem_statement === "string" ? d.problem_statement : undefined,
    affected_users: Array.isArray(d.affected_users) ? d.affected_users.map(String) : undefined,
    feedback_count: typeof d.feedback_count === "number" ? d.feedback_count : 0,
    impact_score: typeof d.impact_score === "string" ? d.impact_score : undefined,
    initiative_id: typeof d.initiative_id === "string" ? d.initiative_id : undefined,
    createdAt: toIsoDate(d.createdAt),
    updatedAt: toIsoDate(d.updatedAt),
  };
};

export const createOpportunity = async (rawInput: unknown): Promise<OpportunityRow> => {
  const input = CreateSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    title: input.title.trim(),
    problem_statement: input.problem_statement?.trim(),
    affected_users: input.affected_users ?? [],
    feedback_count: 0,
    impact_score: input.impact_score?.trim(),
    initiative_id: input.initiative_id?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection(COLLECTION).insertOne(doc);
  const _id = result.insertedId.toHexString();
  return {
    _id,
    title: doc.title,
    problem_statement: doc.problem_statement,
    affected_users: doc.affected_users,
    feedback_count: 0,
    impact_score: doc.impact_score,
    initiative_id: doc.initiative_id,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateOpportunity = async (
  rawId: unknown,
  rawInput: unknown
): Promise<OpportunityRow> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  const input = UpdateSchema.parse(rawInput);
  if (!ObjectId.isValid(id)) throw new HttpError("Opportunity not found", 404);
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.title !== undefined) update.title = input.title.trim();
  if (input.problem_statement !== undefined)
    update.problem_statement = input.problem_statement.trim();
  if (input.affected_users !== undefined) update.affected_users = input.affected_users;
  if (input.impact_score !== undefined) update.impact_score = input.impact_score?.trim();
  if (input.initiative_id !== undefined) update.initiative_id = input.initiative_id?.trim() || null;
  const result = await coll.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) throw new HttpError("Opportunity not found", 404);
  const d = result as Record<string, unknown>;
  return {
    _id: String(d._id ?? ""),
    title: typeof d.title === "string" ? d.title : "",
    problem_statement: typeof d.problem_statement === "string" ? d.problem_statement : undefined,
    affected_users: Array.isArray(d.affected_users) ? d.affected_users.map(String) : undefined,
    feedback_count: typeof d.feedback_count === "number" ? d.feedback_count : 0,
    impact_score: typeof d.impact_score === "string" ? d.impact_score : undefined,
    initiative_id: typeof d.initiative_id === "string" ? d.initiative_id : undefined,
    createdAt: toIsoDate(d.createdAt),
    updatedAt: toIsoDate(d.updatedAt),
  };
};
