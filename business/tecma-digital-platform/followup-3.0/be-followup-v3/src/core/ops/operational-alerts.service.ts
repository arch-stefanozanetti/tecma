import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_operational_alerts";

const CreateAlertSchema = z.object({
  workspaceId: z.string().min(1),
  source: z.string().min(1),
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  title: z.string().min(1),
  message: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

const nowIso = (): string => new Date().toISOString();

export const createOperationalAlert = async (rawInput: unknown): Promise<{ ok: boolean; id: string }> => {
  const input = CreateAlertSchema.parse(rawInput);
  const db = getDb();
  const now = nowIso();
  const result = await db.collection(COLLECTION).insertOne({
    workspaceId: input.workspaceId,
    source: input.source,
    severity: input.severity,
    title: input.title,
    message: input.message,
    payload: input.payload ?? null,
    acknowledgedAt: null,
    createdAt: now,
    updatedAt: now,
  });
  return { ok: true, id: result.insertedId.toHexString() };
};

export const listOperationalAlerts = async (workspaceId: string): Promise<{ data: Record<string, unknown>[] }> => {
  const db = getDb();
  const docs = await db.collection(COLLECTION).find({ workspaceId }).sort({ createdAt: -1 }).limit(200).toArray();
  return {
    data: docs.map((doc) => ({
      _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? ""),
      workspaceId: String(doc.workspaceId ?? ""),
      source: String(doc.source ?? ""),
      severity: String(doc.severity ?? "warning"),
      title: String(doc.title ?? ""),
      message: String(doc.message ?? ""),
      payload: doc.payload ?? null,
      acknowledgedAt: typeof doc.acknowledgedAt === "string" ? doc.acknowledgedAt : null,
      createdAt: typeof doc.createdAt === "string" ? doc.createdAt : nowIso(),
      updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : nowIso(),
    })),
  };
};

export const acknowledgeOperationalAlert = async (id: string): Promise<{ ok: boolean }> => {
  const db = getDb();
  if (!ObjectId.isValid(id)) return { ok: false };
  const now = nowIso();
  await db.collection(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    { $set: { acknowledgedAt: now, updatedAt: now } },
  );
  return { ok: true };
};

