/**
 * Lista utenti per pagina admin "User": visibilità e associazioni.
 * Aggrega tz_users (email, role, project_ids) + tz_user_workspaces (workspace, role) + nomi workspace.
 */
import { getDb } from "../../config/db.js";

const COLLECTION_USERS = "tz_users";
const COLLECTION_USER_WORKSPACES = "tz_user_workspaces";
const COLLECTION_WORKSPACES = "tz_workspaces";

export interface UserWorkspaceMembership {
  workspaceId: string;
  workspaceName: string;
  role: string;
}

export interface UserWithVisibilityRow {
  /** _id tz_users quando presente */
  userId: string | null;
  email: string;
  /** Ruolo globale da tz_users (admin, vendor, …) */
  role: string | null;
  isAdmin: boolean;
  /** Id progetti da tz_users.project_ids (legacy) */
  projectIds: string[];
  /** Membership per workspace (da tz_user_workspaces) */
  workspaces: UserWorkspaceMembership[];
}

function normalizeEmail(v: unknown): string {
  if (typeof v === "string" && v.trim()) return v.trim().toLowerCase();
  return "";
}

/** Lista tutti gli utenti con visibilità e associazioni. Solo per admin. */
export const listUsersWithVisibility = async (): Promise<{ users: UserWithVisibilityRow[] }> => {
  const db = getDb();

  const usersColl = db.collection(COLLECTION_USERS);
  const uwColl = db.collection(COLLECTION_USER_WORKSPACES);
  const wsColl = db.collection(COLLECTION_WORKSPACES);

  const [userDocs, membershipDocs, workspaceDocs] = await Promise.all([
    usersColl.find({}).project({ email: 1, role: 1, project_ids: 1, _id: 1 }).toArray(),
    uwColl.find({}).toArray(),
    wsColl.find({}).project({ _id: 1, name: 1 }).toArray(),
  ]);

  const workspaceNames = new Map<string, string>();
  for (const w of workspaceDocs as { _id?: unknown; name?: string }[]) {
    const id = w._id != null ? String(w._id) : "";
    if (id) workspaceNames.set(id, typeof w.name === "string" ? w.name : id);
  }

  const userByEmail = new Map<string, { role: string; projectIds: string[]; userId: string | null }>();
  const emailsFromUsers = new Set<string>();
  for (const u of userDocs as {
    _id?: { toHexString?: () => string };
    email?: unknown;
    role?: unknown;
    project_ids?: unknown[];
  }[]) {
    const email = normalizeEmail(u.email);
    if (!email) continue;
    emailsFromUsers.add(email);
    const role = typeof u.role === "string" ? u.role : "";
    const projectIds = Array.isArray(u.project_ids)
      ? (u.project_ids as unknown[]).map((id) => String(id)).filter(Boolean)
      : [];
    const userId = u._id && typeof u._id.toHexString === "function" ? u._id.toHexString() : null;
    userByEmail.set(email, { role, projectIds, userId });
  }

  const membershipsByUser = new Map<string, { workspaceId: string; role: string }[]>();
  for (const m of membershipDocs as { userId?: unknown; workspaceId?: unknown; role?: unknown }[]) {
    const email = normalizeEmail(m.userId);
    const workspaceId = typeof m.workspaceId === "string" ? m.workspaceId : "";
    const role = typeof m.role === "string" ? m.role : "vendor";
    if (!email || !workspaceId) continue;
    const list = membershipsByUser.get(email) ?? [];
    list.push({ workspaceId, role });
    membershipsByUser.set(email, list);
  }

  const allEmails = new Set(emailsFromUsers);
  for (const e of membershipsByUser.keys()) allEmails.add(e);

  const users: UserWithVisibilityRow[] = [];
  for (const email of Array.from(allEmails).sort()) {
    const fromTzUsers = userByEmail.get(email);
    const role = fromTzUsers?.role ?? null;
    const isAdmin = role?.toLowerCase() === "admin";
    const projectIds = fromTzUsers?.projectIds ?? [];
    const userId = fromTzUsers?.userId ?? null;
    const memberships = (membershipsByUser.get(email) ?? []).map((m) => ({
      workspaceId: m.workspaceId,
      workspaceName: workspaceNames.get(m.workspaceId) ?? m.workspaceId,
      role: m.role,
    }));
    users.push({
      userId,
      email,
      role,
      isAdmin,
      projectIds,
      workspaces: memberships,
    });
  }

  return { users };
};
