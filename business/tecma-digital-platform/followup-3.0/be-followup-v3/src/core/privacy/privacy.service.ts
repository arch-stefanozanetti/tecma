import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { createOperationalAlert } from "../ops/operational-alerts.service.js";

const CONSENTS_COLLECTION = "tz_privacy_consents";
const CLIENTS_COLLECTION = "tz_clients";
const REQUESTS_COLLECTION = "tz_requests";
const TRANSITIONS_COLLECTION = "tz_request_transitions";
const CALENDAR_COLLECTION = "calendar_events";
const AUDIT_COLLECTION = "tz_audit_log";

const nowIso = (): string => new Date().toISOString();

const ConsentTypeSchema = z.enum([
  "marketing_email",
  "marketing_sms",
  "profiling",
  "third_party_sharing",
]);

const UpsertConsentSchema = z.object({
  workspaceId: z.string().min(1),
  clientId: z.string().min(1),
  consentType: ConsentTypeSchema,
  granted: z.boolean(),
  source: z.string().default("manual"),
  actorId: z.string().optional(),
});

const EraseSchema = z.object({
  workspaceId: z.string().min(1),
  clientId: z.string().min(1),
  reason: z.string().min(1).default("gdpr_erasure"),
  actorId: z.string().optional(),
});

const RetentionSchema = z.object({
  olderThanDays: z.number().int().min(1).max(3650).default(365),
});

const toObjectIdOrRaw = (id: string): ObjectId | string => (ObjectId.isValid(id) ? new ObjectId(id) : id);

export const upsertClientConsent = async (rawInput: unknown): Promise<{ ok: boolean }> => {
  const input = UpsertConsentSchema.parse(rawInput);
  const db = getDb();
  const at = nowIso();
  await db.collection(CONSENTS_COLLECTION).updateOne(
    {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      consentType: input.consentType,
    },
    {
      $set: {
        granted: input.granted,
        source: input.source,
        actorId: input.actorId ?? null,
        updatedAt: at,
      },
      $setOnInsert: {
        createdAt: at,
      },
    },
    { upsert: true },
  );
  return { ok: true };
};

export const revokeClientConsent = async (rawInput: unknown): Promise<{ ok: boolean }> => {
  const source = typeof rawInput === "object" && rawInput !== null ? (rawInput as Record<string, unknown>) : {};
  const input = UpsertConsentSchema.parse({ ...source, granted: false });
  return upsertClientConsent(input);
};

export const exportClientPrivacyBundle = async (
  workspaceId: string,
  clientId: string,
): Promise<Record<string, unknown>> => {
  if (!workspaceId || !clientId) throw new HttpError("workspaceId/clientId required", 400);
  const db = getDb();
  const clientFilter: Record<string, unknown> = { workspaceId, _id: toObjectIdOrRaw(clientId) };
  const client = await db.collection(CLIENTS_COLLECTION).findOne(clientFilter);
  if (!client) throw new HttpError("Client not found", 404);
  const requests = await db.collection(REQUESTS_COLLECTION).find({ workspaceId, clientId }).sort({ updatedAt: -1 }).toArray();
  const requestIds = requests
    .map((r) => (r._id instanceof ObjectId ? r._id.toHexString() : String(r._id ?? "")))
    .filter(Boolean);
  const transitions = requestIds.length
    ? await db.collection(TRANSITIONS_COLLECTION).find({ requestId: { $in: requestIds } }).sort({ createdAt: -1 }).toArray()
    : [];
  const calendarEvents = await db.collection(CALENDAR_COLLECTION).find({ workspaceId, clientId }).sort({ startsAt: -1 }).toArray();
  const consents = await db.collection(CONSENTS_COLLECTION).find({ workspaceId, clientId }).sort({ updatedAt: -1 }).toArray();

  return {
    exportedAt: nowIso(),
    workspaceId,
    clientId,
    client,
    consents,
    requests,
    requestTransitions: transitions,
    calendarEvents,
  };
};

export const eraseClientData = async (rawInput: unknown): Promise<{ ok: boolean; erasedAt: string }> => {
  const input = EraseSchema.parse(rawInput);
  const db = getDb();
  const erasedAt = nowIso();
  const clientFilter: Record<string, unknown> = { workspaceId: input.workspaceId, _id: toObjectIdOrRaw(input.clientId) };
  const result = await db.collection(CLIENTS_COLLECTION).updateOne(
    clientFilter,
    {
      $set: {
        fullName: `Deleted Client ${input.clientId.slice(-6)}`,
        email: null,
        phone: null,
        notes: null,
        gdprErasedAt: erasedAt,
        gdprEraseReason: input.reason,
        gdprErasedBy: input.actorId ?? null,
        updatedAt: erasedAt,
      },
    },
  );
  if (result.matchedCount === 0) throw new HttpError("Client not found", 404);

  await db.collection(REQUESTS_COLLECTION).updateMany(
    { workspaceId: input.workspaceId, clientId: input.clientId },
    {
      $set: {
        clientDisplayName: "Deleted Client",
        clientErasedAt: erasedAt,
        updatedAt: erasedAt,
      },
    },
  );

  return { ok: true, erasedAt };
};

export const runPrivacyRetentionJob = async (
  rawInput: unknown,
): Promise<{ ok: boolean; olderThanDays: number; deletedAuditRows: number; runAt: string }> => {
  const input = RetentionSchema.parse(rawInput ?? {});
  const db = getDb();
  const runAt = nowIso();
  const threshold = new Date(Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000).toISOString();
  const auditDelete = await db.collection(AUDIT_COLLECTION).deleteMany({ at: { $lt: threshold } });
  if ((auditDelete.deletedCount ?? 0) === 0) {
    await createOperationalAlert({
      workspaceId: "global",
      source: "privacy.retention",
      severity: "info",
      title: "Retention run without deletions",
      message: "Il job retention è stato eseguito senza record eliminati.",
      payload: { olderThanDays: input.olderThanDays, runAt },
    });
  }
  return {
    ok: true,
    olderThanDays: input.olderThanDays,
    deletedAuditRows: auditDelete.deletedCount ?? 0,
    runAt,
  };
};
