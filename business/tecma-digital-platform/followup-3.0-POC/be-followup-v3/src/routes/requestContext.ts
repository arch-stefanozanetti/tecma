import type { Request } from "express";
import { HttpError } from "../types/http.js";

export interface ProjectContext {
  projectId: string;
  workspaceId: string;
  isAdmin: boolean;
}

/**
 * Returns projectId, workspaceId and isAdmin from request (params + query + user).
 * Throws HttpError 400 if workspaceId is missing.
 */
export function getProjectContext(req: Request): ProjectContext {
  const projectId = typeof req.params.projectId === "string" ? req.params.projectId : "";
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  if (!workspaceId) {
    throw new HttpError("Missing workspaceId query param", 400);
  }
  const isAdmin = req.user?.isAdmin ?? false;
  return { projectId, workspaceId, isAdmin };
}

/**
 * Returns workspaceId from req.params.workspaceId. Throws HttpError 400 if missing.
 */
export function getWorkspaceIdFromParam(req: Request): string {
  const workspaceId = typeof req.params.workspaceId === "string" ? req.params.workspaceId.trim() : "";
  if (!workspaceId) {
    throw new HttpError("Missing workspaceId param", 400);
  }
  return workspaceId;
}

/**
 * Returns workspaceId from req.query.workspaceId, or empty string if missing.
 * Use when workspaceId is optional (e.g. for filtering).
 */
export function getWorkspaceIdFromQuery(req: Request): string {
  return typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
}
