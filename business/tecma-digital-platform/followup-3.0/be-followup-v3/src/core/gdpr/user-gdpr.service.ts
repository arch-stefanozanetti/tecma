/**
 * GDPR utente piattaforma: richieste export / cancellazione e consensi.
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { USER_COLLECTION_CANDIDATES } from "../auth/userAccessPayload.js";

const REQUESTS = "tz_gdpr_requests";
const USER_CONSENTS = "tz_user_consents";

export type GdprRequestType = "export" | "erasure";

export interface GdprRequestDoc {
  _id: ObjectId;
  userId: string;
  email: string;
  type: GdprRequestType;
  status: "pending" | "processing" | "completed" | "rejected";
  createdAt: Date;
  processingStartedAt?: Date;
  completedAt?: Date;
  /** Solo type export, payload JSON (no password / segreti). */
  exportPayload?: Record<string, unknown>;
  notes?: string;
}

function requestsColl() {
  return getDb().collection<GdprRequestDoc>(REQUESTS);
}

async function findUserDocById(userId: string): Promise<{ collection: string; doc: Record<string, unknown> } | null> {
  if (!ObjectId.isValid(userId)) return null;
  const id = new ObjectId(userId);
  const db = getDb();
  for (const name of USER_COLLECTION_CANDIDATES) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (!exists) continue;
    const doc = await db.collection(name).findOne({ _id: id });
    if (doc) return { collection: name, doc: doc as Record<string, unknown> };
  }
  return null;
}

async function buildExportPayload(userId: string, emailLower: string): Promise<Record<string, unknown>> {
  const db = getDb();
  const memberships = await db
    .collection("tz_user_workspaces")
    .find({ userId: emailLower })
    .toArray();
  const sec = await db
    .collection<{ _id: string; totpEnabled?: boolean }>("tz_user_security")
    .findOne({ _id: userId });
  const sessionCount = await db.collection("tz_authSessions").countDocuments({ userId });
  const located = await findUserDocById(userId);
  const profile = located
    ? {
        collection: located.collection,
        email: typeof located.doc.email === "string" ? located.doc.email : undefined,
        role: located.doc.role,
        status: located.doc.status,
        system_role: located.doc.system_role,
        project_ids: located.doc.project_ids,
        isDisabled: located.doc.isDisabled
      }
    : null;

  return {
    exportedAt: new Date().toISOString(),
    userId,
    email: emailLower,
    profile,
    workspaceMemberships: memberships.map((m) => ({
      workspaceId: m.workspaceId,
      role: m.role,
      access_scope: m.access_scope
    })),
    mfa: sec
      ? {
          totpEnabled: Boolean((sec as { totpEnabled?: boolean }).totpEnabled)
        }
      : { totpEnabled: false },
    refreshSessionCount: sessionCount
  };
}

export async function createUserGdprRequest(params: {
  userId: string;
  email: string;
  type: GdprRequestType;
}): Promise<{ requestId: string; status: string; data?: Record<string, unknown> }> {
  const emailLower = params.email.trim().toLowerCase();
  const _id = new ObjectId();
  if (params.type === "export") {
    const exportPayload = await buildExportPayload(params.userId, emailLower);
    await requestsColl().insertOne({
      _id,
      userId: params.userId,
      email: emailLower,
      type: "export",
      status: "completed",
      createdAt: new Date(),
      completedAt: new Date(),
      exportPayload
    });
    return { requestId: _id.toHexString(), status: "completed", data: exportPayload };
  }

  await requestsColl().insertOne({
    _id,
    userId: params.userId,
    email: emailLower,
    type: "erasure",
    status: "pending",
    createdAt: new Date(),
    notes: "Richiesta registrata. Elaborazione cancellazione (soft/hard) secondo retention e legal hold."
  });
  return { requestId: _id.toHexString(), status: "pending" };
}

export async function listGdprRequestsForUser(userId: string): Promise<
  Array<{
    id: string;
    type: GdprRequestType;
    status: string;
    createdAt: string;
    hasExport: boolean;
  }>
> {
  const docs = await requestsColl().find({ userId }).sort({ createdAt: -1 }).limit(50).toArray();
  return docs.map((d) => ({
    id: d._id.toHexString(),
    type: d.type,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    hasExport: Boolean(d.exportPayload)
  }));
}

export async function getExportPayloadForUser(userId: string, requestId: string): Promise<Record<string, unknown>> {
  if (!ObjectId.isValid(requestId)) throw new HttpError("Richiesta non trovata", 404);
  const doc = await requestsColl().findOne({
    _id: new ObjectId(requestId),
    userId,
    type: "export"
  });
  if (!doc?.exportPayload) throw new HttpError("Export non disponibile", 404);
  return doc.exportPayload as Record<string, unknown>;
}

export interface UserConsentInput {
  userId: string;
  consentType: string;
  version: string;
  accepted: boolean;
}

export async function upsertUserConsent(input: UserConsentInput): Promise<void> {
  const now = new Date();
  await getDb()
    .collection(USER_CONSENTS)
    .updateOne(
      { userId: input.userId, consentType: input.consentType },
      {
        $set: {
          userId: input.userId,
          consentType: input.consentType,
          version: input.version,
          accepted: input.accepted,
          updatedAt: now
        }
      },
      { upsert: true }
    );
}

export async function listUserConsents(userId: string): Promise<Record<string, unknown>[]> {
  return getDb()
    .collection(USER_CONSENTS)
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();
}
