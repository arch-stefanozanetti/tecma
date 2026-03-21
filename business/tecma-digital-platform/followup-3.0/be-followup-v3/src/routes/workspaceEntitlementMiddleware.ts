import type { Request, Response, NextFunction } from "express";
import { isWorkspaceEntitledToFeature } from "../core/workspaces/workspace-entitlements.service.js";
import type { WorkspaceEntitlementFeature } from "../core/workspaces/workspace-feature-catalog.js";
import { HttpError } from "../types/http.js";
import { sendError } from "./asyncHandler.js";

/**
 * Richiede che il workspace sia entitled alla capability indicata.
 * `resolveWorkspaceId` deve restituire id non vuoto; altrimenti 400.
 */
export function requireWorkspaceEntitled(
  feature: WorkspaceEntitlementFeature,
  resolveWorkspaceId: (req: Request) => string | undefined | null
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const workspaceId = typeof resolveWorkspaceId(req) === "string" ? resolveWorkspaceId(req)!.trim() : "";
    if (!workspaceId) {
      sendError(res, new HttpError("workspaceId required", 400));
      return;
    }
    try {
      const ok = await isWorkspaceEntitledToFeature(workspaceId, feature);
      if (!ok) {
        sendError(
          res,
          new HttpError("Funzionalità non abilitata per questo workspace", 403, "FEATURE_NOT_ENTITLED")
        );
        return;
      }
      next();
    } catch (err) {
      sendError(res, err instanceof HttpError ? err : new HttpError("Entitlement check failed", 500));
    }
  };
}

export function workspaceIdFromBodyOrQuery(req: Request): string | undefined {
  const b = req.body as Record<string, unknown> | undefined;
  if (b && typeof b.workspaceId === "string" && b.workspaceId.trim()) return b.workspaceId.trim();
  const q = req.query.workspaceId;
  if (typeof q === "string" && q.trim()) return q.trim();
  return undefined;
}

/** Se `resolveWorkspaceId` è vuoto, passa senza controllo (es. Outlook senza contesto workspace). */
export function requireWorkspaceEntitledIfWorkspaceId(
  feature: WorkspaceEntitlementFeature,
  resolveWorkspaceId: (req: Request) => string | undefined | null
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const raw = resolveWorkspaceId(req);
    const workspaceId = typeof raw === "string" ? raw.trim() : "";
    if (!workspaceId) {
      next();
      return;
    }
    return requireWorkspaceEntitled(feature, () => workspaceId)(req, res, next);
  };
}
