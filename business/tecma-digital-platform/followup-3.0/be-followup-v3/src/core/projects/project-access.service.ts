/**
 * Collaborazione tra workspace: tz_project_access.
 * Il workspace che crea il progetto è owner (tz_projects.workspace_id); altri workspace
 * vengono invitati con un record qui (role: collaborator | viewer). I dati restano del workspace owner.
 */
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import type { ProjectAccessRole } from "../../types/models.js";

const COLLECTION = "tz_project_access";
const COLLECTION_PROJECTS = "tz_projects";
const COLLECTION_WORKSPACES = "tz_workspaces";

const ROLES: ProjectAccessRole[] = ["owner", "collaborator", "viewer"];

export interface ProjectAccessRow {
  _id: string;
  projectId: string;
  workspaceId: string;
  role: ProjectAccessRole;
  createdAt: string;
}

function toRow(d: { _id?: unknown; project_id?: string; workspace_id?: string; role?: string; created_at?: unknown }): ProjectAccessRow {
  const toIso = (v: unknown): string => {
    if (v instanceof Date) return v.toISOString();
    if (typeof v === "string" && v) return v;
    return new Date(0).toISOString();
  };
  return {
    _id: d._id != null ? String(d._id) : "",
    projectId: d.project_id ?? "",
    workspaceId: d.workspace_id ?? "",
    role: ROLES.includes((d.role as ProjectAccessRole)) ? (d.role as ProjectAccessRole) : "viewer",
    createdAt: toIso(d.created_at),
  };
}

/**
 * Concede a un workspace l'accesso al progetto (collaborator o viewer).
 * Non si può assegnare "owner" via questa API (owner = workspace_id su tz_projects).
 */
export async function grantProjectAccess(
  projectId: string,
  workspaceId: string,
  role: ProjectAccessRole
): Promise<ProjectAccessRow> {
  const pid = projectId.trim();
  const wid = workspaceId.trim();
  if (!pid || !wid) throw new HttpError("projectId and workspaceId required", 400);
  const effectiveRole = role === "owner" ? "collaborator" : ROLES.includes(role) ? role : "viewer";

  const db = getDb();
  const projectsColl = db.collection(COLLECTION_PROJECTS);
  const project = await projectsColl.findOne(
    { $or: [{ _id: pid as unknown }, { id: pid }] } as Record<string, unknown>,
    { projection: { workspace_id: 1 } }
  );
  if (!project) throw new HttpError("Project not found", 404);
  const ownerWs = (project as { workspace_id?: string }).workspace_id;
  if (ownerWs === wid) throw new HttpError("Workspace owner already has access", 400);

  const wsColl = db.collection(COLLECTION_WORKSPACES);
  const workspace = await wsColl.findOne({ _id: wid as unknown } as Record<string, unknown>);
  if (!workspace) throw new HttpError("Workspace not found", 404);

  const coll = db.collection(COLLECTION);
  const existing = await coll.findOne({ project_id: pid, workspace_id: wid } as Record<string, unknown>);
  const now = new Date().toISOString();
  if (existing) {
    await coll.updateOne(
      { project_id: pid, workspace_id: wid } as Record<string, unknown>,
      { $set: { role: effectiveRole, created_at: now } }
    );
    const updated = await coll.findOne({ project_id: pid, workspace_id: wid } as Record<string, unknown>);
    return toRow((updated ?? existing) as Parameters<typeof toRow>[0]);
  }
  const doc = { project_id: pid, workspace_id: wid, role: effectiveRole, created_at: now };
  const res = await coll.insertOne(doc as never);
  return toRow({ _id: res.insertedId, ...doc });
}

export async function revokeProjectAccess(projectId: string, workspaceId: string): Promise<{ deleted: boolean }> {
  const pid = projectId.trim();
  const wid = workspaceId.trim();
  if (!pid || !wid) throw new HttpError("projectId and workspaceId required", 400);

  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ project_id: pid, workspace_id: wid } as Record<string, unknown>);
  return { deleted: (result.deletedCount ?? 0) > 0 };
}

/**
 * Elenco workspace (e ruolo) con accesso al progetto.
 * Include il workspace owner (da tz_projects.workspace_id) e i record in tz_project_access.
 */
export async function listProjectAccess(projectId: string): Promise<{ data: ProjectAccessRow[] }> {
  const pid = projectId.trim();
  if (!pid) return { data: [] };

  const db = getDb();
  const projectsColl = db.collection(COLLECTION_PROJECTS);
  const project = await projectsColl.findOne(
    { $or: [{ _id: pid as unknown }, { id: pid }] } as Record<string, unknown>,
    { projection: { workspace_id: 1 } }
  );

  const rows: ProjectAccessRow[] = [];
  if (project) {
    const ownerWs = (project as { workspace_id?: string }).workspace_id;
    if (ownerWs) {
      rows.push({
        _id: `owner-${ownerWs}`,
        projectId: pid,
        workspaceId: ownerWs,
        role: "owner",
        createdAt: "",
      });
    }
  }

  const docs = await db.collection(COLLECTION).find({ project_id: pid } as Record<string, unknown>).toArray();
  for (const d of docs) {
    rows.push(toRow(d as Parameters<typeof toRow>[0]));
  }
  return { data: rows };
}
