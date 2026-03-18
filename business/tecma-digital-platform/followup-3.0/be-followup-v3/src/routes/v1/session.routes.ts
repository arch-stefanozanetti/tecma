import { Router } from "express";
import { z } from "zod";
import { getProjectAccessByEmail } from "../../core/auth/projectAccess.service.js";
import { getUserPreferences, upsertUserPreferences } from "../../core/auth/userPreferences.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";

export const sessionRoutes = Router();

sessionRoutes.post("/session/projects-by-email", handleAsync((req) => getProjectAccessByEmail(req.body)));

sessionRoutes.get("/session/preferences", handleAsync(async (req) => {
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
}));

sessionRoutes.post("/session/preferences", handleAsync(async (req) => {
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
}));
