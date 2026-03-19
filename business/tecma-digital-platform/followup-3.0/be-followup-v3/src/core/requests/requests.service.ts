import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb, getMongoClient } from "../../config/db.js";
import { escapeRegex } from "../../utils/escapeRegex.js";

import { ListQuerySchema, type ListQueryInput, buildPagination } from "../shared/list-query.js";
import { HttpError, PaginatedResponse } from "../../types/http.js";
import {
  isTransitionAllowedForWorkspace,
  getWorkflowForWorkspaceAndType,
  getStateByCode,
} from "../workflow/workflow-engine.service.js";
import {
  getActiveLockForApartment,
  createLock,
  removeLocksForRequest,
  forceOtherRequestsOnApartmentToLost,
  setApartmentStatus,
} from "../workflow/apartment-lock.service.js";
import { createContract } from "../contracts/contracts.service.js";
import { setInventoryStatus } from "../inventory/inventory.service.js";
import { dispatchEvent } from "../automations/automation-events.service.js";
import { logger } from "../../observability/logger.js";

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
  /** Workflow usato (opzionale; da migrazione o creazione). */
  workflowId?: string;
  /** Stato corrente come riferimento a WorkflowState (opzionale). */
  currentStateId?: string;
  /** Ruolo cliente: acquirente/venditore/affittuario/cedente (compravendita). */
  clientRole?: ClientRole;
  createdAt: string;
  updatedAt: string;
  clientName?: string;
  apartmentCode?: string;
  /** Riferimento quote su main DB. */
  quoteId?: string;
  /** Snapshot quote persistito in richiesta. */
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
    const raw = q.searchText.trim();
    const safe = escapeRegex(raw);
    const orConditions: Record<string, unknown>[] = [
      { clientId: { $regex: safe, $options: "i" } }
    ];
    if (ObjectId.isValid(raw)) {
      orConditions.push({ _id: new ObjectId(raw) });
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
  workflowId: doc.workflowId != null ? String(doc.workflowId) : undefined,
  currentStateId: doc.currentStateId != null ? String(doc.currentStateId) : undefined,
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
    const clientsColl = db.collection("tz_clients");
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
      const apartmentsColl = db.collection("tz_apartments");
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
    const client = await db.collection("tz_clients").findOne(
      { _id: new ObjectId(row.clientId) },
      { projection: { fullName: 1 } }
    );
    if (client && typeof (client as unknown as { fullName?: string }).fullName === "string") {
      clientName = (client as unknown as { fullName: string }).fullName.trim() || row.clientId;
    }
  }
  if (row.apartmentId && ObjectId.isValid(row.apartmentId)) {
    const apt = await db.collection("tz_apartments").findOne(
      { _id: new ObjectId(row.apartmentId) },
      { projection: { code: 1 } }
    );
    if (apt && typeof (apt as unknown as { code?: string }).code === "string") {
      apartmentCode = (apt as unknown as { code: string }).code;
    }
  }
  return {
    request: {
      ...row,
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
  const workspaceId = typeof doc.workspaceId === "string" ? doc.workspaceId : "";
  const requestType = (doc.type === "rent" || doc.type === "sell" ? doc.type : "sell") as "rent" | "sell";
  const allowedByWorkflow = await isTransitionAllowedForWorkspace(workspaceId, requestType, currentStatus, newStatus);
  if (allowedByWorkflow === false) {
    throw new HttpError(
      `Transizione non consentita: da "${currentStatus}" a "${newStatus}"`,
      400
    );
  }
  if (allowedByWorkflow !== true) {
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(newStatus)) {
      throw new HttpError(
        `Transizione non consentita: da "${currentStatus}" a "${newStatus}"`,
        400
      );
    }
  }

  const workflowDetail = await getWorkflowForWorkspaceAndType(workspaceId, requestType);
  const targetState = workflowDetail ? getStateByCode(workflowDetail, newStatus) : null;
  const apartmentId = typeof doc.apartmentId === "string" && doc.apartmentId ? doc.apartmentId : undefined;

  if (targetState && (targetState.apartmentLock === "soft" || targetState.apartmentLock === "hard") && apartmentId) {
    const activeLock = await getActiveLockForApartment(apartmentId);
    if (activeLock && activeLock.requestId !== id) {
      throw new HttpError("Appartamento già in uso da un'altra trattativa", 409);
    }
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    status: newStatus,
    updatedAt: now,
  };
  if (workflowDetail && targetState) {
    update.workflowId = workflowDetail.workflow._id;
    update.currentStateId = targetState._id;
  }
  if (body.reason !== undefined && body.reason.trim() !== "") {
    update.statusChangeReason = body.reason.trim();
    update.statusChangedAt = now;
  }
  if (newStatus === "quote" && body.quoteId && ObjectId.isValid(body.quoteId)) {
    update.quoteId = body.quoteId;
  }

  const client = getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await collection.updateOne({ _id }, { $set: update }, { session });
      const transitionsColl = db.collection(TRANSITIONS_COLLECTION);
      await transitionsColl.insertOne(
        {
          requestId: id,
          fromState: currentStatus,
          toState: newStatus,
          event: `TRANSITION_TO_${newStatus.toUpperCase()}`,
          reason: body.reason?.trim() || undefined,
          userId: options?.userId,
          createdAt: now,
        },
        { session }
      );
      await removeLocksForRequest(session, id);
      if (targetState && (targetState.apartmentLock === "soft" || targetState.apartmentLock === "hard") && apartmentId) {
        if (targetState.apartmentLock === "hard") {
          await forceOtherRequestsOnApartmentToLost(session, {
            apartmentId,
            excludingRequestId: id,
            lostStatus: "lost",
            now,
          });
          await setApartmentStatus(session, apartmentId, requestType === "sell" ? "SOLD" : "RENTED");
          await createContract({ requestId: id, unitId: apartmentId, workspaceId, contractType: requestType });
          await setInventoryStatus(apartmentId, workspaceId, requestType === "sell" ? "sold" : "reserved");
        }
        await createLock(session, {
          workspaceId,
          apartmentId,
          requestId: id,
          type: targetState.apartmentLock === "hard" ? "hard" : "soft",
          workflowStateId: targetState._id,
        });
      }
    });
  } finally {
    await session.endSession();
  }

  const projectId = typeof doc.projectId === "string" ? doc.projectId : "";
  const clientId = typeof doc.clientId === "string" ? doc.clientId : "";
  if (newStatus === "quote" || newStatus === "offer") {
    dispatchEvent(workspaceId, "proposal.sent", {
      workspaceId,
      projectId,
      entityType: "request",
      entityId: id,
      clientId,
      apartmentId,
      toStatus: newStatus,
    }).catch((err) => logger.error({ err }, "[requests] dispatch proposal.sent failed"));
  }
  if (newStatus === "won") {
    dispatchEvent(workspaceId, "contract.signed", {
      workspaceId,
      projectId,
      entityType: "request",
      entityId: id,
      clientId,
      apartmentId,
      toStatus: newStatus,
    }).catch((err) => logger.error({ err }, "[requests] dispatch contract.signed failed"));
  }

  return getRequestById(id);
};

/** Singola transizione di stato (record in tz_request_transitions). */
export interface RequestTransitionRow {
  _id: string;
  requestId: string;
  fromState: RequestStatus;
  toState: RequestStatus;
  event: string;
  reason?: string;
  userId?: string;
  createdAt: string;
}

/**
 * Lista le transizioni di stato di una trattativa (per timeline).
 * Ordine: dalla più recente alla più vecchia.
 */
export const listRequestTransitions = async (
  rawRequestId: unknown
): Promise<{ transitions: RequestTransitionRow[] }> => {
  const requestId = typeof rawRequestId === "string" ? rawRequestId : String(rawRequestId);
  if (!ObjectId.isValid(requestId)) {
    throw new HttpError("Request not found", 404);
  }
  const db = getDb();
  const coll = db.collection(TRANSITIONS_COLLECTION);
  const cursor = coll
    .find({ requestId })
    .sort({ createdAt: -1 });
  const docs = await cursor.toArray();
  type TransitionDoc = { _id?: unknown; requestId?: string; fromState?: string; toState?: string; event?: string; reason?: string; userId?: string; createdAt?: Date | string };
  const transitions: RequestTransitionRow[] = (docs as TransitionDoc[]).map((d) => ({
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    requestId: d.requestId ?? requestId,
    fromState: (d.fromState ?? "new") as RequestStatus,
    toState: (d.toState ?? "new") as RequestStatus,
    event: d.event ?? "",
    reason: d.reason,
    userId: d.userId,
    createdAt: typeof d.createdAt === "string" ? d.createdAt : (d.createdAt instanceof Date ? d.createdAt.toISOString() : ""),
  }));
  return { transitions };
};

/**
 * Revert dello stato di una trattativa allo stato precedente (fromState della transizione indicata).
 * Consentito solo se lo stato attuale della richiesta coincide con toState della transizione.
 */
export const revertRequestStatus = async (
  rawRequestId: unknown,
  rawTransitionId: unknown,
  options?: { userId?: string }
): Promise<{ request: RequestRow }> => {
  const requestId = typeof rawRequestId === "string" ? rawRequestId : String(rawRequestId);
  const transitionId = typeof rawTransitionId === "string" ? rawTransitionId : String(rawTransitionId);
  if (!ObjectId.isValid(requestId)) {
    throw new HttpError("Request not found", 404);
  }
  if (!ObjectId.isValid(transitionId)) {
    throw new HttpError("Transition not found", 404);
  }
  const db = getDb();
  const requestsColl = db.collection(COLLECTION_NAME);
  const transitionsColl = db.collection(TRANSITIONS_COLLECTION);

  const requestDoc = await requestsColl.findOne({ _id: new ObjectId(requestId) });
  if (!requestDoc) {
    throw new HttpError("Request not found", 404);
  }
  const currentStatus = (typeof requestDoc.status === "string" && requestDoc.status
    ? requestDoc.status
    : "new") as RequestStatus;

  const transitionDoc = await transitionsColl.findOne({
    _id: new ObjectId(transitionId),
    requestId,
  });
  if (!transitionDoc) {
    throw new HttpError("Transizione non trovata", 404);
  }
  const fromState = (transitionDoc.fromState ?? "new") as RequestStatus;
  const toState = (transitionDoc.toState ?? "new") as RequestStatus;

  if (toState !== currentStatus) {
    throw new HttpError(
      `Revert non consentito: lo stato attuale è "${currentStatus}", la transizione selezionata porta a "${toState}".`,
      400
    );
  }

  const workspaceId = typeof requestDoc.workspaceId === "string" ? requestDoc.workspaceId : "";
  const requestType = (requestDoc.type === "rent" || requestDoc.type === "sell" ? requestDoc.type : "sell") as "rent" | "sell";
  const workflowDetail = await getWorkflowForWorkspaceAndType(workspaceId, requestType);
  const fromStateRow = workflowDetail ? getStateByCode(workflowDetail, fromState) : null;
  if (workflowDetail && fromStateRow && !fromStateRow.reversible) {
    throw new HttpError(
      "Revert non consentito: lo stato di destinazione non è reversibile.",
      400
    );
  }
  const now = new Date().toISOString();
  const revertUpdate: Record<string, unknown> = { status: fromState, updatedAt: now };
  if (workflowDetail && fromStateRow) {
    revertUpdate.workflowId = workflowDetail.workflow._id;
    revertUpdate.currentStateId = fromStateRow._id;
  }
  const client = getMongoClient();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await requestsColl.updateOne(
        { _id: new ObjectId(requestId) },
        { $set: revertUpdate },
        { session }
      );
      await transitionsColl.insertOne(
        {
          requestId,
          fromState: currentStatus,
          toState: fromState,
          event: "REVERT",
          reason: `Ripristino a stato "${fromState}"`,
          userId: options?.userId,
          createdAt: now,
        },
        { session }
      );
      await removeLocksForRequest(session, requestId);
    });
  } finally {
    await session.endSession();
  }

  return getRequestById(requestId);
};
