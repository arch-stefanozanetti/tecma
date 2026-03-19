import crypto from "node:crypto";
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_automation_dispatch_log";

const nowIso = (): string => new Date().toISOString();

const buildDeterministicKey = (workspaceId: string, eventType: string, payload: Record<string, unknown>): string => {
  const explicitEventId = typeof payload.eventId === "string" ? payload.eventId : "";
  const entityType = typeof payload.entityType === "string" ? payload.entityType : "";
  const entityId = typeof payload.entityId === "string" ? payload.entityId : "";
  const toStatus = typeof payload.toStatus === "string" ? payload.toStatus : "";
  const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : "";
  const createdAt = typeof payload.createdAt === "string" ? payload.createdAt : "";
  const source = explicitEventId || `${workspaceId}|${eventType}|${entityType}|${entityId}|${toStatus}|${updatedAt}|${createdAt}`;
  return crypto.createHash("sha256").update(source, "utf8").digest("hex");
};

export interface DispatchGuardResult {
  shouldProcess: boolean;
  keyHash: string;
}

export const claimDispatchEvent = async (
  workspaceId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<DispatchGuardResult> => {
  const keyHash = buildDeterministicKey(workspaceId, eventType, payload);
  const db = getDb();
  const createdAt = nowIso();
  try {
    await db.collection(COLLECTION).insertOne({
      keyHash,
      workspaceId,
      eventType,
      status: "processing",
      attempts: 1,
      createdAt,
      updatedAt: createdAt,
    });
    return { shouldProcess: true, keyHash };
  } catch {
    const existing = await db.collection(COLLECTION).findOne({ keyHash });
    if (!existing) return { shouldProcess: false, keyHash };
    const attempts = typeof existing.attempts === "number" ? existing.attempts : 1;
    if (existing.status === "completed") return { shouldProcess: false, keyHash };
    await db.collection(COLLECTION).updateOne(
      { keyHash },
      {
        $set: { status: "processing", updatedAt: nowIso() },
        $inc: { attempts: 1 },
      },
    );
    if (attempts >= 5) return { shouldProcess: false, keyHash };
    return { shouldProcess: true, keyHash };
  }
};

export const markDispatchCompleted = async (keyHash: string): Promise<void> => {
  const db = getDb();
  await db.collection(COLLECTION).updateOne(
    { keyHash },
    { $set: { status: "completed", completedAt: nowIso(), updatedAt: nowIso(), lastError: null } },
  );
};

export const markDispatchFailed = async (keyHash: string, errorMessage: string): Promise<void> => {
  const db = getDb();
  await db.collection(COLLECTION).updateOne(
    { keyHash },
    { $set: { status: "failed", failedAt: nowIso(), updatedAt: nowIso(), lastError: errorMessage.slice(0, 1000) } },
  );
};

