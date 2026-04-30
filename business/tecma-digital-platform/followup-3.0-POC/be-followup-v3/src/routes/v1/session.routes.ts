import type { Request, Response, NextFunction } from "express";
import { Router } from "express";
import { z } from "zod";
import { getProjectAccessByEmail } from "../../core/auth/projectAccess.service.js";
import { getUserPreferences, upsertUserPreferences } from "../../core/auth/userPreferences.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync, sendError } from "../asyncHandler.js";

export const sessionRoutes = Router();

function emailMatchesSessionUser(req: Request, email: string): boolean {
  if (!req.user) return false;
  if (req.user.isAdmin === true) return true;
  if (Array.isArray(req.user.permissions) && req.user.permissions.includes("*")) return true;
  const tokenEmail = (req.user.email ?? "").trim().toLowerCase();
  return tokenEmail.length > 0 && tokenEmail === email.trim().toLowerCase();
}

function requireSessionTargetEmail(getEmail: (r: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, new HttpError("Unauthorized", 401));
      return;
    }
    const email = getEmail(req)?.trim();
    if (!email) {
      sendError(res, new HttpError("Missing email", 400));
      return;
    }
    if (!emailMatchesSessionUser(req, email)) {
      sendError(res, new HttpError("Permesso negato", 403));
      return;
    }
    next();
  };
}

sessionRoutes.post(
  "/session/projects-by-email",
  requireSessionTargetEmail((r) => {
    const e = (r.body as { email?: unknown })?.email;
    return typeof e === "string" ? e : undefined;
  }),
  handleAsync((req) => getProjectAccessByEmail(req.body))
);

sessionRoutes.get(
  "/session/preferences",
  requireSessionTargetEmail((r) => {
    const q = r.query.email;
    return typeof q === "string" ? q : undefined;
  }),
  handleAsync(async (req) => {
  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email) throw new HttpError("Missing email query param", 400);
  const prefs = await getUserPreferences(email);
  if (!prefs) return { found: false };
  return {
    found: true,
    email: prefs.email,
    workspaceId: prefs.workspaceId,
    selectedProjectIds: prefs.selectedProjectIds,
    updatedAt: prefs.updatedAt,
  };
  })
);

sessionRoutes.post(
  "/session/preferences",
  requireSessionTargetEmail((r) => {
    const e = (r.body as { email?: unknown })?.email;
    return typeof e === "string" ? e : undefined;
  }),
  handleAsync(async (req) => {
  const body = z
    .object({
      email: z.string().email(),
      workspaceId: z.string().min(1),
      selectedProjectIds: z.array(z.string().min(1)).min(1),
    })
    .parse(req.body);
  const prefs = await upsertUserPreferences(body.email, body.workspaceId, body.selectedProjectIds);
  return {
    email: prefs.email,
    workspaceId: prefs.workspaceId,
    selectedProjectIds: prefs.selectedProjectIds,
    updatedAt: prefs.updatedAt,
  };
  })
);
