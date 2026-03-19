import { Router } from "express";
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
import {
  listByWorkspace as listAdditionalInfos,
  createAdditionalInfo,
  updateAdditionalInfo,
  deleteAdditionalInfo,
} from "../../core/additional-infos/additional-infos.service.js";
import {
  createPlatformApiKey,
  getPlatformUsageSummary,
  listPlatformApiKeys,
  revokePlatformApiKey,
  rotatePlatformApiKey,
} from "../../core/platform/platform-api-keys.service.js";
import {
  getWorkspaceAiConfig,
  putWorkspaceAiConfig,
} from "../../core/workspaces/workspace-ai-config.service.js";
import { getPriceAvailabilityMatrix } from "../../core/price-availability-matrix/price-availability-matrix.service.js";
import type { MembershipRole } from "../../types/models.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requireAdmin } from "../authMiddleware.js";

/** Mappa ruoli API (vendor, vendor_manager, admin) a MembershipRole. */
function toMembershipRole(r: string | undefined): MembershipRole {
  if (!r) return "collaborator";
  const lower = r.toLowerCase();
  if (lower === "vendor_manager") return "admin";
  if (lower === "vendor") return "collaborator";
  if (lower === "admin" || lower === "owner" || lower === "viewer") return lower;
  return "collaborator";
}

export const workspacesRoutes = Router();

workspacesRoutes.get(
  "/workspaces",
  handleAsync(async (req) => {
    const all = await listWorkspaces();
    const isAdmin = req.user?.isAdmin === true;
    const email = typeof req.user?.email === "string" ? req.user.email : "";
    if (isAdmin || !email) return all;
    const allowedIds = await listWorkspaceIdsForUser(email);
    const set = new Set(allowedIds);
    return all.filter((w) => set.has(w._id));
  })
);

workspacesRoutes.get("/workspaces/:id/users", handleAsync((req) => listWorkspaceUsers(req.params.id)));
workspacesRoutes.post(
  "/workspaces/:id/users",
  requireAdmin,
  handleAsync((req) => {
    const body = req.body as { userId?: string; role?: string };
    return addWorkspaceUser(req.params.id, {
      userId: body.userId ?? "",
      role: toMembershipRole(body.role ?? "vendor"),
    });
  })
);

workspacesRoutes.patch(
  "/workspaces/:id/users/:userId",
  requireAdmin,
  handleAsync((req) => {
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    const body = req.body as { role?: string };
    return updateWorkspaceUser(req.params.id, userId, {
      role: body.role !== undefined ? toMembershipRole(body.role) : undefined,
    });
  })
);

workspacesRoutes.delete(
  "/workspaces/:id/users/:userId",
  requireAdmin,
  handleAsync((req) => {
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    return removeWorkspaceUser(req.params.id, userId);
  })
);

workspacesRoutes.get(
  "/workspaces/:id/users/:userId/projects",
  handleAsync((req) => {
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    return listWorkspaceUserProjects(req.params.id, userId);
  })
);

workspacesRoutes.post(
  "/workspaces/:id/users/:userId/projects",
  requireAdmin,
  handleAsync((req) => {
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    const body = req.body as { projectId?: string };
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    return addWorkspaceUserProject(req.params.id, userId, projectId);
  })
);

workspacesRoutes.delete(
  "/workspaces/:id/users/:userId/projects/:projectId",
  requireAdmin,
  handleAsync((req) => {
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    const projectId = typeof req.params.projectId === "string" ? decodeURIComponent(req.params.projectId) : "";
    return removeWorkspaceUserProject(req.params.id, userId, projectId);
  })
);

workspacesRoutes.get(
  "/workspaces/:id/projects",
  handleAsync((req) => listWorkspaceProjects(req.params.id).then((rows) => ({ data: rows })))
);

workspacesRoutes.get(
  "/workspaces/:workspaceId/price-availability",
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId;
    const projectIdsRaw = req.query.projectIds;
    const projectIds =
      typeof projectIdsRaw === "string"
        ? projectIdsRaw
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : [];

    const from = (req.query.from as string) ?? "";
    const to = (req.query.to as string) ?? "";
    if (!from || !to) throw new HttpError("query from and to (YYYY-MM-DD) required", 400);
    if (projectIds.length === 0) throw new HttpError("projectIds required (comma-separated)", 400);
    return getPriceAvailabilityMatrix(workspaceId, projectIds, from, to);
  })
);

workspacesRoutes.get(
  "/workspaces/:workspaceId/entities/:entityType/:entityId/assignments",
  handleAsync((req) => {
    const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
    const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
    return listEntityAssignments(req.params.workspaceId, entityType, entityId);
  })
);

workspacesRoutes.post(
  "/workspaces/:workspaceId/entities/:entityType/:entityId/assignments",
  requireAdmin,
  handleAsync((req) => {
    const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
    const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
    const body = req.body as { userId?: string };
    const userId = typeof body.userId === "string" ? body.userId : "";
    return assignEntity(req.params.workspaceId, entityType, entityId, userId);
  })
);

workspacesRoutes.delete(
  "/workspaces/:workspaceId/entities/:entityType/:entityId/assignments/:userId",
  requireAdmin,
  handleAsync((req) => {
    const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
    const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    return unassignEntity(req.params.workspaceId, entityType, entityId, userId);
  })
);

workspacesRoutes.get(
  "/workspaces/:id/users/:userId/assignments",
  handleAsync((req) => {
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    return listEntityAssignmentsByUser(req.params.id, userId);
  })
);

workspacesRoutes.post("/workspaces", requireAdmin, handleAsync((req) => createWorkspace(req.body)));
workspacesRoutes.patch("/workspaces/:id", requireAdmin, handleAsync((req) => updateWorkspace(req.params.id, req.body)));
workspacesRoutes.delete(
  "/workspaces/:id",
  requireAdmin,
  handleAsync(async (req) => {
    await deleteWorkspace(req.params.id);
    return { deleted: true };
  })
);

workspacesRoutes.post(
  "/workspaces/projects/associate",
  requireAdmin,
  handleAsync((req) => associateProjectToWorkspace(req.body))
);

workspacesRoutes.delete(
  "/workspaces/:workspaceId/projects/:projectId",
  requireAdmin,
  handleAsync(async (req) => {
    await dissociateProjectFromWorkspace(req.params.workspaceId, req.params.projectId);
    return { deleted: true };
  })
);

workspacesRoutes.get(
  "/workspaces/:workspaceId/additional-infos",
  handleAsync((req) => listAdditionalInfos(req.params.workspaceId).then((rows) => ({ data: rows })))
);

workspacesRoutes.get("/workspaces/:id", handleAsync((req) => getWorkspaceById(req.params.id)));
workspacesRoutes.get(
  "/workspaces/:id/platform-api-keys",
  requireAdmin,
  handleAsync((req) => listPlatformApiKeys(req.params.id))
);
workspacesRoutes.post(
  "/workspaces/:id/platform-api-keys",
  requireAdmin,
  handleAsync((req) => createPlatformApiKey(req.params.id, req.body))
);
workspacesRoutes.post(
  "/workspaces/:id/platform-api-keys/:keyId/rotate",
  requireAdmin,
  handleAsync((req) => rotatePlatformApiKey(req.params.id, req.params.keyId))
);
workspacesRoutes.delete(
  "/workspaces/:id/platform-api-keys/:keyId",
  requireAdmin,
  handleAsync((req) => revokePlatformApiKey(req.params.id, req.params.keyId))
);
workspacesRoutes.get(
  "/workspaces/:id/platform-api-keys/usage",
  requireAdmin,
  handleAsync((req) => {
    const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
    return getPlatformUsageSummary(req.params.id, dateFrom, dateTo);
  })
);

workspacesRoutes.get(
  "/workspaces/:id/ai-config",
  handleAsync((req) => getWorkspaceAiConfig(req.params.id))
);
workspacesRoutes.put(
  "/workspaces/:id/ai-config",
  requireAdmin,
  handleAsync((req) => putWorkspaceAiConfig(req.params.id, req.body))
);

workspacesRoutes.post("/additional-infos", requireAdmin, handleAsync((req) => createAdditionalInfo(req.body)));
workspacesRoutes.patch("/additional-infos/:id", requireAdmin, handleAsync((req) => updateAdditionalInfo(req.params.id, req.body)));
workspacesRoutes.delete("/additional-infos/:id", requireAdmin, handleAsync((req) => deleteAdditionalInfo(req.params.id)));
