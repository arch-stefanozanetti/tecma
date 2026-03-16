/**
 * Product Discovery: customer needs (single feedback from the field).
 * Collection: tz_customer_needs. Assigning opportunity_id updates opportunity feedback_count. Admin only.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { refreshOpportunityFeedbackCount } from "./opportunities.service.js";
import { computeNeedScore } from "./scoring-weights.js";

const COLLECTION = "tz_customer_needs";

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

export interface CustomerNeedRow {
  _id: string;
  title: string;
  customer_name?: string;
  customer_segment?: string;
  situation?: string;
  problem: string;
  customer_need?: string;
  workaround?: string;
  impact_description?: string;
  severity?: string;
  frequency?: string;
  business_impact?: string;
  source?: string;
  evidence?: string;
  status: string;
  opportunity_id?: string;
  created_by?: string;
  createdAt: string;
  updatedAt: string;
  /** Computed: severityWeight × frequencyWeight × impactWeight (from Lists). */
  score?: number;
}

const CreateSchema = z.object({
  title: z.string().min(1).max(500),
  customer_name: z.string().max(200).optional(),
  customer_segment: z.string().max(100).optional(),
  situation: z.string().max(1000).optional(),
  problem: z.string().min(1).max(2000),
  customer_need: z.string().max(1000).optional(),
  workaround: z.string().max(1000).optional(),
  impact_description: z.string().max(500).optional(),
  severity: z.string().max(50).optional(),
  frequency: z.string().max(50).optional(),
  business_impact: z.string().max(50).optional(),
  source: z.string().max(100).optional(),
  evidence: z.string().max(500).optional(),
  status: z.string().max(50).optional(),
  opportunity_id: z.string().optional(),
});

const UpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  customer_name: z.string().max(200).optional(),
  customer_segment: z.string().max(100).optional(),
  situation: z.string().max(1000).optional(),
  problem: z.string().min(1).max(2000).optional(),
  customer_need: z.string().max(1000).optional(),
  workaround: z.string().max(1000).optional(),
  impact_description: z.string().max(500).optional(),
  severity: z.string().max(50).optional(),
  frequency: z.string().max(50).optional(),
  business_impact: z.string().max(50).optional(),
  source: z.string().max(100).optional(),
  evidence: z.string().max(500).optional(),
  status: z.string().max(50).optional(),
  opportunity_id: z.string().optional().nullable(),
});

export const listCustomerNeeds = async (opts?: {
  opportunityId?: string;
  status?: string;
}): Promise<CustomerNeedRow[]> => {
  const db = getDb();
  const filter: Record<string, unknown> = {};
  if (opts?.opportunityId && opts.opportunityId.trim()) {
    filter.opportunity_id = opts.opportunityId;
  }
  if (opts?.status && opts.status.trim()) {
    filter.status = opts.status;
  }
  const docs = await db
    .collection(COLLECTION)
    .find(filter)
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((d: Record<string, unknown>) => mapDocToRow(d));
}

export const getCustomerNeedById = async (rawId: unknown): Promise<CustomerNeedRow> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) throw new HttpError("Customer need not found", 404);
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ _id: new ObjectId(id) });
  if (!doc) throw new HttpError("Customer need not found", 404);
  return mapDocToRow(doc as Record<string, unknown>);
};

function mapDocToRow(d: Record<string, unknown>): CustomerNeedRow {
  const severity = typeof d.severity === "string" ? d.severity : undefined;
  const frequency = typeof d.frequency === "string" ? d.frequency : undefined;
  const business_impact = typeof d.business_impact === "string" ? d.business_impact : undefined;
  const row: CustomerNeedRow = {
    _id: String(d._id ?? ""),
    title: typeof d.title === "string" ? d.title : "",
    customer_name: typeof d.customer_name === "string" ? d.customer_name : undefined,
    customer_segment: typeof d.customer_segment === "string" ? d.customer_segment : undefined,
    situation: typeof d.situation === "string" ? d.situation : undefined,
    problem: typeof d.problem === "string" ? d.problem : "",
    customer_need: typeof d.customer_need === "string" ? d.customer_need : undefined,
    workaround: typeof d.workaround === "string" ? d.workaround : undefined,
    impact_description:
      typeof d.impact_description === "string" ? d.impact_description : undefined,
    severity,
    frequency,
    business_impact,
    source: typeof d.source === "string" ? d.source : undefined,
    evidence: typeof d.evidence === "string" ? d.evidence : undefined,
    status: typeof d.status === "string" ? d.status : "collected",
    opportunity_id: typeof d.opportunity_id === "string" ? d.opportunity_id : undefined,
    created_by: typeof d.created_by === "string" ? d.created_by : undefined,
    createdAt: toIsoDate(d.createdAt ?? d.created_at),
    updatedAt: toIsoDate(d.updatedAt ?? d.updated_at),
  };
  row.score = computeNeedScore({ severity, frequency, business_impact });
  return row;
}

export const createCustomerNeed = async (
  rawInput: unknown,
  createdBy?: string
): Promise<CustomerNeedRow> => {
  const input = CreateSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    title: input.title.trim(),
    customer_name: input.customer_name?.trim(),
    customer_segment: input.customer_segment?.trim(),
    situation: input.situation?.trim(),
    problem: input.problem.trim(),
    customer_need: input.customer_need?.trim(),
    workaround: input.workaround?.trim(),
    impact_description: input.impact_description?.trim(),
    severity: input.severity?.trim(),
    frequency: input.frequency?.trim(),
    business_impact: input.business_impact?.trim(),
    source: input.source?.trim(),
    evidence: input.evidence?.trim(),
    status: input.status ?? "collected",
    opportunity_id: input.opportunity_id?.trim() || undefined,
    created_by: createdBy,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection(COLLECTION).insertOne(doc);
  const _id = result.insertedId.toHexString();
  if (doc.opportunity_id) {
    refreshOpportunityFeedbackCount(doc.opportunity_id).catch(() => {});
  }
  const score = computeNeedScore({
    severity: doc.severity,
    frequency: doc.frequency,
    business_impact: doc.business_impact,
  });
  return {
    _id,
    ...doc,
    score,
    createdAt: now,
    updatedAt: now,
  };
};

export const updateCustomerNeed = async (
  rawId: unknown,
  rawInput: unknown
): Promise<CustomerNeedRow> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  const input = UpdateSchema.parse(rawInput);
  if (!ObjectId.isValid(id)) throw new HttpError("Customer need not found", 404);
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const existing = await coll.findOne({ _id: new ObjectId(id) });
  if (!existing) throw new HttpError("Customer need not found", 404);
  const oldOpportunityId =
    typeof (existing as Record<string, unknown>).opportunity_id === "string"
      ? ((existing as Record<string, unknown>).opportunity_id as string)
      : undefined;
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  const fields = [
    "title",
    "customer_name",
    "customer_segment",
    "situation",
    "problem",
    "customer_need",
    "workaround",
    "impact_description",
    "severity",
    "frequency",
    "business_impact",
    "source",
    "evidence",
    "status",
    "opportunity_id",
  ] as const;
  for (const key of fields) {
    const v = input[key];
    if (v !== undefined) {
      (update as Record<string, unknown>)[key] =
        key === "opportunity_id" && (v === null || v === "")
          ? undefined
          : typeof v === "string"
            ? v.trim()
            : v;
    }
  }
  const result = await coll.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) throw new HttpError("Customer need not found", 404);
  const newOpportunityId =
    typeof (result as Record<string, unknown>).opportunity_id === "string"
      ? ((result as Record<string, unknown>).opportunity_id as string)
      : undefined;
  if (oldOpportunityId !== newOpportunityId) {
    if (oldOpportunityId) refreshOpportunityFeedbackCount(oldOpportunityId).catch(() => {});
    if (newOpportunityId) refreshOpportunityFeedbackCount(newOpportunityId).catch(() => {});
  }
  return mapDocToRow(result as Record<string, unknown>);
};
