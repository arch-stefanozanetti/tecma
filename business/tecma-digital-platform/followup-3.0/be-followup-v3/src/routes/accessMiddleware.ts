/**
 * Middleware di protezione API basati su canAccess (workspace / project).
 * Usare dopo requireAuth. Non duplicare logica nei controller.
 */
import type { Request, Response, NextFunction } from "express";
import { canAccess, type AccessUser } from "../core/access/canAccess.js";
import { HttpError } from "../types/http.js";
import { sendError } from "./asyncHandler.js";

function toAccessUser(req: Request): AccessUser | null {
  const u = req.user;
  if (!u) return null;
  return {
    sub: u.sub,
    email: u.email ?? "",
    system_role: u.system_role ?? undefined,
    isTecmaAdmin: u.isTecmaAdmin
  };
}

function getWorkspaceId(req: Request, paramKey: string): string | null {
  const p = req.params[paramKey];
  if (typeof p === "string" && p.trim()) return p.trim();
  const q = req.query.workspaceId ?? req.query.workspace_id;
  if (typeof q === "string" && q.trim()) return q.trim();
  const b = req.body?.workspaceId ?? req.body?.workspace_id;
  if (typeof b === "string" && b.trim()) return b.trim();
  return null;
}

function getProjectId(req: Request, paramKey: string): string | null {
  const p = req.params[paramKey];
  if (typeof p === "string" && p.trim()) return p.trim();
  const q = req.query.projectId ?? req.query.project_id;
  if (typeof q === "string" && q.trim()) return q.trim();
  const b = req.body?.projectId ?? req.body?.project_id;
  if (typeof b === "string" && b.trim()) return b.trim();
  return null;
}

/**
 * Richiede che l'utente abbia accesso al workspace (membership).
 * Legge workspaceId da params[paramKey], query o body.
 */
export function requireCanAccessWorkspace(paramKey = "workspaceId") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = toAccessUser(req);
    if (!user) {
      sendError(res, new HttpError("Unauthorized", 401));
      return;
    }
    const workspaceId = getWorkspaceId(req, paramKey);
    if (!workspaceId) {
      sendError(res, new HttpError("workspaceId required", 400));
      return;
    }
    try {
      const ok = await canAccess(user, { type: "workspace", workspaceId });
      if (!ok) {
        sendError(res, new HttpError("Accesso al workspace non consentito", 403));
        return;
      }
      next();
    } catch (err) {
      sendError(res, err instanceof HttpError ? err : new HttpError("Access check failed", 500));
    }
  };
}

/**
 * Richiede che l'utente abbia accesso al progetto (workspace owner o project_access).
 * Legge workspaceId e projectId da params (paramWorkspaceKey, paramProjectKey), query o body.
 * Se workspaceId non è fornito, viene risolto dal progetto (owner).
 */
export function requireCanAccessProject(paramWorkspaceKey = "workspaceId", paramProjectKey = "projectId") {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = toAccessUser(req);
    if (!user) {
      sendError(res, new HttpError("Unauthorized", 401));
      return;
    }
    const projectId = getProjectId(req, paramProjectKey);
    if (!projectId) {
      sendError(res, new HttpError("projectId required", 400));
      return;
    }
    const workspaceId = getWorkspaceId(req, paramWorkspaceKey);
    try {
      const ok = await canAccess(user, { type: "project", projectId, workspaceId: workspaceId ?? undefined });
      if (!ok) {
        sendError(res, new HttpError("Accesso al progetto non consentito", 403));
        return;
      }
      next();
    } catch (err) {
      sendError(res, err instanceof HttpError ? err : new HttpError("Access check failed", 500));
    }
  };
}
