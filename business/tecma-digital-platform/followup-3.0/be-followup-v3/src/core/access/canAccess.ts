/**
 * Controllo accessi centralizzato (Access Control & Multi-Tenant).
 * TUTTE le API devono passare da qui; MAI duplicare logica nei controller.
 * TECMA (system_role === "tecma_admin") bypassa tutti i controlli.
 */
import { getDb } from "../../config/db.js";
import { listWorkspaceIdsForUser } from "../workspaces/workspace-users.service.js";

const COLLECTION_MEMBERSHIPS = "tz_user_workspaces";
const COLLECTION_PROJECTS = "tz_projects";
const COLLECTION_WORKSPACE_PROJECTS = "tz_workspace_projects";
const COLLECTION_PROJECT_ACCESS = "tz_project_access";

/** Utente dal JWT o contesto richiesta. */
export interface AccessUser {
  sub: string;
  email: string;
  system_role?: string | null;
  isTecmaAdmin?: boolean;
}

export type WorkspaceResource = { type: "workspace"; workspaceId: string };
export type ProjectResource = { type: "project"; projectId: string; workspaceId?: string };
export type Resource = WorkspaceResource | ProjectResource;

function isTecmaAdmin(user: AccessUser): boolean {
  return user.system_role === "tecma_admin" || user.isTecmaAdmin === true;
}

/** User identifier per membership lookup: Fase 1 = email (lowercase). */
function userMemberKey(user: AccessUser): string {
  return (user.email || "").trim().toLowerCase();
}

/**
 * Verifica accesso a una risorsa.
 * 1) TECMA admin → sempre true.
 * 2) Workspace → utente deve avere membership in quel workspace.
 * 3) Project → utente membro del workspace owner O del workspace con record in tz_project_access.
 */
export async function canAccess(user: AccessUser, resource: Resource): Promise<boolean> {
  if (!user?.sub && !user?.email) return false;
  if (isTecmaAdmin(user)) return true;

  if (resource.type === "workspace") {
    const workspaceIds = await listWorkspaceIdsForUser(userMemberKey(user));
    return workspaceIds.includes(resource.workspaceId);
  }

  if (resource.type === "project") {
    const db = getDb();
    const memberKey = userMemberKey(user);
    const workspaceIds = await listWorkspaceIdsForUser(memberKey);
    if (workspaceIds.length === 0) return false;

    const projectId = resource.projectId.trim();
    if (!projectId) return false;

    const projectsColl = db.collection(COLLECTION_PROJECTS);
    const project = await projectsColl.findOne(
      { $or: [{ _id: projectId as unknown }, { id: projectId }] } as Record<string, unknown>,
      { projection: { workspace_id: 1, _id: 1 } }
    );

    let ownerWorkspaceId: string | null = null;
    if (project) {
      const p = project as unknown as { workspace_id?: string; _id?: string };
      ownerWorkspaceId = typeof p.workspace_id === "string" && p.workspace_id ? p.workspace_id : null;
    }
    if (!ownerWorkspaceId) {
      const wpColl = db.collection(COLLECTION_WORKSPACE_PROJECTS);
      const wp = await wpColl.findOne({ projectId });
      ownerWorkspaceId = wp ? String((wp as { workspaceId?: string }).workspaceId ?? "") : null;
    }
    if (ownerWorkspaceId && workspaceIds.includes(ownerWorkspaceId)) return true;

    const paColl = db.collection(COLLECTION_PROJECT_ACCESS);
    const projectAccessList = await paColl.find({ project_id: projectId }).toArray();
    for (const pa of projectAccessList) {
      const wid = String((pa as { workspace_id?: string }).workspace_id ?? "");
      if (wid && workspaceIds.includes(wid)) return true;
    }
    return false;
  }

  return false;
}

/** Lista workspace a cui l'utente ha accesso (per filtrare liste). */
export async function getWorkspacesForUser(user: AccessUser): Promise<string[]> {
  if (isTecmaAdmin(user)) {
    const db = getDb();
    const docs = await db.collection("tz_workspaces").find({}).project({ _id: 1 }).toArray();
    return docs.map((d) => String(d._id ?? ""));
  }
  return listWorkspaceIdsForUser(userMemberKey(user));
}

/**
 * Lista projectId a cui l'utente ha accesso (opzionale filtro per workspace).
 * Include progetti del workspace owner e progetti in tz_project_access per i suoi workspace.
 */
export async function getProjectsAccessibleByUser(
  user: AccessUser,
  workspaceId?: string
): Promise<string[]> {
  if (isTecmaAdmin(user)) {
    const db = getDb();
    const cursor = db.collection(COLLECTION_PROJECTS).find({ archived: { $ne: true } });
    const docs = await cursor.project({ _id: 1, id: 1 }).toArray();
    const ids = new Set<string>();
    for (const d of docs) {
      const id = (d as { _id?: string; id?: string })._id ?? (d as { id?: string }).id;
      if (id) ids.add(String(id));
    }
    return [...ids];
  }

  const workspaceIds = await listWorkspaceIdsForUser(userMemberKey(user));
  const filtered = workspaceId ? workspaceIds.filter((id) => id === workspaceId) : workspaceIds;
  if (filtered.length === 0) return [];

  const db = getDb();
  const ids = new Set<string>();

  const wpColl = db.collection(COLLECTION_WORKSPACE_PROJECTS);
  const wpDocs = await wpColl.find({ workspaceId: { $in: filtered } }).project({ projectId: 1 }).toArray();
  for (const d of wpDocs) {
    const pid = (d as { projectId?: string }).projectId;
    if (pid) ids.add(pid);
  }

  const projectsWithOwner = await db
    .collection(COLLECTION_PROJECTS)
    .find({ workspace_id: { $in: filtered } })
    .project({ _id: 1, id: 1 })
    .toArray();
  for (const d of projectsWithOwner) {
    const id = (d as { _id?: string; id?: string })._id ?? (d as { id?: string }).id;
    if (id) ids.add(String(id));
  }

  const paColl = db.collection(COLLECTION_PROJECT_ACCESS);
  const paDocs = await paColl.find({ workspace_id: { $in: filtered } }).project({ project_id: 1 }).toArray();
  for (const d of paDocs) {
    const pid = (d as { project_id?: string }).project_id;
    if (pid) ids.add(pid);
  }

  return [...ids];
}
