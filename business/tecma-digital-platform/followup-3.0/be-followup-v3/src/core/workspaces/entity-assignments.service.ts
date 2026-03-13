/**
 * Assegnazioni entità (cliente/appartamento) a utente nel workspace (tz_entity_assignments).
 * Un'entità può essere assegnata a un solo utente per workspace (upsert su assegnazione).
 */
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_entity_assignments";
const VALID_ENTITY_TYPES = ["client", "apartment"] as const;

let indexEnsured = false;
async function ensureIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = getDb();
  await db.collection(COLLECTION).createIndex(
    { workspaceId: 1, entityType: 1, entityId: 1 },
    { unique: true }
  );
  await db.collection(COLLECTION).createIndex({ workspaceId: 1, userId: 1 });
  indexEnsured = true;
}

function normalizeEntityType(entityType: string): "client" | "apartment" | null {
  const t = entityType?.toLowerCase();
  return VALID_ENTITY_TYPES.includes(t as "client" | "apartment") ? (t as "client" | "apartment") : null;
}

export interface EntityAssignmentRow {
  _id: string;
  workspaceId: string;
  entityType: "client" | "apartment";
  entityId: string;
  userId: string;
  createdAt?: string;
}

export const listEntityAssignments = async (
  workspaceId: string,
  entityType: string,
  entityId: string
): Promise<{ data: EntityAssignmentRow[] }> => {
  const type = normalizeEntityType(entityType);
  const eid = (entityId ?? "").trim();
  if (!workspaceId.trim() || !type || !eid) return { data: [] };
  await ensureIndex();
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ workspaceId, entityType: type, entityId: eid })
    .toArray();
  const data = (docs as unknown as (EntityAssignmentRow & { _id?: unknown })[]).map((d) => ({
    _id: String(d._id ?? ""),
    workspaceId: d.workspaceId,
    entityType: d.entityType,
    entityId: d.entityId,
    userId: d.userId,
    createdAt: d.createdAt,
  }));
  return { data };
};

export const listEntityAssignmentsByUser = async (
  workspaceId: string,
  userId: string
): Promise<{ data: EntityAssignmentRow[] }> => {
  const uid = (userId ?? "").trim().toLowerCase();
  if (!workspaceId.trim() || !uid) return { data: [] };
  await ensureIndex();
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ workspaceId, userId: uid })
    .toArray();
  const data = (docs as unknown as (EntityAssignmentRow & { _id?: unknown })[]).map((d) => ({
    _id: String(d._id ?? ""),
    workspaceId: d.workspaceId,
    entityType: d.entityType,
    entityId: d.entityId,
    userId: d.userId,
    createdAt: d.createdAt,
  }));
  return { data };
};

export const assignEntity = async (
  workspaceId: string,
  entityType: string,
  entityId: string,
  userId: string
): Promise<{ assignment: EntityAssignmentRow }> => {
  const type = normalizeEntityType(entityType);
  const eid = (entityId ?? "").trim();
  const uid = (userId ?? "").trim().toLowerCase();
  if (!workspaceId.trim() || !type || !eid || !uid) {
    throw new HttpError("workspaceId, entityType, entityId e userId obbligatori", 400);
  }
  await ensureIndex();
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const now = new Date().toISOString();
  const doc = { workspaceId, entityType: type, entityId: eid, userId: uid, createdAt: now };
  const res = await coll.findOneAndUpdate(
    { workspaceId, entityType: type, entityId: eid },
    { $set: { ...doc, updatedAt: now } },
    { upsert: true, returnDocument: "after" }
  );
  const out = res as (EntityAssignmentRow & { _id?: unknown }) | null;
  if (!out) throw new HttpError("Assegnazione non creata", 500);
  return {
    assignment: {
      _id: String(out._id ?? ""),
      workspaceId: out.workspaceId,
      entityType: out.entityType,
      entityId: out.entityId,
      userId: out.userId,
      createdAt: out.createdAt,
    },
  };
};

export const unassignEntity = async (
  workspaceId: string,
  entityType: string,
  entityId: string,
  userId: string
): Promise<{ deleted: boolean }> => {
  const type = normalizeEntityType(entityType);
  const eid = (entityId ?? "").trim();
  const uid = (userId ?? "").trim().toLowerCase();
  if (!workspaceId.trim() || !type || !eid || !uid) {
    throw new HttpError("workspaceId, entityType, entityId e userId obbligatori", 400);
  }
  const db = getDb();
  const result = await db
    .collection(COLLECTION)
    .deleteOne({ workspaceId, entityType: type, entityId: eid, userId: uid });
  return { deleted: (result.deletedCount ?? 0) > 0 };
};
