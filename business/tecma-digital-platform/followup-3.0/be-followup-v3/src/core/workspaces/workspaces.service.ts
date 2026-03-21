/**
 * Workspaces service.
 * Gestione tz_workspaces e tz_workspace_projects (solo test-zanetti).
 * CRUD workspace: admin only.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { listWorkspaceClientFeatureKeys } from "./workspace-entitlements.service.js";

const COLLECTION_WORKSPACES = "tz_workspaces";
const COLLECTION_WORKSPACE_PROJECTS = "tz_workspace_projects";

export interface WorkspaceRow {
  _id: string;
  name: string;
  owner_user_id?: string | null;
  /** Se true, membership richiede MFA attivo per login completo. */
  mfaRequired?: boolean;
  createdAt: string;
  updatedAt: string;
  /** Chiavi moduli UI abilitate (derivate da tz_workspace_entitlements). */
  features?: string[];
}

export interface WorkspaceProjectRow {
  workspaceId: string;
  projectId: string;
  createdAt: string;
}

/** Riga arricchita con dettagli da tz_projects per la pagina Progetti. */
export interface WorkspaceProjectEnrichedRow extends WorkspaceProjectRow {
  id?: string;
  name?: string;
  displayName?: string;
  mode?: string;
}

const WorkspaceCreateSchema = z.object({
  name: z.string().min(1).max(200),
  owner_user_id: z.string().optional(),
});

const WorkspaceUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  owner_user_id: z.string().optional().nullable(),
  mfaRequired: z.boolean().optional(),
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

const DEFAULT_WORKSPACES = [
  { name: "Dev-1" },
  { name: "Demo" },
  { name: "Production" },
];

/** Se la collection è vuota, crea i workspace di default (Dev-1, Demo, Production). */
async function ensureDefaultWorkspaces(): Promise<void> {
  const db = getDb();
  const coll = db.collection(COLLECTION_WORKSPACES);
  const count = await coll.countDocuments();
  if (count > 0) return;
  const now = new Date().toISOString();
  await coll.insertMany(
    DEFAULT_WORKSPACES.map((w) => ({
      name: w.name,
      createdAt: now,
      updatedAt: now,
    }))
  );
}

/** Lista tutti i workspace (admin). Se non ce ne sono, crea i default e li restituisce. */
export const listWorkspaces = async (): Promise<WorkspaceRow[]> => {
  const db = getDb();
  const coll = db.collection(COLLECTION_WORKSPACES);
  await ensureDefaultWorkspaces();
  const docs = await coll.find({}).sort({ updatedAt: -1 }).toArray();
  return docs.map((d: Record<string, unknown>) => ({
    _id: String(d._id ?? ""),
    name: typeof d.name === "string" ? d.name : "",
    owner_user_id: d.owner_user_id != null ? String(d.owner_user_id) : undefined,
    mfaRequired: d.mfaRequired === true,
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
  const doc: Record<string, unknown> = {
    name: input.name.trim(),
    createdAt: now,
    updatedAt: now,
  };
  if (input.owner_user_id && ObjectId.isValid(input.owner_user_id)) {
    doc.owner_user_id = new ObjectId(input.owner_user_id);
  }
  const result = await coll.insertOne(doc);
  const _id = result.insertedId.toHexString();
  const ws = await coll.findOne({ _id: result.insertedId });
  return {
    workspace: {
      _id,
      name: (ws?.name as string) ?? doc.name as string,
      owner_user_id: ws?.owner_user_id != null ? String(ws.owner_user_id) : undefined,
      mfaRequired: (ws as { mfaRequired?: boolean } | null)?.mfaRequired === true,
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
  const _id = String(doc._id);
  const features = await listWorkspaceClientFeatureKeys(_id);
  return {
    workspace: {
      _id,
      name: typeof doc.name === "string" ? doc.name : "",
      owner_user_id: doc.owner_user_id != null ? String(doc.owner_user_id) : undefined,
      mfaRequired: (doc as { mfaRequired?: boolean }).mfaRequired === true,
      createdAt: toIsoDate(doc.createdAt),
      updatedAt: toIsoDate(doc.updatedAt),
      features,
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
  if (input.owner_user_id !== undefined) {
    update.owner_user_id = input.owner_user_id && ObjectId.isValid(input.owner_user_id) ? new ObjectId(input.owner_user_id) : null;
  }
  if (input.mfaRequired !== undefined) {
    update.mfaRequired = input.mfaRequired;
  }
  const result = await coll.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) {
    throw new HttpError("Workspace not found", 404);
  }
  const doc = result as {
    _id: ObjectId;
    name?: string;
    owner_user_id?: ObjectId | null;
    mfaRequired?: boolean;
    createdAt?: unknown;
    updatedAt?: unknown;
  };
  const wid = doc._id.toHexString();
  const features = await listWorkspaceClientFeatureKeys(wid);
  return {
    workspace: {
      _id: wid,
      name: typeof doc.name === "string" ? doc.name : "",
      owner_user_id: doc.owner_user_id != null ? String(doc.owner_user_id) : undefined,
      mfaRequired: doc.mfaRequired === true,
      createdAt: toIsoDate(doc.createdAt),
      updatedAt: toIsoDate(doc.updatedAt),
      features,
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

const COLLECTION_TZ_PROJECTS = "tz_projects";

/** Lista progetti associati a un workspace, arricchiti con name/displayName/mode da tz_projects. */
export const listWorkspaceProjects = async (
  rawWorkspaceId: unknown
): Promise<WorkspaceProjectEnrichedRow[]> => {
  const workspaceId = typeof rawWorkspaceId === "string" ? rawWorkspaceId : String(rawWorkspaceId);
  if (!workspaceId.trim()) {
    throw new HttpError("workspaceId required", 400);
  }
  const db = getDb();
  const wpColl = db.collection(COLLECTION_WORKSPACE_PROJECTS);
  const projColl = db.collection(COLLECTION_TZ_PROJECTS);
  const docs = await wpColl.find({ workspaceId }).sort({ createdAt: 1 }).toArray();
  const rows: WorkspaceProjectEnrichedRow[] = [];
  for (const d of docs) {
    const projectId = String(d.projectId ?? "");
    const base: WorkspaceProjectEnrichedRow = {
      workspaceId: String(d.workspaceId ?? ""),
      projectId,
      createdAt: toIsoDate(d.createdAt),
      id: projectId,
    };
    try {
      const projQuery =
        ObjectId.isValid(projectId) && projectId.length === 24
          ? { $or: [{ _id: new ObjectId(projectId) }, { _id: projectId as unknown as ObjectId }] }
          : { _id: projectId as unknown as ObjectId };
      const proj = await projColl.findOne(projQuery, {
        projection: { name: 1, displayName: 1, mode: 1 },
      });
      if (proj) {
        const p = proj as { name?: string; displayName?: string; mode?: string };
        base.name = typeof p.name === "string" ? p.name : undefined;
        base.displayName = typeof p.displayName === "string" ? p.displayName : base.name;
        const mode = p.mode;
        base.mode = mode === "rent" || mode === "sell" ? mode : undefined;
      }
    } catch {
      // ignora errore lookup progetto
    }
    rows.push(base);
  }
  return rows;
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
