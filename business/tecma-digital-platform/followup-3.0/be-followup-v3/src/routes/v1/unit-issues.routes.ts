import { Router } from "express";
import {
  queryUnitIssues,
  getUnitIssueById,
  createUnitIssue,
  patchUnitIssue,
  deleteUnitIssue,
} from "../../core/post-delivery/unit-issues.service.js";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace, requireCanAccessProject } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";

export const unitIssuesRoutes = Router();

unitIssuesRoutes.post(
  "/unit-issues/query",
  requirePermission(PERMISSIONS.POST_DELIVERY_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync((req) => queryUnitIssues(req.body))
);

unitIssuesRoutes.post(
  "/unit-issues",
  requirePermission(PERMISSIONS.POST_DELIVERY_UPDATE),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync((req) => createUnitIssue(req.body, { userId: req.user?.sub }))
);

unitIssuesRoutes.get(
  "/unit-issues/:id",
  requirePermission(PERMISSIONS.POST_DELIVERY_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync((req) => getUnitIssueById(req.params.id, String(req.query.workspaceId ?? "")))
);

unitIssuesRoutes.patch(
  "/unit-issues/:id",
  requirePermission(PERMISSIONS.POST_DELIVERY_UPDATE),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync((req) => patchUnitIssue(req.params.id, req.body, { userId: req.user?.sub }))
);

unitIssuesRoutes.delete(
  "/unit-issues/:id",
  requirePermission(PERMISSIONS.POST_DELIVERY_UPDATE),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync((req) =>
    deleteUnitIssue(req.params.id, String(req.query.workspaceId ?? ""), String(req.query.projectId ?? ""))
  )
);
