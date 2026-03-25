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
import {
  deleteMarketingApiKeyConfig,
  getMarketingApiKeyConfig,
  saveMarketingApiKeyConfig,
} from "../../core/connectors/marketing-api-key-config.service.js";
import {
  deleteMarketingGa4Config,
  deleteMarketingGoogleAdsConfig,
  deleteMarketingMetaAdsConfig,
  getMarketingGa4Config,
  getMarketingGoogleAdsConfig,
  getMarketingMetaAdsConfig,
  saveMarketingGa4Config,
  saveMarketingGoogleAdsConfig,
  saveMarketingMetaAdsConfig,
} from "../../core/connectors/marketing-analytics-config.service.js";
import { sendWhatsAppMessage } from "../../core/communications/whatsapp.service.js";
import { sendWithMessagingGateway } from "../../core/messaging/messaging-gateway.service.js";
import {
  getAuthUrl,
  getCalendarEvents,
  hasOutlookConnected,
  deleteOutlookCredentials,
} from "../../core/connectors/outlook.service.js";
import { buildGoogleMarketingAuthorizationUrl } from "../../core/connectors/marketing-google-oauth.service.js";
import { buildMetaMarketingAuthorizationUrl } from "../../core/connectors/marketing-meta-oauth.service.js";
import {
  listGoogleAdsAccessibleCustomersWithOutcome,
  listGa4PropertiesForWorkspaceWithOutcome,
  listMetaAdAccountsForWorkspace,
} from "../../core/connectors/marketing-discovery.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync, sendError } from "../asyncHandler.js";
import { requireAdmin } from "../authMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { requireWorkspaceEntitled, requireWorkspaceEntitledIfWorkspaceId } from "../workspaceEntitlementMiddleware.js";

const entitledIntegrationsForParam = requireWorkspaceEntitled("integrations", (req) => req.params.workspaceId);
const entitledMailchimpForParam = requireWorkspaceEntitled("mailchimp", (req) => req.params.workspaceId);
const entitledActiveCampaignForParam = requireWorkspaceEntitled("activecampaign", (req) => req.params.workspaceId);

export const connectorsRoutes = Router();

connectorsRoutes.get("/workspaces/:workspaceId/connectors/n8n/config", requirePermission(PERMISSIONS.INTEGRATIONS_READ), entitledIntegrationsForParam, handleAsync(async (req) => {
  const config = await getN8nConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/n8n/config", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), entitledIntegrationsForParam, handleAsync(async (req) => {
  const body = z.object({
    baseUrl: z.string().min(1),
    apiKey: z.string().min(1),
    defaultWorkflowId: z.string().optional(),
  }).parse(req.body);
  const config = await saveN8nConfig(req.params.workspaceId, body);
  return { config };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/n8n/trigger", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), entitledIntegrationsForParam, handleAsync(async (req) => {
  const body = z.object({
    workflowId: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  }).parse(req.body ?? {});
  const result = await triggerN8nWorkflow(req.params.workspaceId, body.workflowId, body.data ?? {});
  return result;
}));
connectorsRoutes.delete("/workspaces/:workspaceId/connectors/n8n/config", requirePermission(PERMISSIONS.INTEGRATIONS_DELETE), entitledIntegrationsForParam, handleAsync(async (req) => {
  const deleted = await deleteN8nConfig(req.params.workspaceId);
  return { deleted };
}));

connectorsRoutes.get("/workspaces/:workspaceId/connectors/whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_READ), entitledIntegrationsForParam, handleAsync(async (req) => {
  const config = await getWhatsAppConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), entitledIntegrationsForParam, handleAsync(async (req) => {
  const body = z.object({
    accountSid: z.string().min(1),
    authToken: z.string().min(1),
    fromNumber: z.string().min(1),
  }).parse(req.body);
  const config = await saveWhatsAppConfig(req.params.workspaceId, body);
  return { config };
}));
connectorsRoutes.delete("/workspaces/:workspaceId/connectors/whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_DELETE), entitledIntegrationsForParam, handleAsync(async (req) => {
  const deleted = await deleteWhatsAppConfig(req.params.workspaceId);
  return { deleted };
}));

connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/mailchimp/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  entitledMailchimpForParam,
  handleAsync(async (req) => {
    const config = await getMarketingApiKeyConfig(req.params.workspaceId, "mailchimp");
    return { config: config ?? null };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/mailchimp/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  entitledMailchimpForParam,
  handleAsync(async (req) => {
    const body = z.object({ apiKey: z.string().min(1) }).parse(req.body);
    const config = await saveMarketingApiKeyConfig(req.params.workspaceId, "mailchimp", body.apiKey);
    return { config };
  })
);
connectorsRoutes.delete(
  "/workspaces/:workspaceId/connectors/mailchimp/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  entitledIntegrationsForParam,
  entitledMailchimpForParam,
  handleAsync(async (req) => {
    const deleted = await deleteMarketingApiKeyConfig(req.params.workspaceId, "mailchimp");
    return { deleted };
  })
);

connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/activecampaign/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  entitledActiveCampaignForParam,
  handleAsync(async (req) => {
    const config = await getMarketingApiKeyConfig(req.params.workspaceId, "activecampaign");
    return { config: config ?? null };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/activecampaign/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  entitledActiveCampaignForParam,
  handleAsync(async (req) => {
    const body = z
      .object({
        apiKey: z.string().min(1),
        apiBaseUrl: z.string().url().optional(),
      })
      .parse(req.body);
    const config = await saveMarketingApiKeyConfig(req.params.workspaceId, "activecampaign", {
      apiKey: body.apiKey,
      apiBaseUrl: body.apiBaseUrl,
    });
    return { config };
  })
);
connectorsRoutes.delete(
  "/workspaces/:workspaceId/connectors/activecampaign/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  entitledIntegrationsForParam,
  entitledActiveCampaignForParam,
  handleAsync(async (req) => {
    const deleted = await deleteMarketingApiKeyConfig(req.params.workspaceId, "activecampaign");
    return { deleted };
  })
);

/** Solo admin (o permesso *): invia un messaggio di prova (verifica Twilio + prefisso whatsapp:). */
connectorsRoutes.post("/workspaces/:workspaceId/connectors/whatsapp/test", requireAdmin, entitledIntegrationsForParam, handleAsync(async (req) => {
  const body = z.object({
    to: z.string().min(5),
    body: z.string().max(1600).optional(),
  }).parse(req.body ?? {});
  const text = body.body?.trim() || "Followup 3.0 — messaggio di prova WhatsApp.";
  await sendWhatsAppMessage(req.params.workspaceId, body.to, text);
  return { ok: true };
}));

connectorsRoutes.get("/workspaces/:workspaceId/connectors/meta-whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_READ), entitledIntegrationsForParam, handleAsync(async (req) => {
  const config = await getMetaWhatsAppConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
connectorsRoutes.post("/workspaces/:workspaceId/connectors/meta-whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE), entitledIntegrationsForParam, handleAsync(async (req) => {
  const body = z
    .object({
      phoneNumberId: z.string().min(1),
      accessToken: z.string().min(1),
    })
    .parse(req.body);
  const config = await saveMetaWhatsAppConfig(req.params.workspaceId, body);
  return { config };
}));
connectorsRoutes.delete("/workspaces/:workspaceId/connectors/meta-whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_DELETE), entitledIntegrationsForParam, handleAsync(async (req) => {
  const deleted = await deleteMetaWhatsAppConfig(req.params.workspaceId);
  return { deleted };
}));

connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/marketing-meta-ads/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const config = await getMarketingMetaAdsConfig(req.params.workspaceId);
    return { config: config ?? null };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/marketing-meta-ads/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const body = z.object({ accessToken: z.string().min(1) }).parse(req.body);
    const config = await saveMarketingMetaAdsConfig(req.params.workspaceId, body);
    return { config };
  })
);
connectorsRoutes.delete(
  "/workspaces/:workspaceId/connectors/marketing-meta-ads/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const deleted = await deleteMarketingMetaAdsConfig(req.params.workspaceId);
    return { deleted };
  })
);

connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/marketing-ga4/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const config = await getMarketingGa4Config(req.params.workspaceId);
    return { config: config ?? null };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/marketing-ga4/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const body = z.object({ serviceAccountJson: z.string().min(1) }).parse(req.body);
    const config = await saveMarketingGa4Config(req.params.workspaceId, body);
    return { config };
  })
);
connectorsRoutes.delete(
  "/workspaces/:workspaceId/connectors/marketing-ga4/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const deleted = await deleteMarketingGa4Config(req.params.workspaceId);
    return { deleted };
  })
);

connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/marketing-google-ads/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const config = await getMarketingGoogleAdsConfig(req.params.workspaceId);
    return { config: config ?? null };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/marketing-google-ads/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const body = z
      .object({
        refreshToken: z.string().min(1),
        clientId: z.string().optional(),
        clientSecret: z.string().optional(),
      })
      .parse(req.body);
    const config = await saveMarketingGoogleAdsConfig(req.params.workspaceId, body);
    return { config };
  })
);
connectorsRoutes.delete(
  "/workspaces/:workspaceId/connectors/marketing-google-ads/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const deleted = await deleteMarketingGoogleAdsConfig(req.params.workspaceId);
    return { deleted };
  })
);

/** Admin: prova invio template Meta (WhatsApp Cloud API). */
connectorsRoutes.post("/workspaces/:workspaceId/connectors/meta-whatsapp/test", requireAdmin, entitledIntegrationsForParam, handleAsync(async (req) => {
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

connectorsRoutes.get(
  "/connectors/outlook/auth",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  requireWorkspaceEntitledIfWorkspaceId("integrations", (r) =>
    typeof r.query.workspaceId === "string" ? r.query.workspaceId : undefined
  ),
  (req, res) => {
  const userId = req.user?.sub;
  if (!userId) {
    sendError(res, new HttpError("Unauthorized", 401));
    return;
  }
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI?.trim();
  if (!redirectUri) {
    sendError(
      res,
      new HttpError(
        "Connettore Outlook non configurato sul server (manca OUTLOOK_REDIRECT_URI).",
        503,
        "OUTLOOK_NOT_CONFIGURED",
        `Dev locale (PORT da .env, default 8080): http://localhost:8080/v1/connectors/outlook/callback — stesso URL va registrato come redirect URI nell'app Azure AD.`,
      ),
    );
    return;
  }
  try {
    const url = getAuthUrl(redirectUri, { userId, workspaceId });
    res.redirect(302, url);
  } catch (e) {
    sendError(res, e);
  }
});
connectorsRoutes.get(
  "/connectors/outlook/calendar/events",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  requireWorkspaceEntitledIfWorkspaceId("integrations", (r) =>
    typeof r.query.workspaceId === "string" ? r.query.workspaceId : undefined
  ),
  handleAsync(async (req) => {
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
connectorsRoutes.delete(
  "/connectors/outlook",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  requireWorkspaceEntitledIfWorkspaceId("integrations", (r) =>
    typeof r.query.workspaceId === "string" ? r.query.workspaceId : undefined
  ),
  handleAsync(async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw new HttpError("Unauthorized", 401);
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const deleted = await deleteOutlookCredentials(userId, workspaceId);
  return { deleted };
}));

/** OAuth Google (Ads + Analytics): URL da aprire nel browser (Big Data / Integrazioni). */
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/marketing-google/oauth-url",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError("Unauthorized", 401);
    const url = buildGoogleMarketingAuthorizationUrl(req.params.workspaceId, userId);
    return { url };
  })
);

connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/marketing-google/ads-customers",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const outcome = await listGoogleAdsAccessibleCustomersWithOutcome(req.params.workspaceId);
    if (!outcome.ok) {
      throw new HttpError(outcome.message, 424, outcome.code, outcome.hint);
    }
    return { customers: outcome.customers };
  })
);

connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/marketing-google/ga4-properties",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const outcome = await listGa4PropertiesForWorkspaceWithOutcome(req.params.workspaceId);
    if (!outcome.ok) {
      throw new HttpError(outcome.message, 424, outcome.code, outcome.hint);
    }
    return { properties: outcome.properties };
  })
);

/** OAuth Meta Marketing API */
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/marketing-meta/oauth-url",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError("Unauthorized", 401);
    const url = buildMetaMarketingAuthorizationUrl(req.params.workspaceId, userId);
    return { url };
  })
);

connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/marketing-meta/ad-accounts",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const adAccounts = await listMetaAdAccountsForWorkspace(req.params.workspaceId);
    return { adAccounts };
  })
);
