import { Router } from "express";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requirePermission } from "../permissionMiddleware.js";
import { requireCanAccessProject } from "../accessMiddleware.js";
import { requireWorkspaceEntitled, workspaceIdFromBodyOrQuery } from "../workspaceEntitlementMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { getBigDataProjectSnapshot } from "../../core/bigdata/bigdata.service.js";

export const bigdataRoutes = Router();

bigdataRoutes.get(
  "/bigdata/projects/:projectId",
  requirePermission(PERMISSIONS.REPORTS_READ),
  requireWorkspaceEntitled("reports", workspaceIdFromBodyOrQuery),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync(async (req) => {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
    const projectId = req.params.projectId?.trim() ?? "";
    const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom.trim() : "";
    const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo.trim() : "";
    const attributionModel =
      req.query.attributionModel === "first_touch" ? "first_touch" : "last_touch";
    const sectionRaw = typeof req.query.section === "string" ? req.query.section.trim().toLowerCase() : "";
    const allowed = new Set(["full", "overview", "ads", "meta", "ga4", "funnel", "listings"]);
    const section = allowed.has(sectionRaw) ? (sectionRaw as "full" | "overview" | "ads" | "meta" | "ga4" | "funnel" | "listings") : "full";
    if (!workspaceId) throw new HttpError("workspaceId query richiesto", 400);
    if (!projectId) throw new HttpError("projectId richiesto", 400);
    if (!dateFrom || !dateTo) throw new HttpError("dateFrom e dateTo query richiesti (ISO 8601)", 400);
    return getBigDataProjectSnapshot({
      workspaceId,
      projectId,
      dateFrom,
      dateTo,
      attributionModel,
      section,
    });
  })
);
