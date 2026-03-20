import { Router } from "express";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import {
  listByWorkspace,
  create,
  update,
  remove,
} from "../../core/automations/webhook-configs.service.js";

export const webhookConfigsRoutes = Router();

webhookConfigsRoutes.get(
  "/workspaces/:workspaceId/webhook-configs",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  handleAsync(async (req) => {
    const data = await listByWorkspace(req.params.workspaceId);
    return { data };
  })
);

webhookConfigsRoutes.post(
  "/workspaces/:workspaceId/webhook-configs",
  requirePermission(PERMISSIONS.INTEGRATIONS_CREATE),
  handleAsync(async (req) => {
    const config = await create({ ...req.body, workspaceId: req.params.workspaceId });
    return { config };
  })
);

webhookConfigsRoutes.patch(
  "/webhook-configs/:id",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  handleAsync(async (req) => {
    const config = await update(req.params.id, req.body);
    if (!config) throw new HttpError("Webhook config not found", 404);
    return { config };
  })
);

webhookConfigsRoutes.delete(
  "/webhook-configs/:id",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  handleAsync(async (req) => {
    const ok = await remove(req.params.id);
    if (!ok) throw new HttpError("Webhook config not found", 404);
    return { deleted: true };
  })
);
