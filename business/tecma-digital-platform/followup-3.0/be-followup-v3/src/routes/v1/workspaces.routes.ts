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
import { requireAnyPermission, requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { record as auditRecord } from "../../core/audit/audit-log.service.js";
import { safeAsync } from "../../core/shared/safeAsync.js";

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
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const body = req.body as { userId?: string; role?: string };
    const userId = body.userId ?? "";
    const role = toMembershipRole(body.role ?? "vendor");
    const result = await addWorkspaceUser(workspaceId, { userId, role });
    safeAsync(
      auditRecord({
        action: "workspace.membership.created",
        workspaceId,
        entityType: "workspace_membership",
        entityId: userId,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { role },
      }),
      { operation: "audit.workspace.membership.created", workspaceId, entityId: userId, userId: req.user?.sub }
    );
    return result;
  })
);

workspacesRoutes.patch(
  "/workspaces/:id/users/:userId",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    const body = req.body as { role?: string };
    const role = body.role !== undefined ? toMembershipRole(body.role) : undefined;
    const result = await updateWorkspaceUser(workspaceId, userId, { role });
    safeAsync(
      auditRecord({
        action: "workspace.membership.updated",
        workspaceId,
        entityType: "workspace_membership",
        entityId: userId,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: role !== undefined ? { role } : {},
      }),
      { operation: "audit.workspace.membership.updated", workspaceId, entityId: userId, userId: req.user?.sub }
    );
    return result;
  })
);

workspacesRoutes.delete(
  "/workspaces/:id/users/:userId",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    const result = await removeWorkspaceUser(workspaceId, userId);
    safeAsync(
      auditRecord({
        action: "workspace.membership.removed",
        workspaceId,
        entityType: "workspace_membership",
        entityId: userId,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      }),
      { operation: "audit.workspace.membership.removed", workspaceId, entityId: userId, userId: req.user?.sub }
    );
    return result;
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
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    const body = req.body as { projectId?: string };
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const result = await addWorkspaceUserProject(workspaceId, userId, projectId);
    safeAsync(
      auditRecord({
        action: "workspace.user_project.added",
        workspaceId,
        projectId,
        entityType: "workspace_user_project",
        entityId: `${userId}:${projectId}`,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { targetUserId: userId, projectId },
      }),
      { operation: "audit.workspace.user_project.added", workspaceId, userId: req.user?.sub }
    );
    return result;
  })
);

workspacesRoutes.delete(
  "/workspaces/:id/users/:userId/projects/:projectId",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    const projectId = typeof req.params.projectId === "string" ? decodeURIComponent(req.params.projectId) : "";
    const result = await removeWorkspaceUserProject(workspaceId, userId, projectId);
    safeAsync(
      auditRecord({
        action: "workspace.user_project.removed",
        workspaceId,
        projectId,
        entityType: "workspace_user_project",
        entityId: `${userId}:${projectId}`,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { targetUserId: userId, projectId },
      }),
      { operation: "audit.workspace.user_project.removed", workspaceId, userId: req.user?.sub }
    );
    return result;
  })
);

workspacesRoutes.get(
  "/workspaces/:id/projects",
  handleAsync((req) => listWorkspaceProjects(req.params.id).then((rows) => ({ data: rows })))
);

workspacesRoutes.get(
  "/workspaces/:workspaceId/price-availability",
  requirePermission(PERMISSIONS.APARTMENTS_READ),
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
  requireAnyPermission(
    PERMISSIONS.CLIENTS_READ,
    PERMISSIONS.APARTMENTS_READ,
    PERMISSIONS.REQUESTS_READ
  ),
  handleAsync((req) => {
    const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
    const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
    return listEntityAssignments(req.params.workspaceId, entityType, entityId);
  })
);

workspacesRoutes.post(
  "/workspaces/:workspaceId/entities/:entityType/:entityId/assignments",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId;
    const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
    const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
    const body = req.body as { userId?: string };
    const userId = typeof body.userId === "string" ? body.userId : "";
    const result = await assignEntity(workspaceId, entityType, entityId, userId);
    safeAsync(
      auditRecord({
        action: "workspace.entity.assigned",
        workspaceId,
        entityType: "entity_assignment",
        entityId: `${entityType}:${entityId}:${userId}`,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { resourceEntityType: entityType, resourceEntityId: entityId, targetUserId: userId },
      }),
      { operation: "audit.workspace.entity.assigned", workspaceId, userId: req.user?.sub }
    );
    return result;
  })
);

workspacesRoutes.delete(
  "/workspaces/:workspaceId/entities/:entityType/:entityId/assignments/:userId",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId;
    const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
    const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    const result = await unassignEntity(workspaceId, entityType, entityId, userId);
    safeAsync(
      auditRecord({
        action: "workspace.entity.unassigned",
        workspaceId,
        entityType: "entity_assignment",
        entityId: `${entityType}:${entityId}:${userId}`,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { resourceEntityType: entityType, resourceEntityId: entityId, targetUserId: userId },
      }),
      { operation: "audit.workspace.entity.unassigned", workspaceId, userId: req.user?.sub }
    );
    return result;
  })
);

workspacesRoutes.get(
  "/workspaces/:id/users/:userId/assignments",
  requirePermission(PERMISSIONS.SETTINGS_READ),
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
  requirePermission(PERMISSIONS.SETTINGS_READ),
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
