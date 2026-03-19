import { randomUUID } from "node:crypto";
import crypto from "node:crypto";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const MAGIC_LINK_COLLECTION = "tz_magic_links";
const PORTAL_SESSION_COLLECTION = "tz_portal_sessions";
const PORTAL_DOCUMENTS_COLLECTION = "tz_portal_documents";
const PORTAL_AUDIT_COLLECTION = "tz_portal_access_audit";

const CreateMagicLinkSchema = z.object({
  workspaceId: z.string().min(1),
  clientId: z.string().min(1),
  projectIds: z.array(z.string().min(1)).min(1),
  expiresInHours: z.number().int().min(1).max(168).optional().default(48),
});

const ExchangeMagicLinkSchema = z.object({
  token: z.string().min(1),
});

const PortalSessionSchema = z.object({
  accessToken: z.string().min(1),
  filters: z.object({
    statuses: z.array(z.string().min(1)).optional(),
    documentTypes: z.array(z.enum(["quote", "document"])).optional(),
  }).optional(),
});

export interface PortalOverviewResponse {
  client: { id: string; fullName: string; email?: string; phone?: string };
  deals: Array<{ id: string; type: string; status: string; updatedAt: string; quoteNumber?: string; quoteTotalPrice?: number }>;
  documents: Array<{ id: string; title: string; type: "quote" | "document"; createdAt: string; url?: string }>;
  timeline: Array<{
    id: string;
    kind: "deal_status" | "document";
    title: string;
    status?: string;
    at: string;
    requestId?: string;
  }>;
}

const nowIso = (): string => new Date().toISOString();
const hashToken = (raw: string): string => crypto.createHash("sha256").update(raw, "utf8").digest("hex");

const logPortalAudit = async (eventType: string, payload: Record<string, unknown>): Promise<void> => {
  try {
    const db = getDb();
    await db.collection(PORTAL_AUDIT_COLLECTION).insertOne({
      eventType,
      at: nowIso(),
      ...payload,
    });
  } catch {
    // best effort
  }
};

export const createCustomerPortalMagicLink = async (rawInput: unknown): Promise<{ token: string; expiresAt: string }> => {
  const input = CreateMagicLinkSchema.parse(rawInput);
  const db = getDb();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000).toISOString();

  await db.collection(MAGIC_LINK_COLLECTION).insertOne({
    tokenHash: hashToken(token),
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    projectIds: input.projectIds,
    used: false,
    createdAt: nowIso(),
    expiresAt,
  });
  return { token, expiresAt };
};

export const exchangeCustomerPortalMagicLink = async (rawInput: unknown): Promise<{ accessToken: string; expiresAt: string }> => {
  const input = ExchangeMagicLinkSchema.parse(rawInput);
  const db = getDb();
  const tokenHash = hashToken(input.token);
  const record = await db.collection(MAGIC_LINK_COLLECTION).findOne({ tokenHash, used: false });
  if (!record) throw new HttpError("Magic link non valido", 401);
  const expiresAt = typeof record.expiresAt === "string" ? record.expiresAt : nowIso();
  if (new Date(expiresAt).getTime() < Date.now()) {
    await logPortalAudit("portal.magic_link.exchange_failed", { reason: "expired" });
    throw new HttpError("Magic link scaduto", 401);
  }

  const accessToken = randomUUID();
  const accessTokenHash = hashToken(accessToken);
  const sessionExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const workspaceId = String(record.workspaceId ?? "");
  const clientId = String(record.clientId ?? "");
  const projectIds = Array.isArray(record.projectIds) ? record.projectIds : [];
  await db.collection(PORTAL_SESSION_COLLECTION).updateMany(
    { workspaceId, clientId, revokedAt: { $exists: false } },
    { $set: { revokedAt: nowIso(), revokedReason: "new_session" } },
  );
  await db.collection(PORTAL_SESSION_COLLECTION).insertOne({
    accessTokenHash,
    workspaceId,
    clientId,
    projectIds,
    createdAt: nowIso(),
    expiresAt: sessionExpiresAt,
  });
  await db.collection(MAGIC_LINK_COLLECTION).updateOne(
    { tokenHash },
    { $set: { used: true, usedAt: nowIso() } },
  );
  await logPortalAudit("portal.magic_link.exchanged", {
    workspaceId,
    clientId,
    projectIds,
  });

  return { accessToken, expiresAt: sessionExpiresAt };
};

const loadPortalSession = async (accessToken: string) => {
  const db = getDb();
  const accessTokenHash = hashToken(accessToken);
  const session = await db.collection(PORTAL_SESSION_COLLECTION).findOne({ accessTokenHash, revokedAt: { $exists: false } });
  if (!session) throw new HttpError("Sessione portale non valida", 401);
  const expiresAt = typeof session.expiresAt === "string" ? session.expiresAt : nowIso();
  if (new Date(expiresAt).getTime() < Date.now()) throw new HttpError("Sessione portale scaduta", 401);
  return {
    workspaceId: String(session.workspaceId ?? ""),
    clientId: String(session.clientId ?? ""),
    projectIds: Array.isArray(session.projectIds) ? session.projectIds.filter((v): v is string => typeof v === "string") : [],
  };
};

export const getCustomerPortalOverview = async (rawInput: unknown): Promise<PortalOverviewResponse> => {
  const input = PortalSessionSchema.parse(rawInput);
  const session = await loadPortalSession(input.accessToken);
  const db = getDb();
  const clientsColl = db.collection("tz_clients");
  const requestsColl = db.collection("tz_requests");
  const portalDocsColl = db.collection(PORTAL_DOCUMENTS_COLLECTION);

  const clientIdFilter = ObjectId.isValid(session.clientId)
    ? ({ _id: new ObjectId(session.clientId) } as Record<string, unknown>)
    : ({ _id: session.clientId } as Record<string, unknown>);
  const clientDoc = await clientsColl.findOne(clientIdFilter);
  if (!clientDoc) throw new HttpError("Cliente non trovato", 404);

  const requestDocsRaw = await requestsColl
    .find({
      workspaceId: session.workspaceId,
      projectId: { $in: session.projectIds },
      clientId: session.clientId,
    })
    .sort({ updatedAt: -1 })
    .limit(30)
    .toArray();
  const allowedStatuses = new Set((input.filters?.statuses ?? []).filter(Boolean));
  const requestDocs =
    allowedStatuses.size === 0
      ? requestDocsRaw
      : requestDocsRaw.filter((doc) => typeof doc.status === "string" && allowedStatuses.has(doc.status));

  const manualDocs = await portalDocsColl
    .find({
      workspaceId: session.workspaceId,
      clientId: session.clientId,
      projectId: { $in: session.projectIds },
    })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray();

  const deals = requestDocs.map((doc) => ({
    id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? ""),
    type: typeof doc.type === "string" ? doc.type : "unknown",
    status: typeof doc.status === "string" ? doc.status : "unknown",
    updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : nowIso(),
    quoteNumber: typeof doc.quoteNumber === "string" ? doc.quoteNumber : undefined,
    quoteTotalPrice: typeof doc.quoteTotalPrice === "number" ? doc.quoteTotalPrice : undefined,
  }));

  const quoteDocumentsRaw = requestDocs
    .filter((doc) => typeof doc.quoteNumber === "string" || typeof doc.quoteId === "string")
    .map((doc) => ({
      id: `quote-${doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? "")}`,
      title: typeof doc.quoteNumber === "string" ? `Preventivo ${doc.quoteNumber}` : "Preventivo",
      type: "quote" as const,
      createdAt: typeof doc.updatedAt === "string" ? doc.updatedAt : nowIso(),
    }));

  const externalDocumentsRaw = manualDocs.map((doc) => ({
    id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? ""),
    title: typeof doc.title === "string" && doc.title ? doc.title : "Documento",
    type: "document" as const,
    createdAt: typeof doc.createdAt === "string" ? doc.createdAt : nowIso(),
    url: typeof doc.url === "string" ? doc.url : undefined,
  }));
  const allowedDocTypes = new Set(input.filters?.documentTypes ?? []);
  const filterDocType = allowedDocTypes.size > 0;
  const quoteDocuments = filterDocType ? quoteDocumentsRaw.filter((doc) => allowedDocTypes.has(doc.type)) : quoteDocumentsRaw;
  const externalDocuments = filterDocType ? externalDocumentsRaw.filter((doc) => allowedDocTypes.has(doc.type)) : externalDocumentsRaw;

  const requestIds = requestDocs
    .map((doc) => (doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? "")))
    .filter(Boolean);
  const transitionDocs = requestIds.length
    ? await db.collection("tz_request_transitions").find({ requestId: { $in: requestIds } }).sort({ createdAt: -1 }).limit(200).toArray()
    : [];

  const dealTimeline = transitionDocs.map((transition) => {
    const requestId = typeof transition.requestId === "string" ? transition.requestId : "";
    const toState = typeof transition.toState === "string" ? transition.toState : "unknown";
    const at = typeof transition.createdAt === "string" ? transition.createdAt : nowIso();
    return {
      id: transition._id instanceof ObjectId ? transition._id.toHexString() : `${requestId}-${at}`,
      kind: "deal_status" as const,
      title: `Stato pratica aggiornato a ${toState}`,
      status: toState,
      at,
      requestId,
    };
  });
  const documentTimeline = [...quoteDocuments, ...externalDocuments].map((doc) => ({
    id: `doc-${doc.id}`,
    kind: "document" as const,
    title: doc.title,
    at: doc.createdAt,
  }));
  const timeline = [...dealTimeline, ...documentTimeline].sort((a, b) => b.at.localeCompare(a.at));

  return {
    client: {
      id: clientDoc._id instanceof ObjectId ? clientDoc._id.toHexString() : String(clientDoc._id ?? ""),
      fullName: typeof clientDoc.fullName === "string" ? clientDoc.fullName : "Cliente",
      email: typeof clientDoc.email === "string" ? clientDoc.email : undefined,
      phone: typeof clientDoc.phone === "string" ? clientDoc.phone : undefined,
    },
    deals,
    documents: [...quoteDocuments, ...externalDocuments].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    timeline,
  };
};

export const logoutCustomerPortalSession = async (rawInput: unknown): Promise<{ ok: boolean }> => {
  const input = PortalSessionSchema.parse(rawInput);
  const db = getDb();
  const accessTokenHash = hashToken(input.accessToken);
  await db.collection(PORTAL_SESSION_COLLECTION).updateOne(
    { accessTokenHash },
    { $set: { revokedAt: nowIso(), revokedReason: "logout" } },
  );
  await logPortalAudit("portal.session.logout", {});
  return { ok: true };
};
