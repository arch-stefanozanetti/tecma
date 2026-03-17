import { Router } from "express";
import { z } from "zod";
import { getN8nConfig, saveN8nConfig, triggerN8nWorkflow, deleteN8nConfig } from "../../core/connectors/n8n.service.js";
import {
  getWhatsAppConfig,
  saveWhatsAppConfig,
  deleteWhatsAppConfig,
} from "../../core/connectors/whatsapp-config.service.js";
import {
  getAuthUrl,
  getCalendarEvents,
  hasOutlookConnected,
  deleteOutlookCredentials,
} from "../../core/connectors/outlook.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync, sendError } from "../asyncHandler.js";

export const connectorsRoutes = Router();

connectorsRoutes.get("/workspaces/:workspaceId/connectors/n8n/config", handleAsync(async (req) => {
  const config = await getN8nConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/n8n/config", handleAsync(async (req) => {
  const body = z.object({
    baseUrl: z.string().min(1),
    apiKey: z.string().min(1),
    defaultWorkflowId: z.string().optional(),
  }).parse(req.body);
  const config = await saveN8nConfig(req.params.workspaceId, body);
  return { config };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/n8n/trigger", handleAsync(async (req) => {
  const body = z.object({
    workflowId: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  }).parse(req.body ?? {});
  const result = await triggerN8nWorkflow(req.params.workspaceId, body.workflowId, body.data ?? {});
  return result;
}));
connectorsRoutes.delete("/workspaces/:workspaceId/connectors/n8n/config", handleAsync(async (req) => {
  const deleted = await deleteN8nConfig(req.params.workspaceId);
  return { deleted };
}));

connectorsRoutes.get("/workspaces/:workspaceId/connectors/whatsapp/config", handleAsync(async (req) => {
  const config = await getWhatsAppConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/whatsapp/config", handleAsync(async (req) => {
  const body = z.object({
    accountSid: z.string().min(1),
    authToken: z.string().min(1),
    fromNumber: z.string().min(1),
  }).parse(req.body);
  const config = await saveWhatsAppConfig(req.params.workspaceId, body);
  return { config };
}));
connectorsRoutes.delete("/workspaces/:workspaceId/connectors/whatsapp/config", handleAsync(async (req) => {
  const deleted = await deleteWhatsAppConfig(req.params.workspaceId);
  return { deleted };
}));

connectorsRoutes.get("/connectors/outlook/auth", (req, res) => {
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
connectorsRoutes.get("/connectors/outlook/calendar/events", handleAsync(async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw new HttpError("Unauthorized", 401);
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : "";
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : "";
  if (!dateFrom || !dateTo) throw new HttpError("dateFrom and dateTo query params required (ISO datetime)", 400);
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const events = await getCalendarEvents(userId, dateFrom, dateTo, workspaceId);
  return { data: events };
}));
connectorsRoutes.get("/connectors/outlook/status", handleAsync(async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw new HttpError("Unauthorized", 401);
  const connected = await hasOutlookConnected(userId);
  return { connected };
}));
connectorsRoutes.delete("/connectors/outlook", handleAsync(async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw new HttpError("Unauthorized", 401);
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const deleted = await deleteOutlookCredentials(userId, workspaceId);
  return { deleted };
}));
