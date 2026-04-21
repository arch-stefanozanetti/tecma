import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_proactive_sales_config";

const ConfigSchema = z.object({
  enabled: z.boolean().optional(),
  silentDaysThreshold: z.number().int().min(3).max(90).optional(),
  hotLeadRequestDays: z.number().int().min(1).max(30).optional(),
  hotLeadMinRequests: z.number().int().min(1).max(20).optional(),
  maxMessagesPerWeekPerLead: z.number().int().min(1).max(10).optional(),
  mode: z.enum(["suggestion", "auto"]).optional(),
  minScoreToCreate: z.number().min(0).max(100).optional()
});

export interface ProactiveSalesConfigPublic {
  enabled: boolean;
  silentDaysThreshold: number;
  hotLeadRequestDays: number;
  hotLeadMinRequests: number;
  maxMessagesPerWeekPerLead: number;
  mode: "suggestion" | "auto";
  minScoreToCreate: number;
}

const DEFAULTS: ProactiveSalesConfigPublic = {
  enabled: false,
  silentDaysThreshold: 10,
  hotLeadRequestDays: 14,
  hotLeadMinRequests: 2,
  maxMessagesPerWeekPerLead: 2,
  mode: "suggestion",
  minScoreToCreate: 35
};

function merge(doc: Record<string, unknown> | null): ProactiveSalesConfigPublic {
  if (!doc) return { ...DEFAULTS };
  return {
    enabled: doc.enabled === true,
    silentDaysThreshold:
      typeof doc.silentDaysThreshold === "number" ? doc.silentDaysThreshold : DEFAULTS.silentDaysThreshold,
    hotLeadRequestDays:
      typeof doc.hotLeadRequestDays === "number" ? doc.hotLeadRequestDays : DEFAULTS.hotLeadRequestDays,
    hotLeadMinRequests:
      typeof doc.hotLeadMinRequests === "number" ? doc.hotLeadMinRequests : DEFAULTS.hotLeadMinRequests,
    maxMessagesPerWeekPerLead:
      typeof doc.maxMessagesPerWeekPerLead === "number"
        ? doc.maxMessagesPerWeekPerLead
        : DEFAULTS.maxMessagesPerWeekPerLead,
    mode: doc.mode === "auto" ? "auto" : "suggestion",
    minScoreToCreate: typeof doc.minScoreToCreate === "number" ? doc.minScoreToCreate : DEFAULTS.minScoreToCreate
  };
}

export async function getProactiveSalesConfig(workspaceId: string): Promise<ProactiveSalesConfigPublic> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId });
  return merge(doc as Record<string, unknown> | null);
}

export async function patchProactiveSalesConfig(workspaceId: string, raw: unknown): Promise<ProactiveSalesConfigPublic> {
  const parsed = ConfigSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError("Validazione configurazione Proactive Sales", 400);
  const db = getDb();
  const prev = await db.collection(COLLECTION).findOne({ workspaceId });
  const base = merge(prev as Record<string, unknown> | null);
  const next: Record<string, unknown> = {
    workspaceId,
    ...base,
    ...parsed.data,
    updatedAt: new Date().toISOString()
  };
  await db.collection(COLLECTION).updateOne({ workspaceId }, { $set: next }, { upsert: true });
  return merge(next);
}
