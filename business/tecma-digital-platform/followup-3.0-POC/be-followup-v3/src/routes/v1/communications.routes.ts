import { Router } from "express";
import { z } from "zod";
import {
  listByWorkspace as listCommunicationTemplates,
  create as createCommunicationTemplate,
  getById as getCommunicationTemplateById,
  update as updateCommunicationTemplate,
  remove as removeCommunicationTemplate,
} from "../../core/communications/templates.service.js";
import {
  listByWorkspace as listCommunicationRules,
  create as createCommunicationRule,
  getById as getCommunicationRuleById,
  update as updateCommunicationRule,
  remove as removeCommunicationRule,
} from "../../core/communications/communication-rules.service.js";
import { listByWorkspace as listCommunicationDeliveries } from "../../core/communications/communication-deliveries.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { requireWorkspaceEntitled } from "../workspaceEntitlementMiddleware.js";

const entitledIntegrationsWs = requireWorkspaceEntitled("integrations", (req) => req.params.workspaceId);

export const communicationsRoutes = Router();

communicationsRoutes.get("/workspaces/:workspaceId/communication-templates", requirePermission(PERMISSIONS.INTEGRATIONS_READ), entitledIntegrationsWs, handleAsync(async (req) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const channelRaw = typeof req.query.channel === "string" ? req.query.channel : undefined;
  const channel = channelRaw && ["email", "whatsapp", "sms", "in_app"].includes(channelRaw) ? (channelRaw as "email" | "whatsapp" | "sms" | "in_app") : undefined;
  const data = await listCommunicationTemplates(req.params.workspaceId, { projectId, channel });
  return { data };
}));
communicationsRoutes.post("/workspaces/:workspaceId/communication-templates", requirePermission(PERMISSIONS.INTEGRATIONS_CREATE), entitledIntegrationsWs, handleAsync(async (req) => {
  const body = z.object({
    projectId: z.string().optional(),
    channel: z.enum(["email", "whatsapp", "sms", "in_app"]),
    name: z.string().min(1),
    subject: z.string().optional(),
    bodyText: z.string().min(1),
    bodyHtml: z.string().optional(),
    variables: z.array(z.string()).optional(),
    metaTemplateName: z.string().max(512).optional(),
    metaTemplateLanguage: z.string().max(32).optional(),
  }).parse(req.body);
  const template = await createCommunicationTemplate({
    ...body,
    workspaceId: req.params.workspaceId,
    variables: body.variables ?? [],
  });
  return { template };
}));
communicationsRoutes.get("/communication-templates/:id", requirePermission(PERMISSIONS.INTEGRATIONS_READ), handleAsync(async (req) => {
  const template = await getCommunicationTemplateById(req.params.id);
  if (!template) throw new HttpError("Template not found", 404);
  return { template };
}));
communicationsRoutes.patch("/communication-templates/:id", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), handleAsync(async (req) => {
  const template = await updateCommunicationTemplate(req.params.id, req.body);
  if (!template) throw new HttpError("Template not found", 404);
  return { template };
}));
communicationsRoutes.delete("/communication-templates/:id", requirePermission(PERMISSIONS.INTEGRATIONS_DELETE), handleAsync(async (req) => {
  const ok = await removeCommunicationTemplate(req.params.id);
  if (!ok) throw new HttpError("Template not found", 404);
  return { deleted: true };
}));
communicationsRoutes.get("/workspaces/:workspaceId/communication-rules", requirePermission(PERMISSIONS.INTEGRATIONS_READ), entitledIntegrationsWs, handleAsync(async (req) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const data = await listCommunicationRules(req.params.workspaceId, { projectId });
  return { data };
}));
communicationsRoutes.get("/workspaces/:workspaceId/communication-deliveries", requirePermission(PERMISSIONS.INTEGRATIONS_READ), entitledIntegrationsWs, handleAsync(async (req) => {
  const limit = typeof req.query.limit === "string" ? Math.min(100, parseInt(req.query.limit, 10) || 50) : 50;
  const data = await listCommunicationDeliveries(req.params.workspaceId, limit);
  return { data };
}));
communicationsRoutes.post("/workspaces/:workspaceId/communication-rules", requirePermission(PERMISSIONS.INTEGRATIONS_CREATE), entitledIntegrationsWs, handleAsync(async (req) => {
  const body = z.record(z.unknown()).parse(req.body);
  const rule = await createCommunicationRule({ ...body, workspaceId: req.params.workspaceId } as Parameters<typeof createCommunicationRule>[0]);
  return { rule };
}));
communicationsRoutes.get("/communication-rules/:id", requirePermission(PERMISSIONS.INTEGRATIONS_READ), handleAsync(async (req) => {
  const rule = await getCommunicationRuleById(req.params.id);
  if (!rule) throw new HttpError("Communication rule not found", 404);
  return { rule };
}));
communicationsRoutes.patch("/communication-rules/:id", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), handleAsync(async (req) => {
  const rule = await updateCommunicationRule(req.params.id, req.body);
  if (!rule) throw new HttpError("Communication rule not found", 404);
  return { rule };
}));
communicationsRoutes.delete("/communication-rules/:id", requirePermission(PERMISSIONS.INTEGRATIONS_DELETE), handleAsync(async (req) => {
  const ok = await removeCommunicationRule(req.params.id);
  if (!ok) throw new HttpError("Communication rule not found", 404);
  return { deleted: true };
}));
