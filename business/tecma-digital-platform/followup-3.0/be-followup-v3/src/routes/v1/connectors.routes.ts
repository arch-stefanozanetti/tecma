import { Router } from "express";
import { z } from "zod";
import { getN8nConfig, saveN8nConfig, triggerN8nWorkflow, deleteN8nConfig } from "../../core/connectors/n8n.service.js";
import {
  getWhatsAppConfig,
  saveWhatsAppConfig,
  deleteWhatsAppConfig,
} from "../../core/connectors/whatsapp-config.service.js";
import {
  getMetaWhatsAppConfig,
  saveMetaWhatsAppConfig,
  deleteMetaWhatsAppConfig,
} from "../../core/connectors/meta-whatsapp-config.service.js";
import { sendWhatsAppMessage } from "../../core/communications/whatsapp.service.js";
import { sendWithMessagingGateway } from "../../core/messaging/messaging-gateway.service.js";
import {
  getAuthUrl,
  getCalendarEvents,
  hasOutlookConnected,
  deleteOutlookCredentials,
} from "../../core/connectors/outlook.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync, sendError } from "../asyncHandler.js";
import { requireAdmin } from "../authMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";

export const connectorsRoutes = Router();

connectorsRoutes.get("/workspaces/:workspaceId/connectors/n8n/config", requirePermission(PERMISSIONS.INTEGRATIONS_READ), handleAsync(async (req) => {
  const config = await getN8nConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/n8n/config", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), handleAsync(async (req) => {
  const body = z.object({
    baseUrl: z.string().min(1),
    apiKey: z.string().min(1),
    defaultWorkflowId: z.string().optional(),
  }).parse(req.body);
  const config = await saveN8nConfig(req.params.workspaceId, body);
  return { config };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/n8n/trigger", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), handleAsync(async (req) => {
  const body = z.object({
    workflowId: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  }).parse(req.body ?? {});
  const result = await triggerN8nWorkflow(req.params.workspaceId, body.workflowId, body.data ?? {});
  return result;
}));
connectorsRoutes.delete("/workspaces/:workspaceId/connectors/n8n/config", requirePermission(PERMISSIONS.INTEGRATIONS_DELETE), handleAsync(async (req) => {
  const deleted = await deleteN8nConfig(req.params.workspaceId);
  return { deleted };
}));

connectorsRoutes.get("/workspaces/:workspaceId/connectors/whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_READ), handleAsync(async (req) => {
  const config = await getWhatsAppConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), handleAsync(async (req) => {
  const body = z.object({
    accountSid: z.string().min(1),
    authToken: z.string().min(1),
    fromNumber: z.string().min(1),
  }).parse(req.body);
  const config = await saveWhatsAppConfig(req.params.workspaceId, body);
  return { config };
}));
connectorsRoutes.delete("/workspaces/:workspaceId/connectors/whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_DELETE), handleAsync(async (req) => {
  const deleted = await deleteWhatsAppConfig(req.params.workspaceId);
  return { deleted };
}));

/** Solo admin (o permesso *): invia un messaggio di prova (verifica Twilio + prefisso whatsapp:). */
connectorsRoutes.post("/workspaces/:workspaceId/connectors/whatsapp/test", requireAdmin, handleAsync(async (req) => {
  const body = z.object({
    to: z.string().min(5),
    body: z.string().max(1600).optional(),
  }).parse(req.body ?? {});
  const text = body.body?.trim() || "Followup 3.0 — messaggio di prova WhatsApp.";
  await sendWhatsAppMessage(req.params.workspaceId, body.to, text);
  return { ok: true };
}));

connectorsRoutes.get("/workspaces/:workspaceId/connectors/meta-whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_READ), handleAsync(async (req) => {
  const config = await getMetaWhatsAppConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/meta-whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), handleAsync(async (req) => {
  const body = z
    .object({
      phoneNumberId: z.string().min(1),
      accessToken: z.string().min(1),
    })
    .parse(req.body);
  const config = await saveMetaWhatsAppConfig(req.params.workspaceId, body);
  return { config };
}));
connectorsRoutes.delete("/workspaces/:workspaceId/connectors/meta-whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_DELETE), handleAsync(async (req) => {
  const deleted = await deleteMetaWhatsAppConfig(req.params.workspaceId);
  return { deleted };
}));

/** Admin: prova invio template Meta (WhatsApp Cloud API). */
connectorsRoutes.post("/workspaces/:workspaceId/connectors/meta-whatsapp/test", requireAdmin, handleAsync(async (req) => {
  const body = z
    .object({
      to: z.string().min(5),
      templateName: z.string().min(1),
      languageCode: z.string().min(1),
      bodyParameters: z.array(z.string()).optional(),
    })
    .parse(req.body ?? {});
  const result = await sendWithMessagingGateway({
    workspaceId: req.params.workspaceId,
    channel: "whatsapp",
    to: body.to,
    body: "",
    whatsappTemplate: {
      name: body.templateName,
      languageCode: body.languageCode,
      bodyParameterValues: body.bodyParameters ?? [],
    },
  });
  if (!result.ok) {
    throw new HttpError(result.errorMessage ?? "Invio Meta WhatsApp fallito", 502);
  }
  return { ok: true, externalId: result.externalId };
}));

connectorsRoutes.get("/connectors/outlook/auth", requirePermission(PERMISSIONS.INTEGRATIONS_READ), (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    sendError(res, new HttpError("Unauthorized", 401));
    return;
  }
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const { redirectUri } = (() => {
    const uri = process.env.OUTLOOK_REDIRECT_URI;
    if (!uri) throw new HttpError("Outlook connector not configured (OUTLOOK_REDIRECT_URI)", 503);
    return { redirectUri: uri };
  })();
  const url = getAuthUrl(redirectUri, { userId, workspaceId });
  res.redirect(302, url);
});
connectorsRoutes.get("/connectors/outlook/calendar/events", requirePermission(PERMISSIONS.INTEGRATIONS_READ), handleAsync(async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw new HttpError("Unauthorized", 401);
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : "";
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : "";
  if (!dateFrom || !dateTo) throw new HttpError("dateFrom and dateTo query params required (ISO datetime)", 400);
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const events = await getCalendarEvents(userId, dateFrom, dateTo, workspaceId);
  return { data: events };
}));
connectorsRoutes.get("/connectors/outlook/status", requirePermission(PERMISSIONS.INTEGRATIONS_READ), handleAsync(async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw new HttpError("Unauthorized", 401);
  const connected = await hasOutlookConnected(userId);
  return { connected };
}));
connectorsRoutes.delete("/connectors/outlook", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), handleAsync(async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw new HttpError("Unauthorized", 401);
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const deleted = await deleteOutlookCredentials(userId, workspaceId);
  return { deleted };
}));
