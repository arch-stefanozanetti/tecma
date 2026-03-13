/**
 * Lock appartamenti: una sola trattativa per appartamento può essere in uno stato con lock (soft/hard).
 * Collection tz_apartment_locks. Usato dal workflow engine in fase di transizione.
 */

import { ObjectId, type ClientSession } from "mongodb";
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_apartment_locks";

function sessionOpts(session: ClientSession | null): { session?: ClientSession } {
  return session ? { session } : {};
}

export type ApartmentLockType = "soft" | "hard";

export interface ApartmentLockRow {
  _id: string;
  workspaceId: string;
  apartmentId: string;
  requestId: string;
  type: ApartmentLockType;
  workflowStateId?: string;
  createdAt: string;
  expiresAt?: string;
}

function toLockRow(d: {
  _id: ObjectId;
  workspaceId?: string;
  apartmentId?: string;
  requestId?: string;
  type?: string;
  workflowStateId?: string;
  createdAt?: unknown;
  expiresAt?: unknown;
}): ApartmentLockRow {
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    workspaceId: d.workspaceId ?? "",
    apartmentId: d.apartmentId ?? "",
    requestId: d.requestId ?? "",
    type: d.type === "hard" ? "hard" : "soft",
    workflowStateId: d.workflowStateId,
    createdAt: typeof d.createdAt === "string" ? d.createdAt : (d.createdAt instanceof Date ? d.createdAt.toISOString() : ""),
    expiresAt: d.expiresAt == null ? undefined : (typeof d.expiresAt === "string" ? d.expiresAt : (d.expiresAt instanceof Date ? d.expiresAt.toISOString() : undefined)),
  };
}

/**
 * Restituisce il lock attivo per un appartamento (se esiste).
 * "Attivo" = nessun expiresAt o expiresAt > now.
 */
export const getActiveLockForApartment = async (apartmentId: string): Promise<{ requestId: string; type: ApartmentLockType } | null> => {
  if (!apartmentId || !ObjectId.isValid(apartmentId)) return null;
  const db = getDb();
  const now = new Date().toISOString();
  const doc = await db.collection(COLLECTION).findOne({
    apartmentId,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }],
  });
  if (!doc) return null;
  return {
    requestId: doc.requestId ?? "",
    type: doc.type === "hard" ? "hard" : "soft",
  };
};

/**
 * Crea un lock su un appartamento (da chiamare dentro transazione).
 */
export const createLock = async (
  session: ClientSession | null,
  params: {
    workspaceId: string;
    apartmentId: string;
    requestId: string;
    type: ApartmentLockType;
    workflowStateId?: string;
    expiresAt?: string;
  }
): Promise<void> => {
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const now = new Date().toISOString();
  const doc = {
    workspaceId: params.workspaceId,
    apartmentId: params.apartmentId,
    requestId: params.requestId,
    type: params.type,
    workflowStateId: params.workflowStateId,
    createdAt: now,
    expiresAt: params.expiresAt,
  };
  await coll.insertOne(doc, sessionOpts(session));
}

/**
 * Rimuove tutti i lock associati a una request (revert o uscita da stato con lock).
 */
export const removeLocksForRequest = async (session: ClientSession | null, requestId: string): Promise<number> => {
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const result = await coll.deleteMany({ requestId }, sessionOpts(session));
  return result.deletedCount ?? 0;
}

/**
 * Per lock hard: imposta a "lost" tutte le altre request sullo stesso appartamento (non terminali)
 * e rimuove i loro lock. Da chiamare dentro transazione prima di creare il nuovo lock.
 */
export const forceOtherRequestsOnApartmentToLost = async (
  session: ClientSession | null,
  params: { apartmentId: string; excludingRequestId: string; lostStatus: string; now: string }
): Promise<void> => {
  const db = getDb();
  const requestsColl = db.collection("tz_requests");
  const transitionsColl = db.collection("tz_request_transitions");
  const locksColl = db.collection(COLLECTION);
  const opts = sessionOpts(session);
  const others = await requestsColl
    .find(
      { apartmentId: params.apartmentId, _id: { $ne: new ObjectId(params.excludingRequestId) }, status: { $nin: ["won", "lost"] } },
      opts
    )
    .toArray();
  for (const r of others) {
    const rid = r._id instanceof ObjectId ? r._id.toHexString() : String(r._id);
    const prevStatus = (r.status ?? "new") as string;
    await requestsColl.updateOne({ _id: r._id }, { $set: { status: params.lostStatus, updatedAt: params.now } }, opts);
    await transitionsColl.insertOne(
      {
        requestId: rid,
        fromState: prevStatus,
        toState: params.lostStatus,
        event: "FORCED_LOST_APARTMENT_LOCKED",
        reason: "Appartamento riservato da altra trattativa",
        createdAt: params.now,
      },
      opts
    );
    await locksColl.deleteMany({ requestId: rid }, opts);
  }
}

/**
 * Aggiorna lo status dell'appartamento (es. SOLD/RENTED per lock hard).
 */
export const setApartmentStatus = async (
  session: ClientSession | null,
  apartmentId: string,
  status: string
): Promise<void> => {
  if (!apartmentId || !ObjectId.isValid(apartmentId)) return;
  const db = getDb();
  const now = new Date().toISOString();
  const coll = db.collection("tz_apartments");
  await coll.updateOne({ _id: new ObjectId(apartmentId) }, { $set: { status, updatedAt: now } }, sessionOpts(session));
}
