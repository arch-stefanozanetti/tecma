import { Router, type Request, type RequestHandler } from "express";
import { canAccess, type AccessUser } from "../../core/access/canAccess.js";
import { HttpError } from "../../types/http.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { handleAsync, sendError } from "../asyncHandler.js";
import { requirePermission } from "../permissionMiddleware.js";
import { requireWorkspaceEntitled } from "../workspaceEntitlementMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { record as auditRecord } from "../../core/audit/audit-log.service.js";
import { safeAsync } from "../../core/shared/safeAsync.js";
import {
  listByWorkspace,
  create,
  update,
  remove,
  getById,
} from "../../core/automations/webhook-configs.service.js";

export const webhookConfigsRoutes = Router();

const entitledIntegrationsWs = requireWorkspaceEntitled("integrations", (req) => req.params.workspaceId);

function accessUserFromReq(req: Request): AccessUser | null {
  const u = req.user;
  if (!u) return null;
  return {
    sub: u.sub,
    email: u.email ?? "",
    system_role: u.system_role ?? undefined,
    isTecmaAdmin: u.isTecmaAdmin,
  };
}

/** Verifica membership sul workspace del documento webhook (param :id). */
export function requireAccessToWebhookConfigById(): RequestHandler {
  return async (req, res, next) => {
    const user = accessUserFromReq(req);
    if (!user) {
      sendError(res, new HttpError("Unauthorized", 401));
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      sendError(res, new HttpError("id required", 400));
      return;
    }
    const existing = await getById(id);
    if (!existing) {
      sendError(res, new HttpError("Webhook config not found", 404));
      return;
    }
    const ok = await canAccess(user, { type: "workspace", workspaceId: existing.workspaceId });
    if (!ok) {
      sendError(res, new HttpError("Accesso al workspace non consentito", 403));
      return;
    }
    next();
  };
}

webhookConfigsRoutes.get(
  "/workspaces/:workspaceId/webhook-configs",
  requireCanAccessWorkspace("workspaceId"),
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsWs,
  handleAsync(async (req) => {
    const data = await listByWorkspace(req.params.workspaceId);
    return { data };
  })
);

webhookConfigsRoutes.post(
  "/workspaces/:workspaceId/webhook-configs",
  requireCanAccessWorkspace("workspaceId"),
  requirePermission(PERMISSIONS.INTEGRATIONS_CREATE),
  entitledIntegrationsWs,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId;
    const config = await create({ ...req.body, workspaceId });
    safeAsync(
      auditRecord({
        action: "workspace.webhook_config.created",
        workspaceId,
        entityType: "webhook_config",
        entityId: config._id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: {
          connectorId: config.connectorId,
          eventsCount: config.events.length,
          enabled: config.enabled,
        },
      }),
      { operation: "audit.workspace.webhook_config.created", workspaceId, userId: req.user?.sub }
    );
    return { config };
  })
);

webhookConfigsRoutes.patch(
  "/webhook-configs/:id",
  requireAccessToWebhookConfigById(),
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  handleAsync(async (req) => {
    const config = await update(req.params.id, req.body);
    if (!config) throw new HttpError("Webhook config not found", 404);
    safeAsync(
      auditRecord({
        action: "workspace.webhook_config.updated",
        workspaceId: config.workspaceId,
        entityType: "webhook_config",
        entityId: config._id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: {
          connectorId: config.connectorId,
          eventsCount: config.events.length,
          enabled: config.enabled,
        },
      }),
      { operation: "audit.workspace.webhook_config.updated", workspaceId: config.workspaceId, userId: req.user?.sub }
    );
    return { config };
  })
);

webhookConfigsRoutes.delete(
  "/webhook-configs/:id",
  requireAccessToWebhookConfigById(),
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  handleAsync(async (req) => {
    const id = req.params.id;
    const existing = await getById(id);
    if (!existing) throw new HttpError("Webhook config not found", 404);
    const ok = await remove(id);
    if (!ok) throw new HttpError("Webhook config not found", 404);
    safeAsync(
      auditRecord({
        action: "workspace.webhook_config.deleted",
        workspaceId: existing.workspaceId,
        entityType: "webhook_config",
        entityId: id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { connectorId: existing.connectorId },
      }),
      { operation: "audit.workspace.webhook_config.deleted", workspaceId: existing.workspaceId, userId: req.user?.sub }
    );
    return { deleted: true };
  })
);
