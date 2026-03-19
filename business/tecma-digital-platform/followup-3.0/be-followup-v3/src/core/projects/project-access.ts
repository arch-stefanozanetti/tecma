import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION_WORKSPACE_PROJECTS = "tz_workspace_projects";
const LEGACY_WORKSPACES = ["dev-1", "demo", "prod"];

/**
 * Verifica che il progetto sia associato al workspace. Se isAdmin o workspace legacy, bypass.
 * Per nuovo codice preferire il middleware requireCanAccessProject (canAccess centralizzato).
 */
export const ensureProjectInWorkspace = async (
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<void> => {
  if (isAdmin || LEGACY_WORKSPACES.includes(workspaceId)) return;
  const db = getDb();
  const wp = await db.collection(COLLECTION_WORKSPACE_PROJECTS).findOne({
    workspaceId,
    projectId,
  });
  if (!wp) {
    throw new HttpError("Project not found or not in workspace", 404);
  }
};

export const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};
