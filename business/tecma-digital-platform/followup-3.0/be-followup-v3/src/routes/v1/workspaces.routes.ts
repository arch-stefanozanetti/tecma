import { Router } from "express";
import { HttpError } from "../../types/http.js";
import { getPriceAvailabilityMatrix } from "../../core/price-availability-matrix/price-availability-matrix.service.js";
import {
  listWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  listWorkspaceProjects,
  associateProjectToWorkspace,
  dissociateProjectFromWorkspace,
} from "../../core/workspaces/workspaces.service.js";
import {
  listWorkspaceUsers,
  listWorkspaceIdsForUser,
  addWorkspaceUser,
  updateWorkspaceUser,
  removeWorkspaceUser,
  type WorkspaceUserRole,
  type AccessScope,
} from "../../core/workspaces/workspace-users.service.js";
import {
  listWorkspaceUserProjects,
  addWorkspaceUserProject,
  removeWorkspaceUserProject,
} from "../../core/workspaces/workspace-user-projects.service.js";
import {
  listEntityAssignments,
  listEntityAssignmentsByUser,
  assignEntity,
  unassignEntity,
} from "../../core/workspaces/entity-assignments.service.js";
import { getWorkspaceBranding, putWorkspaceBranding } from "../../core/workspaces/workspace-branding.service.js";
import { requireAdmin } from "../authMiddleware.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { handleAsync } from "../asyncHandler.js";

export const workspacesRoutes = Router();

workspacesRoutes.get("/workspaces", handleAsync(async (req) => {
  const all = await listWorkspaces();
  const isAdmin = req.user?.isAdmin === true;
  const email = typeof req.user?.email === "string" ? req.user.email : "";
  if (isAdmin || !email) return all;
  const allowedIds = await listWorkspaceIdsForUser(email);
  const set = new Set(allowedIds);
  return all.filter((w) => set.has(w._id));
}));
workspacesRoutes.get("/workspaces/:id/users", handleAsync(async (req) => listWorkspaceUsers(req.params.id)));
workspacesRoutes.post("/workspaces/:id/users", requireAdmin, handleAsync(async (req) => {
  const body = req.body as { userId?: string; role?: WorkspaceUserRole; access_scope?: AccessScope };
  return addWorkspaceUser(req.params.id, {
    userId: body.userId ?? "",
    role: body.role ?? "collaborator",
    access_scope: body.access_scope,
  });
}));
workspacesRoutes.patch("/workspaces/:id/users/:userId", requireAdmin, handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  return updateWorkspaceUser(req.params.id, userId, req.body as { role?: WorkspaceUserRole; access_scope?: AccessScope });
}));
workspacesRoutes.delete("/workspaces/:id/users/:userId", requireAdmin, handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  return removeWorkspaceUser(req.params.id, userId);
}));
workspacesRoutes.get("/workspaces/:id/users/:userId/projects", handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  return listWorkspaceUserProjects(req.params.id, userId);
}));
workspacesRoutes.post("/workspaces/:id/users/:userId/projects", requireAdmin, handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  const body = req.body as { projectId?: string };
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  return addWorkspaceUserProject(req.params.id, userId, projectId);
}));
workspacesRoutes.delete("/workspaces/:id/users/:userId/projects/:projectId", requireAdmin, handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  const projectId = typeof req.params.projectId === "string" ? decodeURIComponent(req.params.projectId) : "";
  return removeWorkspaceUserProject(req.params.id, userId, projectId);
}));
workspacesRoutes.get("/workspaces/:id/projects", handleAsync((req) =>
  listWorkspaceProjects(req.params.id).then((rows) => ({ data: rows }))
));
workspacesRoutes.get("/workspaces/:id/branding", requireCanAccessWorkspace("id"), handleAsync((req) => getWorkspaceBranding(req.params.id)));
workspacesRoutes.patch("/workspaces/:id/branding", requireCanAccessWorkspace("id"), handleAsync((req) =>
  putWorkspaceBranding(req.params.id, req.body).then((row) => ({ data: row }))
));
workspacesRoutes.get("/workspaces/:workspaceId/price-availability", handleAsync(async (req) => {
  const workspaceId = req.params.workspaceId;
  const projectIdsRaw = req.query.projectIds;
  const projectIds = typeof projectIdsRaw === "string" ? projectIdsRaw.split(",").map((p) => p.trim()).filter(Boolean) : [];
  const from = (req.query.from as string) ?? "";
  const to = (req.query.to as string) ?? "";
  if (!from || !to) throw new HttpError("query from and to (YYYY-MM-DD) required", 400);
  if (projectIds.length === 0) throw new HttpError("projectIds required (comma-separated)", 400);
  return getPriceAvailabilityMatrix(workspaceId, projectIds, from, to);
}));
workspacesRoutes.get("/workspaces/:workspaceId/entities/:entityType/:entityId/assignments", handleAsync(async (req) => {
  const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
  const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
  return listEntityAssignments(req.params.workspaceId, entityType, entityId);
}));
workspacesRoutes.post("/workspaces/:workspaceId/entities/:entityType/:entityId/assignments", requireAdmin, handleAsync(async (req) => {
  const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
  const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
  const body = req.body as { userId?: string };
  const userId = typeof body.userId === "string" ? body.userId : "";
  return assignEntity(req.params.workspaceId, entityType, entityId, userId);
}));
workspacesRoutes.delete("/workspaces/:workspaceId/entities/:entityType/:entityId/assignments/:userId", requireAdmin, handleAsync(async (req) => {
  const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
  const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  return unassignEntity(req.params.workspaceId, entityType, entityId, userId);
}));
workspacesRoutes.get("/workspaces/:id/users/:userId/assignments", handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  return listEntityAssignmentsByUser(req.params.id, userId);
}));
workspacesRoutes.post("/workspaces", requireAdmin, handleAsync((req) => createWorkspace(req.body)));
workspacesRoutes.patch("/workspaces/:id", requireAdmin, handleAsync((req) => updateWorkspace(req.params.id, req.body)));
workspacesRoutes.delete("/workspaces/:id", requireAdmin, handleAsync(async (req) => {
  await deleteWorkspace(req.params.id);
  return { deleted: true };
}));
workspacesRoutes.post("/workspaces/projects/associate", requireAdmin, handleAsync((req) =>
  associateProjectToWorkspace(req.body)
));
workspacesRoutes.delete("/workspaces/:workspaceId/projects/:projectId", requireAdmin, handleAsync(async (req) => {
  await dissociateProjectFromWorkspace(req.params.workspaceId, req.params.projectId);
  return { deleted: true };
}));

// GET /workspaces/:id per dettaglio workspace (dopo tutte le route più specifiche)
workspacesRoutes.get("/workspaces/:id", handleAsync((req) => getWorkspaceById(req.params.id)));
