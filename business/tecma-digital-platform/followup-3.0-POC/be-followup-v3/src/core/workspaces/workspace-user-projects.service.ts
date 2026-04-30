/**
 * Progetti visibili per utente nel workspace (tz_workspace_user_projects).
 * Se nessun record per (workspaceId, userId) l'utente vede tutti i progetti del workspace.
 */
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_workspace_user_projects";
const COLLECTION_WORKSPACE_PROJECTS = "tz_workspace_projects";

let indexEnsured = false;
async function ensureIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = getDb();
  await db.collection(COLLECTION).createIndex(
    { workspaceId: 1, userId: 1, projectId: 1 },
    { unique: true }
  );
  indexEnsured = true;
}

export const listWorkspaceUserProjects = async (
  workspaceId: string,
  userId: string
): Promise<{ data: string[] }> => {
  const uid = userId.trim().toLowerCase();
  if (!workspaceId.trim() || !uid) return { data: [] };
  await ensureIndex();
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ workspaceId, userId: uid })
    .project({ projectId: 1 })
    .toArray();
  const data = (docs as { projectId?: unknown }[])
    .map((d) => (typeof d.projectId === "string" ? d.projectId : String(d.projectId ?? "")))
    .filter(Boolean);
  return { data };
};

export const addWorkspaceUserProject = async (
  workspaceId: string,
  userId: string,
  projectId: string
): Promise<{ row: { _id: string; workspaceId: string; userId: string; projectId: string } }> => {
  const uid = userId.trim().toLowerCase();
  const pid = projectId.trim();
  if (!workspaceId.trim() || !uid || !pid) {
    throw new HttpError("workspaceId, userId e projectId obbligatori", 400);
  }
  const db = getDb();
  const wpColl = db.collection(COLLECTION_WORKSPACE_PROJECTS);
  const inWorkspace = await wpColl.findOne({ workspaceId, projectId: pid });
  if (!inWorkspace) {
    throw new HttpError("Il progetto non è associato a questo workspace", 400);
  }
  await ensureIndex();
  const coll = db.collection(COLLECTION);
  const existing = await coll.findOne({ workspaceId, userId: uid, projectId: pid });
  if (existing) {
    return {
      row: {
        _id: String(existing._id),
        workspaceId,
        userId: uid,
        projectId: pid,
      },
    };
  }
  const now = new Date().toISOString();
  const doc = { workspaceId, userId: uid, projectId: pid, createdAt: now };
  const res = await coll.insertOne(doc);
  return {
    row: {
      _id: res.insertedId.toHexString(),
      workspaceId,
      userId: uid,
      projectId: pid,
    },
  };
};

export const removeWorkspaceUserProject = async (
  workspaceId: string,
  userId: string,
  projectId: string
): Promise<{ deleted: boolean }> => {
  const uid = userId.trim().toLowerCase();
  const pid = projectId.trim();
  if (!workspaceId.trim() || !uid || !pid) {
    throw new HttpError("workspaceId, userId e projectId obbligatori", 400);
  }
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ workspaceId, userId: uid, projectId: pid });
  return { deleted: (result.deletedCount ?? 0) > 0 };
};
