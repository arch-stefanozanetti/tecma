/**
 * Workspaces service.
 * Gestione tz_workspaces e tz_workspace_projects (solo test-zanetti).
 * CRUD workspace: admin only.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION_WORKSPACES = "tz_workspaces";
const COLLECTION_WORKSPACE_PROJECTS = "tz_workspace_projects";

export interface WorkspaceRow {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceProjectRow {
  workspaceId: string;
  projectId: string;
  createdAt: string;
}

const WorkspaceCreateSchema = z.object({
  name: z.string().min(1).max(200),
});

const WorkspaceUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
});

const AssociateProjectSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
});

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

/** Lista tutti i workspace (admin). */
export const listWorkspaces = async (): Promise<WorkspaceRow[]> => {
  const db = getDb();
  const coll = db.collection(COLLECTION_WORKSPACES);
  const docs = await coll.find({}).sort({ updatedAt: -1 }).toArray();
  return docs.map((d) => ({
    _id: String(d._id ?? ""),
    name: typeof d.name === "string" ? d.name : "",
    createdAt: toIsoDate(d.createdAt),
    updatedAt: toIsoDate(d.updatedAt),
  }));
};

/** Crea workspace (admin). */
export const createWorkspace = async (rawInput: unknown): Promise<{ workspace: WorkspaceRow }> => {
  const input = WorkspaceCreateSchema.parse(rawInput);
  const db = getDb();
  const coll = db.collection(COLLECTION_WORKSPACES);
  const now = new Date().toISOString();
  const doc = {
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
  };
  const result = await coll.insertOne(doc);
  const _id = result.insertedId.toHexString();
  return {
    workspace: {
      _id,
      name: doc.name,
      createdAt: now,
      updatedAt: now,
    },
  };
};

/** Ottiene workspace per id. */
export const getWorkspaceById = async (rawId: unknown): Promise<{ workspace: WorkspaceRow }> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) {
    throw new HttpError("Workspace not found", 404);
  }
  const db = getDb();
  const doc = await db.collection(COLLECTION_WORKSPACES).findOne({ _id: new ObjectId(id) });
  if (!doc) {
    throw new HttpError("Workspace not found", 404);
  }
  return {
    workspace: {
      _id: String(doc._id),
      name: typeof doc.name === "string" ? doc.name : "",
      createdAt: toIsoDate(doc.createdAt),
      updatedAt: toIsoDate(doc.updatedAt),
    },
  };
};

/** Aggiorna workspace (admin). */
export const updateWorkspace = async (
  rawId: unknown,
  rawInput: unknown
): Promise<{ workspace: WorkspaceRow }> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  const input = WorkspaceUpdateSchema.parse(rawInput);
  if (!ObjectId.isValid(id)) {
    throw new HttpError("Workspace not found", 404);
  }
  const db = getDb();
  const coll = db.collection(COLLECTION_WORKSPACES);
  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.name !== undefined) update.name = input.name.trim();
  const result = await coll.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) {
    throw new HttpError("Workspace not found", 404);
  }
  const doc = result as { _id: ObjectId; name?: string; createdAt?: unknown; updatedAt?: unknown };
  return {
    workspace: {
      _id: doc._id.toHexString(),
      name: typeof doc.name === "string" ? doc.name : "",
      createdAt: toIsoDate(doc.createdAt),
      updatedAt: toIsoDate(doc.updatedAt),
    },
  };
};

/** Elimina workspace (admin). Rimuove anche le associazioni progetti. */
export const deleteWorkspace = async (rawId: unknown): Promise<void> => {
  const id = typeof rawId === "string" ? rawId : String(rawId);
  if (!ObjectId.isValid(id)) {
    throw new HttpError("Workspace not found", 404);
  }
  const db = getDb();
  const wsColl = db.collection(COLLECTION_WORKSPACES);
  const wpColl = db.collection(COLLECTION_WORKSPACE_PROJECTS);
  const doc = await wsColl.findOne({ _id: new ObjectId(id) });
  if (!doc) {
    throw new HttpError("Workspace not found", 404);
  }
  await wpColl.deleteMany({ workspaceId: id });
  await wsColl.deleteOne({ _id: new ObjectId(id) });
};

/** Lista progetti associati a un workspace. */
export const listWorkspaceProjects = async (
  rawWorkspaceId: unknown
): Promise<WorkspaceProjectRow[]> => {
  const workspaceId = typeof rawWorkspaceId === "string" ? rawWorkspaceId : String(rawWorkspaceId);
  if (!workspaceId.trim()) {
    throw new HttpError("workspaceId required", 400);
  }
  const db = getDb();
  const docs = await db
    .collection(COLLECTION_WORKSPACE_PROJECTS)
    .find({ workspaceId })
    .sort({ createdAt: 1 })
    .toArray();
  return docs.map((d) => ({
    workspaceId: String(d.workspaceId ?? ""),
    projectId: String(d.projectId ?? ""),
    createdAt: toIsoDate(d.createdAt),
  }));
};

/** Associa un progetto a un workspace (admin). */
export const associateProjectToWorkspace = async (
  rawInput: unknown
): Promise<{ workspaceId: string; projectId: string }> => {
  const input = AssociateProjectSchema.parse(rawInput);
  const db = getDb();
  const wsColl = db.collection(COLLECTION_WORKSPACES);
  const wpColl = db.collection(COLLECTION_WORKSPACE_PROJECTS);

  if (!ObjectId.isValid(input.workspaceId)) {
    throw new HttpError("Invalid workspaceId", 400);
  }
  const workspaceExists = await wsColl.findOne({ _id: new ObjectId(input.workspaceId) });
  if (!workspaceExists) {
    throw new HttpError("Workspace not found", 404);
  }

  const wid = String(workspaceExists._id);
  const pid = input.projectId.trim();

  const existing = await wpColl.findOne({ workspaceId: wid, projectId: pid });
  if (existing) {
    return { workspaceId: wid, projectId: pid };
  }

  const now = new Date().toISOString();
  await wpColl.insertOne({
    workspaceId: wid,
    projectId: pid,
    createdAt: now,
  });
  return { workspaceId: wid, projectId: pid };
};

/** Rimuove associazione progetto-workspace (admin). */
export const dissociateProjectFromWorkspace = async (
  rawWorkspaceId: unknown,
  rawProjectId: unknown
): Promise<void> => {
  const workspaceId = typeof rawWorkspaceId === "string" ? rawWorkspaceId : String(rawWorkspaceId);
  const projectId = typeof rawProjectId === "string" ? rawProjectId : String(rawProjectId);
  if (!workspaceId.trim() || !projectId.trim()) {
    throw new HttpError("workspaceId and projectId required", 400);
  }
  const db = getDb();
  const result = await db
    .collection(COLLECTION_WORKSPACE_PROJECTS)
    .deleteOne({ workspaceId, projectId: projectId.trim() });
  if (result.deletedCount === 0) {
    throw new HttpError("Association not found", 404);
  }
};
