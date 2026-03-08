import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb, getDbByName } from "../../config/db.js";

const LEGACY_DB_ASSET = "asset";
import { ListQuerySchema, type ListQueryInput, buildPagination } from "../shared/list-query.js";
import { HttpError, PaginatedResponse } from "../../types/http.js";

/** Ruolo del cliente rispetto all'immobile (compravendita: venditore vs acquirente). */
export type ClientRole = "buyer" | "seller" | "tenant" | "landlord";

const RequestCreateSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  clientId: z.string().min(1),
  apartmentId: z.string().optional(),
  type: z.enum(["rent", "sell"]),
  status: z.enum(["new", "contacted", "viewing", "quote", "offer", "won", "lost"]).optional().default("new"),
  clientRole: z.enum(["buyer", "seller", "tenant", "landlord"]).optional(),
  quoteId: z.string().optional(),
});

/** Request/Deal type: rent or sell. */
export type RequestType = "rent" | "sell";

/** Status of a request/deal (unified rent + sell). */
export type RequestStatus =
  | "new"
  | "contacted"
  | "viewing"
  | "quote"
  | "offer"
  | "won"
  | "lost";

/** Allowed state transitions (macchina a stati in-process; sostituibile con be-tecma-status-automata). */
const ALLOWED_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  new: ["contacted", "viewing", "lost"],
  contacted: ["viewing", "quote", "offer", "lost"],
  viewing: ["quote", "offer", "contacted", "lost"],
  quote: ["offer", "viewing", "lost"],
  offer: ["won", "lost", "viewing", "quote"],
  won: [],
  lost: [],
};

/** Single request/deal row as returned by query and getById. */
export interface RequestRow {
  _id: string;
  projectId: string;
  workspaceId: string;
  clientId: string;
  apartmentId?: string;
  type: RequestType;
  status: RequestStatus;
  /** Ruolo cliente: acquirente/venditore/affittuario/cedente (compravendita). */
  clientRole?: ClientRole;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  apartmentCode?: string;
  /** Riferimento a asset.quotes (legacy). */
  quoteId?: string;
  /** Snapshot da asset.quotes. */
  quoteStatus?: string;
  quoteNumber?: string;
  quoteExpiryOn?: string;
  quoteTotalPrice?: number;
}

const COLLECTION_NAME = "tz_requests";
const TRANSITIONS_COLLECTION = "tz_request_transitions";

const sortable: Record<string, 1> = {
  projectId: 1,
  clientId: 1,
  type: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1
};

const buildMatch = (q: ListQueryInput) => {
  const conditions: Record<string, unknown>[] = [
    { workspaceId: q.workspaceId },
    { projectId: { $in: q.projectIds } }
  ];

  const status = q.filters?.status;
  if (Array.isArray(status) && status.length > 0) {
    conditions.push({ status: { $in: status } });
  }

  const type = q.filters?.type;
  if (Array.isArray(type) && type.length > 0) {
    conditions.push({ type: { $in: type } });
  }

  const clientId = q.filters?.clientId;
  if (typeof clientId === "string" && clientId.trim()) {
    conditions.push({ clientId: clientId.trim() });
  }

  const apartmentId = q.filters?.apartmentId;
  if (typeof apartmentId === "string" && apartmentId.trim() && ObjectId.isValid(apartmentId)) {
    conditions.push({ apartmentId: apartmentId.trim() });
  }

  if (q.searchText && q.searchText.trim()) {
    const safe = q.searchText.trim();
    const orConditions: Record<string, unknown>[] = [
      { clientId: { $regex: safe, $options: "i" } }
    ];
    if (ObjectId.isValid(safe)) {
      orConditions.push({ _id: new ObjectId(safe) });
    }
    conditions.push({ $or: orConditions });
  }

  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
};

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

/** Legge dati quote da asset.quotes (legacy). Ritorna undefined se non trovata o DB non disponibile. */
const fetchQuoteFromLegacy = async (quoteId: string): Promise<{
  status?: string;
  quoteNumber?: string;
  expiryOn?: string;
  totalPrice?: number;
} | null> => {
  if (!ObjectId.isValid(quoteId)) return null;
  try {
    const assetDb = getDbByName(LEGACY_DB_ASSET);
    const quote = await assetDb.collection("quotes").findOne(
      { _id: new ObjectId(quoteId) },
      { projection: { status: 1, quoteNumber: 1, expiryOn: 1, "customQuote.totalPrice": 1 } }
    );
    if (!quote) return null;
    const q = quote as Record<string, unknown>;
    const customQuote = q.customQuote as Record<string, unknown> | undefined;
    return {
      status: typeof q.status === "string" ? q.status : undefined,
      quoteNumber: typeof q.quoteNumber === "string" ? q.quoteNumber : undefined,
      expiryOn: q.expiryOn != null ? toIsoDate(q.expiryOn) : undefined,
      totalPrice: typeof customQuote?.totalPrice === "number" ? customQuote.totalPrice : undefined,
    };
  } catch {
    return null;
  }
};

const CLIENT_ROLES = ["buyer", "seller", "tenant", "landlord"] as const;

const mapDocToRow = (doc: Record<string, unknown>): RequestRow => ({
  _id: String(doc._id ?? ""),
  projectId: String(doc.projectId ?? ""),
  workspaceId: String(doc.workspaceId ?? ""),
  clientId: String(doc.clientId ?? ""),
  apartmentId: doc.apartmentId != null ? String(doc.apartmentId) : undefined,
  type: (doc.type === "rent" || doc.type === "sell" ? doc.type : "rent") as RequestType,
  status: (typeof doc.status === "string" &&
  ["new", "contacted", "viewing", "quote", "offer", "won", "lost"].includes(doc.status)
    ? doc.status
    : "new") as RequestStatus,
  clientRole: typeof doc.clientRole === "string" && CLIENT_ROLES.includes(doc.clientRole as (typeof CLIENT_ROLES)[number])
    ? (doc.clientRole as ClientRole)
    : undefined,
  createdAt: toIsoDate(doc.createdAt),
  updatedAt: toIsoDate(doc.updatedAt),
  quoteId: doc.quoteId != null ? String(doc.quoteId) : undefined,
  quoteStatus: typeof doc.quoteStatus === "string" ? doc.quoteStatus : undefined,
  quoteNumber: typeof doc.quoteNumber === "string" ? doc.quoteNumber : undefined,
  quoteExpiryOn: doc.quoteExpiryOn != null ? toIsoDate(doc.quoteExpiryOn) : undefined,
  quoteTotalPrice: typeof doc.quoteTotalPrice === "number" ? doc.quoteTotalPrice : undefined,
});

/**
 * Query requests/deals with ListQuery contract (workspaceId, projectIds, pagination, filters, search).
 * Returns empty data if collection is empty or no matches.
 */
export const queryRequests = async (
  rawInput: unknown
): Promise<PaginatedResponse<RequestRow>> => {
  const input = ListQuerySchema.parse(rawInput);
  const db = getDb();
  const collection = db.collection(COLLECTION_NAME);

  const match = buildMatch(input);
  const { page, perPage } = input;
  const { skip, limit } = buildPagination(page, perPage);
  const sortField =
    input.sort?.field && sortable[input.sort.field] ? input.sort.field : "updatedAt";
  const sortDirection = input.sort?.direction ?? -1;

  const [rawData, total] = await Promise.all([
    collection
      .find(match)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(match)
  ]);

  const rows: RequestRow[] = rawData.map((doc) =>
    mapDocToRow(doc as Record<string, unknown>)
  );

  // Arricchimento: clientName da clients, apartmentCode da apartments
  const clientIds = [...new Set(rows.map((r) => r.clientId).filter(Boolean))];
  const apartmentIds = [...new Set(rows.map((r) => r.apartmentId).filter(Boolean))] as string[];
  const clientIdToName: Record<string, string> = {};
  const apartmentIdToCode: Record<string, string> = {};

  if (clientIds.length > 0) {
    const clientsColl = db.collection("clients");
    const clientObjectIds = clientIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (clientObjectIds.length > 0) {
      const clients = await clientsColl
        .find({ _id: { $in: clientObjectIds } })
        .project({ _id: 1, fullName: 1 })
        .toArray();
      for (const c of clients) {
        const id = (c._id as ObjectId).toHexString();
        clientIdToName[id] = typeof c.fullName === "string" && c.fullName.trim() ? c.fullName : id;
      }
    }
    for (const id of clientIds) {
      if (!clientIdToName[id]) clientIdToName[id] = id;
    }
  }

  if (apartmentIds.length > 0) {
    const aptObjectIds = apartmentIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (aptObjectIds.length > 0) {
      const apartmentsColl = db.collection("apartments");
      const apartments = await apartmentsColl
        .find({ _id: { $in: aptObjectIds } })
        .project({ _id: 1, code: 1 })
        .toArray();
      for (const a of apartments) {
        const id = (a._id as ObjectId).toHexString();
        apartmentIdToCode[id] = typeof a.code === "string" ? a.code : id;
      }
    }
    for (const id of apartmentIds) {
      if (!apartmentIdToCode[id]) apartmentIdToCode[id] = id;
    }
  }

  const data: RequestRow[] = rows.map((r) => ({
    ...r,
    clientName: r.clientId ? clientIdToName[r.clientId] : undefined,
    apartmentCode: r.apartmentId ? apartmentIdToCode[r.apartmentId] : undefined,
  }));

  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage)
    }
  };
};

/**
 * Get a single request by id. Throws HttpError 404 if not found.
 * Enriches with clientName and apartmentCode when available.
 */
export const getRequestById = async (rawId: unknown): Promise<{ request: RequestRow }> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) {
    throw new HttpError("Request not found", 404);
  }
  const db = getDb();
  const collection = db.collection(COLLECTION_NAME);
  const doc = await collection.findOne({ _id: new ObjectId(id) });
  if (!doc) {
    throw new HttpError("Request not found", 404);
  }
  const row = mapDocToRow(doc as unknown as Record<string, unknown>);
  let clientName: string | undefined;
  let apartmentCode: string | undefined;
  if (row.clientId && ObjectId.isValid(row.clientId)) {
    const client = await db.collection("clients").findOne(
      { _id: new ObjectId(row.clientId) },
      { projection: { fullName: 1 } }
    );
    if (client && typeof (client as unknown as { fullName?: string }).fullName === "string") {
      clientName = (client as unknown as { fullName: string }).fullName.trim() || row.clientId;
    }
  }
  if (row.apartmentId && ObjectId.isValid(row.apartmentId)) {
    const apt = await db.collection("apartments").findOne(
      { _id: new ObjectId(row.apartmentId) },
      { projection: { code: 1 } }
    );
    if (apt && typeof (apt as unknown as { code?: string }).code === "string") {
      apartmentCode = (apt as unknown as { code: string }).code;
    }
  }
  let quoteData: Partial<RequestRow> = {};
  if (row.quoteId) {
    const legacy = await fetchQuoteFromLegacy(row.quoteId);
    if (legacy) {
      quoteData = {
        quoteStatus: legacy.status ?? row.quoteStatus,
        quoteNumber: legacy.quoteNumber ?? row.quoteNumber,
        quoteExpiryOn: legacy.expiryOn ?? row.quoteExpiryOn,
        quoteTotalPrice: legacy.totalPrice ?? row.quoteTotalPrice,
      };
    }
  }
  return {
    request: {
      ...row,
      ...quoteData,
      clientName: clientName ?? row.clientId,
      apartmentCode: apartmentCode ?? row.apartmentId,
    },
  };
};

/**
 * Create a new request/deal. Returns the created request (enriched with clientName/apartmentCode when available).
 */
export const createRequest = async (rawInput: unknown): Promise<{ request: RequestRow }> => {
  const input = RequestCreateSchema.parse(rawInput);
  const db = getDb();
  const collection = db.collection(COLLECTION_NAME);
  const now = new Date().toISOString();
  const doc: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    clientId: input.clientId,
    apartmentId: input.apartmentId ?? null,
    type: input.type,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };
  if (input.clientRole != null) doc.clientRole = input.clientRole;
  if (input.quoteId && ObjectId.isValid(input.quoteId)) {
    doc.quoteId = input.quoteId;
    const legacy = await fetchQuoteFromLegacy(input.quoteId);
    if (legacy) {
      doc.quoteStatus = legacy.status;
      doc.quoteNumber = legacy.quoteNumber;
      doc.quoteExpiryOn = legacy.expiryOn;
      doc.quoteTotalPrice = legacy.totalPrice;
    }
  }
  const result = await collection.insertOne(doc);
  const _id = result.insertedId.toHexString();
  const row: RequestRow = {
    _id,
    projectId: input.projectId,
    workspaceId: input.workspaceId,
    clientId: input.clientId,
    apartmentId: input.apartmentId,
    type: input.type as RequestType,
    status: (input.status ?? "new") as RequestStatus,
    clientRole: input.clientRole as ClientRole | undefined,
    createdAt: now,
    updatedAt: now,
  };
  const enriched = await getRequestById(_id);
  return { request: enriched.request };
};

const RequestStatusChangeSchema = z.object({
  status: z.enum(["new", "contacted", "viewing", "quote", "offer", "won", "lost"]),
  reason: z.string().max(500).optional(),
  quoteId: z.string().optional(),
});

/**
 * Update request status via allowed transitions (state machine).
 * PATCH /v1/requests/:id/status body: { status, reason? }.
 * Logs transition to tz_request_transitions.
 */
export const updateRequestStatus = async (
  rawId: unknown,
  rawBody: unknown,
  options?: { userId?: string }
): Promise<{ request: RequestRow }> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  const body = RequestStatusChangeSchema.parse(rawBody);
  const newStatus = body.status as RequestStatus;

  if (!ObjectId.isValid(id)) {
    throw new HttpError("Request not found", 404);
  }
  const db = getDb();
  const collection = db.collection(COLLECTION_NAME);
  const _id = new ObjectId(id);
  const doc = await collection.findOne({ _id });
  if (!doc) {
    throw new HttpError("Request not found", 404);
  }
  const currentStatus = (typeof doc.status === "string" && doc.status
    ? doc.status
    : "new") as RequestStatus;
  const allowed = ALLOWED_TRANSITIONS[currentStatus];
  if (!allowed || !allowed.includes(newStatus)) {
    throw new HttpError(
      `Transizione non consentita: da "${currentStatus}" a "${newStatus}"`,
      400
    );
  }
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: newStatus,
    updatedAt: now,
  };
  if (body.reason !== undefined && body.reason.trim() !== "") {
    update.statusChangeReason = body.reason.trim();
    update.statusChangedAt = now;
  }
  if (newStatus === "quote" && body.quoteId && ObjectId.isValid(body.quoteId)) {
    update.quoteId = body.quoteId;
    const legacy = await fetchQuoteFromLegacy(body.quoteId);
    if (legacy) {
      update.quoteStatus = legacy.status;
      update.quoteNumber = legacy.quoteNumber;
      update.quoteExpiryOn = legacy.expiryOn;
      update.quoteTotalPrice = legacy.totalPrice;
    }
  }
  await collection.updateOne({ _id }, { $set: update });

  const transitionsColl = db.collection(TRANSITIONS_COLLECTION);
  await transitionsColl.insertOne({
    requestId: id,
    fromState: currentStatus,
    toState: newStatus,
    event: `TRANSITION_TO_${newStatus.toUpperCase()}`,
    reason: body.reason?.trim() || undefined,
    userId: options?.userId,
    createdAt: now,
  });

  return getRequestById(id);
};
