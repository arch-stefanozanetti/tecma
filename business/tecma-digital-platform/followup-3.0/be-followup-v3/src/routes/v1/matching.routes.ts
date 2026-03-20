import { Router } from "express";
import { getClientCandidates, getApartmentCandidates } from "../../core/matching/matching.service.js";
import { handleAsync } from "../asyncHandler.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";

export const matchingRoutes = Router();

matchingRoutes.get("/matching/clients/:id/candidates", requirePermission(PERMISSIONS.CLIENTS_READ), handleAsync(async (req) => {
  const clientId = req.params.id;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const projectIds = typeof req.query.projectIds === "string"
    ? req.query.projectIds.split(",").map((p) => p.trim()).filter(Boolean)
    : [];
  return getClientCandidates(clientId, workspaceId, projectIds);
}));

matchingRoutes.get("/matching/apartments/:id/candidates", requirePermission(PERMISSIONS.APARTMENTS_READ), handleAsync(async (req) => {
  const apartmentId = req.params.id;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const projectIds = typeof req.query.projectIds === "string"
    ? req.query.projectIds.split(",").map((p) => p.trim()).filter(Boolean)
    : [];
  return getApartmentCandidates(apartmentId, workspaceId, projectIds);
}));
