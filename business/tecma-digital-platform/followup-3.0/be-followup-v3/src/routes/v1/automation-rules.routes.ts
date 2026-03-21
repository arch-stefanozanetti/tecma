import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { requireWorkspaceEntitled } from "../workspaceEntitlementMiddleware.js";

const entitledIntegrationsWs = requireWorkspaceEntitled("integrations", (req) => req.params.workspaceId);
import {
  listByWorkspace as listAutomationRules,
  create as createAutomationRule,
  getById as getAutomationRuleById,
  update as updateAutomationRule,
  remove as removeAutomationRule,
} from "../../core/automations/automation-rules.service.js";

export const automationRulesRoutes = Router();

automationRulesRoutes.get("/workspaces/:workspaceId/automation-rules", requirePermission(PERMISSIONS.INTEGRATIONS_READ), entitledIntegrationsWs, handleAsync(async (req) => {
  const rules = await listAutomationRules(req.params.workspaceId);
  return { data: rules };
}));

automationRulesRoutes.post("/workspaces/:workspaceId/automation-rules", requirePermission(PERMISSIONS.INTEGRATIONS_CREATE), entitledIntegrationsWs, handleAsync(async (req) => {
  const body = z.record(z.unknown()).parse(req.body);
  const rule = await createAutomationRule({ ...body, workspaceId: req.params.workspaceId });
  return { rule };
}));

automationRulesRoutes.get("/automation-rules/:id", requirePermission(PERMISSIONS.INTEGRATIONS_READ), handleAsync(async (req) => {
  const rule = await getAutomationRuleById(req.params.id);
  if (!rule) throw new HttpError("Rule not found", 404);
  return { rule };
}));

automationRulesRoutes.patch("/automation-rules/:id", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), handleAsync(async (req) => {
  const rule = await updateAutomationRule(req.params.id, req.body);
  if (!rule) throw new HttpError("Rule not found", 404);
  return { rule };
}));

automationRulesRoutes.delete("/automation-rules/:id", requirePermission(PERMISSIONS.INTEGRATIONS_DELETE), handleAsync(async (req) => {
  const ok = await removeAutomationRule(req.params.id);
  if (!ok) throw new HttpError("Rule not found", 404);
  return { deleted: true };
}));
