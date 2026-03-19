import { Router } from "express";
import { z } from "zod";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import {
  listByWorkspace as listAutomationRules,
  create as createAutomationRule,
  getById as getAutomationRuleById,
  update as updateAutomationRule,
  remove as removeAutomationRule,
} from "../../core/automations/automation-rules.service.js";

export const automationRulesRoutes = Router();

automationRulesRoutes.get("/workspaces/:workspaceId/automation-rules", handleAsync(async (req) => {
  const rules = await listAutomationRules(req.params.workspaceId);
  return { data: rules };
}));

automationRulesRoutes.post("/workspaces/:workspaceId/automation-rules", handleAsync(async (req) => {
  const body = z.record(z.unknown()).parse(req.body);
  const rule = await createAutomationRule({ ...body, workspaceId: req.params.workspaceId });
  return { rule };
}));

automationRulesRoutes.get("/automation-rules/:id", handleAsync(async (req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  if (!workspaceId) throw new HttpError("workspaceId query required", 400, { code: "WORKSPACE_REQUIRED" });
  const rule = await getAutomationRuleById(req.params.id, workspaceId);
  if (!rule) throw new HttpError("Rule not found", 404);
  return { rule };
}));

automationRulesRoutes.patch("/automation-rules/:id", handleAsync(async (req) => {
  const workspaceId = typeof req.body?.workspaceId === "string" ? req.body.workspaceId.trim() : "";
  if (!workspaceId) throw new HttpError("workspaceId required in body", 400, { code: "WORKSPACE_REQUIRED" });
  const rule = await updateAutomationRule(req.params.id, req.body, workspaceId);
  if (!rule) throw new HttpError("Rule not found", 404);
  return { rule };
}));

automationRulesRoutes.delete("/automation-rules/:id", handleAsync(async (req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  if (!workspaceId) throw new HttpError("workspaceId query required", 400, { code: "WORKSPACE_REQUIRED" });
  const ok = await removeAutomationRule(req.params.id, workspaceId);
  if (!ok) throw new HttpError("Rule not found", 404);
  return { deleted: true };
}));
