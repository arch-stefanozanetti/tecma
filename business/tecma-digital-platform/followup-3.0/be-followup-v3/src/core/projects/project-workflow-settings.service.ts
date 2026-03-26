/**
 * Override workflow trattative per progetto (default = primo workflow workspace per tipo).
 * Collezione tz_project_workflow_settings.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ensureProjectInWorkspace, toIsoDate } from "./project-access.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_project_workflow_settings";
const COLLECTION_WORKFLOWS = "tz_workflows";

const PutSchema = z.object({
  workflowId: z.string().nullable().optional(),
});

export interface ProjectWorkflowSettingsRow {
  projectId: string;
  workspaceId: string;
  workflowId: string | null;
  updatedAt: string;
}

async function validateWorkflowForWorkspace(
  workflowId: string,
  workspaceId: string
): Promise<{ _id: ObjectId; workspaceId: string; type: string }> {
  if (!ObjectId.isValid(workflowId)) {
    throw new HttpError("Workflow non trovato", 404);
  }
  const db = getDb();
  const wf = await db.collection(COLLECTION_WORKFLOWS).findOne({ _id: new ObjectId(workflowId) });
  if (!wf || typeof wf.workspaceId !== "string") {
    throw new HttpError("Workflow non trovato", 404);
  }
  if (wf.workspaceId !== workspaceId) {
    throw new HttpError("Il workflow non appartiene a questo workspace", 400);
  }
  return { _id: wf._id as ObjectId, workspaceId: wf.workspaceId, type: typeof wf.type === "string" ? wf.type : "custom" };
}

export async function getProjectWorkflowSettingsRaw(projectId: string): Promise<ProjectWorkflowSettingsRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ projectId });
  if (!doc) return null;
  const workflowId =
    doc.workflowId != null && typeof doc.workflowId === "string" && ObjectId.isValid(doc.workflowId)
      ? doc.workflowId
      : null;
  return {
    projectId,
    workspaceId: typeof doc.workspaceId === "string" ? doc.workspaceId : "",
    workflowId,
    updatedAt: toIsoDate(doc.updatedAt),
  };
}

export async function getProjectWorkflowSettings(
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectWorkflowSettingsRow> {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const raw = await getProjectWorkflowSettingsRaw(projectId);
  if (!raw) {
    return { projectId, workspaceId, workflowId: null, updatedAt: new Date(0).toISOString() };
  }
  return raw;
}

export async function putProjectWorkflowSettings(
  projectId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectWorkflowSettingsRow> {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = PutSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();

  if (input.workflowId === undefined) {
    const existing = await getProjectWorkflowSettings(projectId, workspaceId, isAdmin);
    return existing;
  }

  if (input.workflowId === null || input.workflowId === "") {
    await db.collection(COLLECTION).updateOne(
      { projectId },
      { $set: { projectId, workspaceId, workflowId: null, updatedAt: now } },
      { upsert: true }
    );
    return { projectId, workspaceId, workflowId: null, updatedAt: now };
  }

  await validateWorkflowForWorkspace(input.workflowId, workspaceId);

  await db.collection(COLLECTION).updateOne(
    { projectId },
    { $set: { projectId, workspaceId, workflowId: input.workflowId, updatedAt: now } },
    { upsert: true }
  );
  return getProjectWorkflowSettings(projectId, workspaceId, isAdmin);
}
