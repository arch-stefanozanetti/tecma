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
  getAdditionalInfoById,
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
import {
  listEffectiveWorkspaceEntitlements,
  listWorkspaceEntitlements,
  parseWorkspaceEntitlementFeature,
  upsertWorkspaceEntitlement,
} from "../../core/workspaces/workspace-entitlements.service.js";
import { getPriceAvailabilityMatrix } from "../../core/price-availability-matrix/price-availability-matrix.service.js";
import type { MembershipRole } from "../../types/models.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requireAdmin, requireTecmaAdmin } from "../authMiddleware.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { requireAnyPermission, requirePermission, requirePermissionOrTecmaAdmin } from "../permissionMiddleware.js";
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
  // route-guard: workspace-list-self-filtered (filtro membership in handler)
  handleAsync(async (req) => {
    const all = await listWorkspaces();
    const isAdmin = req.user?.isAdmin === true;
    const isTecma = req.user?.system_role === "tecma_admin" || req.user?.isTecmaAdmin === true;
    const email = typeof req.user?.email === "string" ? req.user.email : "";
    if (isAdmin || isTecma || !email) return all;
    const allowedIds = await listWorkspaceIdsForUser(email);
    const set = new Set(allowedIds);
    return all.filter((w) => set.has(w._id));
  })
);

workspacesRoutes.get(
  "/workspaces/:id/users",
  requireCanAccessWorkspace("id"),
  handleAsync((req) => listWorkspaceUsers(req.params.id))
);
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
  requireCanAccessWorkspace("id"),
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
  requireCanAccessWorkspace("id"),
  handleAsync((req) => listWorkspaceProjects(req.params.id).then((rows) => ({ data: rows })))
);

workspacesRoutes.get(
  "/workspaces/:workspaceId/price-availability",
  requireCanAccessWorkspace("workspaceId"),
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
  requireCanAccessWorkspace("workspaceId"),
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
  requireCanAccessWorkspace("id"),
  requirePermission(PERMISSIONS.SETTINGS_READ),
  handleAsync((req) => {
    const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
    return listEntityAssignmentsByUser(req.params.id, userId);
  })
);

workspacesRoutes.post(
  "/workspaces",
  requireAdmin,
  handleAsync(async (req) => {
    const result = await createWorkspace(req.body);
    const wid = result.workspace._id;
    safeAsync(
      auditRecord({
        action: "workspace.created",
        workspaceId: wid,
        entityType: "workspace",
        entityId: wid,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { name: result.workspace.name, owner_user_id: result.workspace.owner_user_id },
      }),
      { operation: "audit.workspace.created", workspaceId: wid, userId: req.user?.sub }
    );
    return result;
  })
);
workspacesRoutes.patch(
  "/workspaces/:id",
  requireAdmin,
  handleAsync(async (req) => {
    const id = req.params.id;
    const beforeSnap = await getWorkspaceById(id).catch(() => null);
    const result = await updateWorkspace(id, req.body);
    safeAsync(
      auditRecord({
        action: "workspace.updated",
        workspaceId: id,
        entityType: "workspace",
        entityId: id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: {
          before: beforeSnap
            ? { name: beforeSnap.workspace.name, owner_user_id: beforeSnap.workspace.owner_user_id }
            : undefined,
          after: { name: result.workspace.name, owner_user_id: result.workspace.owner_user_id },
        },
      }),
      { operation: "audit.workspace.updated", workspaceId: id, userId: req.user?.sub }
    );
    return result;
  })
);
workspacesRoutes.delete(
  "/workspaces/:id",
  requireAdmin,
  handleAsync(async (req) => {
    const id = req.params.id;
    const beforeSnap = await getWorkspaceById(id);
    await deleteWorkspace(id);
    safeAsync(
      auditRecord({
        action: "workspace.deleted",
        workspaceId: id,
        entityType: "workspace",
        entityId: id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { name: beforeSnap.workspace.name },
      }),
      { operation: "audit.workspace.deleted", workspaceId: id, userId: req.user?.sub }
    );
    return { deleted: true };
  })
);

workspacesRoutes.post(
  "/workspaces/projects/associate",
  requireAdmin,
  handleAsync(async (req) => {
    const result = await associateProjectToWorkspace(req.body);
    safeAsync(
      auditRecord({
        action: "workspace.project.linked",
        workspaceId: result.workspaceId,
        entityType: "workspace_project_link",
        entityId: `${result.workspaceId}:${result.projectId}`,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { projectId: result.projectId },
      }),
      { operation: "audit.workspace.project.linked", workspaceId: result.workspaceId, userId: req.user?.sub }
    );
    return result;
  })
);

workspacesRoutes.delete(
  "/workspaces/:workspaceId/projects/:projectId",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId;
    const projectId = req.params.projectId;
    await dissociateProjectFromWorkspace(workspaceId, projectId);
    safeAsync(
      auditRecord({
        action: "workspace.project.unlinked",
        workspaceId,
        entityType: "workspace_project_link",
        entityId: `${workspaceId}:${projectId}`,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { projectId },
      }),
      { operation: "audit.workspace.project.unlinked", workspaceId, userId: req.user?.sub }
    );
    return { deleted: true };
  })
);

workspacesRoutes.get(
  "/workspaces/:workspaceId/additional-infos",
  requireCanAccessWorkspace("workspaceId"),
  handleAsync((req) => listAdditionalInfos(req.params.workspaceId).then((rows) => ({ data: rows })))
);

workspacesRoutes.get(
  "/workspaces/:id",
  requireCanAccessWorkspace("id"),
  handleAsync((req) => getWorkspaceById(req.params.id))
);
workspacesRoutes.get(
  "/workspaces/:id/platform-api-keys",
  requireAdmin,
  handleAsync((req) => listPlatformApiKeys(req.params.id))
);
workspacesRoutes.post(
  "/workspaces/:id/platform-api-keys",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const result = await createPlatformApiKey(workspaceId, req.body);
    safeAsync(
      auditRecord({
        action: "workspace.platform_api_key.created",
        workspaceId,
        entityType: "platform_api_key",
        entityId: result.key._id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: {
          label: result.key.label,
          projectIdsCount: result.key.projectIds.length,
          scopesCount: result.key.scopes.length,
          apiKeyMasked: result.apiKeyMasked,
        },
      }),
      { operation: "audit.workspace.platform_api_key.created", workspaceId, userId: req.user?.sub }
    );
    return result;
  })
);
workspacesRoutes.post(
  "/workspaces/:id/platform-api-keys/:keyId/rotate",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const keyId = req.params.keyId;
    const result = await rotatePlatformApiKey(workspaceId, keyId);
    safeAsync(
      auditRecord({
        action: "workspace.platform_api_key.rotated",
        workspaceId,
        entityType: "platform_api_key",
        entityId: keyId,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { label: result.key.label, apiKeyMasked: result.apiKeyMasked },
      }),
      { operation: "audit.workspace.platform_api_key.rotated", workspaceId, userId: req.user?.sub }
    );
    return result;
  })
);
workspacesRoutes.delete(
  "/workspaces/:id/platform-api-keys/:keyId",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const keyId = req.params.keyId;
    const result = await revokePlatformApiKey(workspaceId, keyId);
    safeAsync(
      auditRecord({
        action: "workspace.platform_api_key.revoked",
        workspaceId,
        entityType: "platform_api_key",
        entityId: keyId,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      }),
      { operation: "audit.workspace.platform_api_key.revoked", workspaceId, userId: req.user?.sub }
    );
    return result;
  })
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
  "/workspaces/:id/entitlements",
  requirePermissionOrTecmaAdmin(PERMISSIONS.SETTINGS_READ),
  requireCanAccessWorkspace("id"),
  handleAsync((req) =>
    listEffectiveWorkspaceEntitlements(req.params.id).then((data) => ({ data }))
  )
);
workspacesRoutes.patch(
  "/workspaces/:id/entitlements/:feature",
  requireTecmaAdmin,
  requireCanAccessWorkspace("id"),
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const feature = parseWorkspaceEntitlementFeature(req.params.feature);
    if (!feature) throw new HttpError("Unknown entitlement feature", 400);
    const before = await listWorkspaceEntitlements(workspaceId);
    const prev = before.find((r) => r.feature === feature) ?? null;
    const row = await upsertWorkspaceEntitlement(workspaceId, feature, req.body);
    safeAsync(
      auditRecord({
        action: "workspace.entitlement.updated",
        workspaceId,
        entityType: "workspace_entitlement",
        entityId: `${workspaceId}:${feature}`,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: {
          feature,
          previousStatus: prev?.status ?? null,
          status: row.status,
          billingMode: row.billingMode,
        },
      }),
      { operation: "audit.workspace.entitlement.updated", workspaceId, userId: req.user?.sub }
    );
    return { entitlement: row };
  })
);

workspacesRoutes.get(
  "/workspaces/:id/ai-config",
  requireCanAccessWorkspace("id"),
  requirePermission(PERMISSIONS.SETTINGS_READ),
  handleAsync((req) => getWorkspaceAiConfig(req.params.id))
);
workspacesRoutes.put(
  "/workspaces/:id/ai-config",
  requireAdmin,
  handleAsync(async (req) => {
    const workspaceId = req.params.id;
    const body = req.body as { provider?: string; apiKey?: string };
    const result = await putWorkspaceAiConfig(workspaceId, req.body);
    safeAsync(
      auditRecord({
        action: "workspace.ai_config.updated",
        workspaceId,
        entityType: "workspace_ai_config",
        entityId: workspaceId,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: {
          configured: result.configured,
          provider: result.provider,
          apiKeyMasked: result.apiKeyMasked,
          hadApiKeyInRequest: typeof body.apiKey === "string" && body.apiKey.trim().length > 0,
        },
      }),
      { operation: "audit.workspace.ai_config.updated", workspaceId, userId: req.user?.sub }
    );
    return result;
  })
);

workspacesRoutes.post(
  "/additional-infos",
  requireAdmin,
  handleAsync(async (req) => {
    const { additionalInfo } = await createAdditionalInfo(req.body);
    safeAsync(
      auditRecord({
        action: "workspace.additional_info.created",
        workspaceId: additionalInfo.workspaceId,
        entityType: "additional_info",
        entityId: additionalInfo._id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { name: additionalInfo.name, type: additionalInfo.type, label: additionalInfo.label },
      }),
      { operation: "audit.workspace.additional_info.created", workspaceId: additionalInfo.workspaceId, userId: req.user?.sub }
    );
    return { additionalInfo };
  })
);
workspacesRoutes.patch(
  "/additional-infos/:id",
  requireAdmin,
  handleAsync(async (req) => {
    const { additionalInfo } = await updateAdditionalInfo(req.params.id, req.body);
    safeAsync(
      auditRecord({
        action: "workspace.additional_info.updated",
        workspaceId: additionalInfo.workspaceId,
        entityType: "additional_info",
        entityId: additionalInfo._id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { name: additionalInfo.name, type: additionalInfo.type, label: additionalInfo.label, active: additionalInfo.active },
      }),
      { operation: "audit.workspace.additional_info.updated", workspaceId: additionalInfo.workspaceId, userId: req.user?.sub }
    );
    return { additionalInfo };
  })
);
workspacesRoutes.delete(
  "/additional-infos/:id",
  requireAdmin,
  handleAsync(async (req) => {
    const id = req.params.id;
    const existing = await getAdditionalInfoById(id);
    if (!existing) throw new HttpError("Not found", 404);
    await deleteAdditionalInfo(id);
    safeAsync(
      auditRecord({
        action: "workspace.additional_info.deleted",
        workspaceId: existing.workspaceId,
        entityType: "additional_info",
        entityId: id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { name: existing.name, label: existing.label },
      }),
      { operation: "audit.workspace.additional_info.deleted", workspaceId: existing.workspaceId, userId: req.user?.sub }
    );
    return { deleted: true };
  })
);
