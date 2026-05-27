import { Router } from "express";
import { getClientCandidates, getApartmentCandidates } from "../../core/matching/matching.service.js";
import { handleAsync } from "../asyncHandler.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import {
  buildListQueryContext,
  clampProjectIds,
  toEntityAssignmentViewer,
} from "../../core/access/listQueryContext.js";
import { toEntityAssignmentListViewer } from "../helpers/listQueryViewer.js";

export const matchingRoutes = Router();

function parseProjectIdsQuery(raw: unknown): string[] {
  return typeof raw === "string"
    ? raw
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean)
    : [];
}

matchingRoutes.get("/matching/clients/:id/candidates", requirePermission(PERMISSIONS.CLIENTS_READ), handleAsync(async (req) => {
  const clientId = req.params.id;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  let projectIds = parseProjectIdsQuery(req.query.projectIds);
  let viewer = toEntityAssignmentListViewer(req.user);
  if (workspaceId) {
    const ctx = await buildListQueryContext(req.user, workspaceId);
    if (ctx) {
      projectIds = clampProjectIds(projectIds, ctx.allowedProjectIds, ctx.isAdmin || ctx.isTecmaAdmin);
      viewer = toEntityAssignmentViewer(ctx);
    }
  }
  return getClientCandidates(clientId, workspaceId, projectIds, viewer);
}));

matchingRoutes.get("/matching/apartments/:id/candidates", requirePermission(PERMISSIONS.APARTMENTS_READ), handleAsync(async (req) => {
  const apartmentId = req.params.id;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  let projectIds = parseProjectIdsQuery(req.query.projectIds);
  let viewer = toEntityAssignmentListViewer(req.user);
  if (workspaceId) {
    const ctx = await buildListQueryContext(req.user, workspaceId);
    if (ctx) {
      projectIds = clampProjectIds(projectIds, ctx.allowedProjectIds, ctx.isAdmin || ctx.isTecmaAdmin);
      viewer = toEntityAssignmentViewer(ctx);
    }
  }
  return getApartmentCandidates(apartmentId, workspaceId, projectIds, viewer);
}));
