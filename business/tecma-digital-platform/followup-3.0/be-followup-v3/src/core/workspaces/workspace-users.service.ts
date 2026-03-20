/**
 * Utenti per workspace: membership in tz_user_workspaces.
 * Ruoli fissi (spec): owner | admin | collaborator | viewer.
 * access_scope: "all" | "assigned" (in UI: toggle Tutto / Solo assegnati).
 * userId = email (string) per Fase 1; in futuro ObjectId hex da tz_users.
 */
import { MongoServerError, ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";
import { HttpError } from "../../types/http.js";
import type { MembershipRole, AccessScope } from "../../types/models.js";

const COLLECTION = "tz_user_workspaces";

let indexEnsured = false;
async function ensureUniqueIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = getDb();
  try {
    await db.collection(COLLECTION).createIndex({ workspaceId: 1, userId: 1 }, { unique: true });
  } catch (err) {
    if (err instanceof MongoServerError && (err.code === 85 || err.code === 86)) {
      logger.warn({ err, code: err.code }, "[workspace-users] createIndex conflict, continuing");
    } else {
      throw err;
    }
  }
  indexEnsured = true;
}

/** Ruoli fissi (spec): solo questi quattro. In scrittura si accetta solo MembershipRole. */
export type WorkspaceUserRole = MembershipRole;

const ROLES_SPEC: MembershipRole[] = ["owner", "admin", "collaborator", "viewer"];

function isSpecRole(r: string): r is MembershipRole {
  return ROLES_SPEC.includes(r as MembershipRole);
}

/** Mappa ruolo da DB a ruolo spec (legacy vendor → collaborator, vendor_manager → admin). */
function normalizeRoleToSpec(r: string | undefined): MembershipRole {
  if (!r) return "collaborator";
  const lower = r.toLowerCase();
  if (isSpecRole(lower)) return lower;
  if (lower === "vendor") return "collaborator";
  if (lower === "vendor_manager") return "admin";
  return "collaborator";
}

export type { AccessScope };

export interface WorkspaceUserRow {
  _id: string;
  workspaceId: string;
  userId: string;
  role: MembershipRole;
  access_scope: AccessScope;
  createdAt: string;
  updatedAt: string;
}

function toRow(d: {
  _id: ObjectId;
  workspaceId?: string;
  userId?: string;
  role?: string;
  access_scope?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}): WorkspaceUserRow {
  const scope = d.access_scope === "assigned" ? "assigned" : "all";
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    workspaceId: d.workspaceId ?? "",
    userId: d.userId ?? "",
    role: normalizeRoleToSpec(d.role),
    access_scope: scope,
    createdAt: typeof d.createdAt === "string" ? d.createdAt : (d.createdAt instanceof Date ? d.createdAt.toISOString() : ""),
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : (d.updatedAt instanceof Date ? d.updatedAt.toISOString() : ""),
  };
}

/** Restituisce le membership workspace dell'utente (userId = email). Usato per derivare permessi JWT. */
export const listWorkspaceMembershipsForUser = async (
  userId: string
): Promise<{ workspaceId: string; role: WorkspaceUserRole }[]> => {
  const uid = userId.trim().toLowerCase();
  if (!uid) return [];
  await ensureUniqueIndex();
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ userId: uid })
    .project({ workspaceId: 1, role: 1 })
    .toArray();
  return (docs as { workspaceId?: string; role?: string }[])
    .filter((d) => typeof d.workspaceId === "string")
    .map((d) => ({
      workspaceId: d.workspaceId!,
      role: normalizeRoleToSpec(d.role)
    }));
};

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
  body: { userId: string; role: MembershipRole; access_scope?: AccessScope }
): Promise<{ workspaceUser: WorkspaceUserRow }> => {
  const userId = typeof body.userId === "string" ? body.userId.trim().toLowerCase() : "";
  const role = isSpecRole(body.role) ? body.role : "collaborator";
  const access_scope = body.access_scope === "assigned" ? "assigned" : "all";
  if (!userId) throw new HttpError("userId (email) obbligatorio", 400);
  if (!workspaceId) throw new HttpError("workspaceId obbligatorio", 400);
  if (body.role && !isSpecRole(body.role)) throw new HttpError("Ruolo non valido: usare owner, admin, collaborator o viewer", 400);

  await ensureUniqueIndex();
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const existing = await coll.findOne({ workspaceId, userId });
  if (existing) throw new HttpError("Utente già presente in questo workspace", 409);

  const now = new Date().toISOString();
  const doc = { workspaceId, userId, role, access_scope, createdAt: now, updatedAt: now };
  const res = await coll.insertOne(doc);
  const row = toRow({ _id: res.insertedId, ...doc });
  return { workspaceUser: row };
};

export const updateWorkspaceUser = async (
  workspaceId: string,
  userId: string,
  body: { role?: MembershipRole; access_scope?: AccessScope }
): Promise<{ workspaceUser: WorkspaceUserRow }> => {
  const uid = userId.trim().toLowerCase();
  if (!uid) throw new HttpError("userId obbligatorio", 400);
  if (!workspaceId) throw new HttpError("workspaceId obbligatorio", 400);
  if (body.role != null && !isSpecRole(body.role)) throw new HttpError("Ruolo non valido: usare owner, admin, collaborator o viewer", 400);

  const db = getDb();
  const coll = db.collection(COLLECTION);
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (body.role != null && isSpecRole(body.role)) update.role = body.role;
  if (body.access_scope !== undefined) update.access_scope = body.access_scope === "assigned" ? "assigned" : "all";
  if (Object.keys(update).length <= 1) throw new HttpError("role o access_scope obbligatorio per l'aggiornamento", 400);

  const result = await coll.findOneAndUpdate(
    { workspaceId, userId: uid },
    { $set: update },
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
