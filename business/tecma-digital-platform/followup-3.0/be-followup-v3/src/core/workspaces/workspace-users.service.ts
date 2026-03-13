/**
 * Utenti per workspace: membership in tz_user_workspaces.
 * Ruoli: vendor | vendor_manager | admin.
 * userId = email (string) per Fase 1; in futuro si può risolvere a id utente.
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_user_workspaces";

let indexEnsured = false;
async function ensureUniqueIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = getDb();
  await db.collection(COLLECTION).createIndex({ workspaceId: 1, userId: 1 }, { unique: true });
  indexEnsured = true;
}

export type WorkspaceUserRole = "vendor" | "vendor_manager" | "admin";

const ROLES: WorkspaceUserRole[] = ["vendor", "vendor_manager", "admin"];

export interface WorkspaceUserRow {
  _id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceUserRole;
  createdAt: string;
  updatedAt: string;
}

function toRow(d: {
  _id: ObjectId;
  workspaceId?: string;
  userId?: string;
  role?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}): WorkspaceUserRow {
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    workspaceId: d.workspaceId ?? "",
    userId: d.userId ?? "",
    role: ROLES.includes((d.role as WorkspaceUserRole)) ? (d.role as WorkspaceUserRole) : "vendor",
    createdAt: typeof d.createdAt === "string" ? d.createdAt : (d.createdAt instanceof Date ? d.createdAt.toISOString() : ""),
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : (d.updatedAt instanceof Date ? d.updatedAt.toISOString() : ""),
  };
}

/** Restituisce gli id dei workspace in cui l'utente (email) ha membership. Usato per filtrare la lista workspace. */
export const listWorkspaceIdsForUser = async (userId: string): Promise<string[]> => {
  const uid = userId.trim().toLowerCase();
  if (!uid) return [];
  await ensureUniqueIndex();
  const db = getDb();
  const docs = await db.collection(COLLECTION).find({ userId: uid }).project({ workspaceId: 1 }).toArray();
  return (docs as { workspaceId?: string }[]).map((d) => d.workspaceId).filter((id): id is string => typeof id === "string" && id.length > 0);
};

export const listWorkspaceUsers = async (workspaceId: string): Promise<{ data: WorkspaceUserRow[] }> => {
  if (!workspaceId) return { data: [] };
  await ensureUniqueIndex();
  const db = getDb();
  const docs = await db.collection(COLLECTION).find({ workspaceId }).sort({ userId: 1 }).toArray();
  const data = docs.map((d: Record<string, unknown>) => toRow(d as Parameters<typeof toRow>[0]));
  return { data };
};

export const addWorkspaceUser = async (
  workspaceId: string,
  body: { userId: string; role: WorkspaceUserRole }
): Promise<{ workspaceUser: WorkspaceUserRow }> => {
  const userId = typeof body.userId === "string" ? body.userId.trim().toLowerCase() : "";
  const role = ROLES.includes(body.role) ? body.role : "vendor";
  if (!userId) throw new HttpError("userId (email) obbligatorio", 400);
  if (!workspaceId) throw new HttpError("workspaceId obbligatorio", 400);

  await ensureUniqueIndex();
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const existing = await coll.findOne({ workspaceId, userId });
  if (existing) throw new HttpError("Utente già presente in questo workspace", 409);

  const now = new Date().toISOString();
  const doc = { workspaceId, userId, role, createdAt: now, updatedAt: now };
  const res = await coll.insertOne(doc);
  const row = toRow({ _id: res.insertedId, ...doc });
  return { workspaceUser: row };
};

export const updateWorkspaceUser = async (
  workspaceId: string,
  userId: string,
  body: { role?: WorkspaceUserRole }
): Promise<{ workspaceUser: WorkspaceUserRow }> => {
  const uid = userId.trim().toLowerCase();
  if (!uid) throw new HttpError("userId obbligatorio", 400);
  if (!workspaceId) throw new HttpError("workspaceId obbligatorio", 400);
  const role = body.role != null && ROLES.includes(body.role) ? body.role : undefined;
  if (role === undefined) throw new HttpError("role obbligatorio per l'aggiornamento", 400);

  const db = getDb();
  const coll = db.collection(COLLECTION);
  const now = new Date().toISOString();
  const result = await coll.findOneAndUpdate(
    { workspaceId, userId: uid },
    { $set: { role, updatedAt: now } },
    { returnDocument: "after" }
  );
  if (!result || !result._id) throw new HttpError("Utente non trovato in questo workspace", 404);
  const row = toRow(result as unknown as Parameters<typeof toRow>[0]);
  return { workspaceUser: row };
};

export const removeWorkspaceUser = async (workspaceId: string, userId: string): Promise<{ deleted: boolean }> => {
  const uid = userId.trim().toLowerCase();
  if (!uid) throw new HttpError("userId obbligatorio", 400);
  if (!workspaceId) throw new HttpError("workspaceId obbligatorio", 400);

  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ workspaceId, userId: uid });
  return { deleted: (result.deletedCount ?? 0) > 0 };
};
