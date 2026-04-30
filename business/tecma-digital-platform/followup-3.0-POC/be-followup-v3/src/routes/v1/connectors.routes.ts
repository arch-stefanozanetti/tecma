import { Router } from "express";
import { z } from "zod";
import { getN8nConfig, saveN8nConfig, triggerN8nWorkflow, deleteN8nConfig } from "../../core/connectors/n8n.service.js";
import {
  getWhatsAppConfig,
  getWhatsAppCredentialsForSend,
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
  getMarketingConnectorSecrets,
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
import { deleteSumsubConfig, getSumsubConfig, saveSumsubConfig } from "../../core/aml/aml-config.service.js";
import {
  deleteStripeConfig,
  getStripeConfig,
  getStripeSecrets,
  saveStripeConfig,
} from "../../core/connectors/stripe-config.service.js";
import {
  deletePayPalConfig,
  getPayPalConfig,
  getPayPalSecrets,
  paypalApiBase,
  savePayPalConfig,
} from "../../core/connectors/paypal-config.service.js";
import {
  deleteWebflowConfig,
  getWebflowConfig,
  getWebflowSecrets,
  saveWebflowConfig,
} from "../../core/connectors/webflow-config.service.js";
import { syncApartmentsToWebflow, WebflowSyncBodySchema } from "../../core/connectors/webflow-sync.service.js";
import {
  deleteTeamsIncomingConfig,
  getTeamsIncomingConfig,
  postTeamsIncomingMessage,
  saveTeamsIncomingConfig,
} from "../../core/connectors/teams-incoming-webhook.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync, sendError } from "../asyncHandler.js";
import { requireAdmin } from "../authMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { requireWorkspaceEntitled, requireWorkspaceEntitledIfWorkspaceId } from "../workspaceEntitlementMiddleware.js";

const entitledIntegrationsForParam = requireWorkspaceEntitled("integrations", (req) => req.params.workspaceId);
const entitledMailchimpForParam = requireWorkspaceEntitled("mailchimp", (req) => req.params.workspaceId);
const entitledActiveCampaignForParam = requireWorkspaceEntitled("activecampaign", (req) => req.params.workspaceId);

type ConnectorVerifyResult = {
  connected: boolean;
  configured: boolean;
  providerReachable: boolean;
  authValid: boolean;
  reasonCode?: string;
  hint?: string;
};

function verifyResult(input: ConnectorVerifyResult): { verify: ConnectorVerifyResult } {
  return { verify: input };
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 7000): Promise<Response> {
  const maxAttempts = 2;
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const shouldRetry = attempt < maxAttempts && (res.status === 429 || res.status >= 500);
      if (shouldRetry) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        continue;
      }
      return res;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw (lastError instanceof Error ? lastError : new Error("Provider request failed"));
}

function authBasic(user: string, pass: string): string {
  return "Basic " + Buffer.from(`${user}:${pass}`).toString("base64");
}

export const connectorsRoutes = Router();
connectorsRoutes.use("/workspaces/:workspaceId", requireCanAccessWorkspace("workspaceId"));

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
connectorsRoutes.get("/workspaces/:workspaceId/connectors/n8n/verify", requirePermission(PERMISSIONS.INTEGRATIONS_READ), entitledIntegrationsForParam, handleAsync(async (req) => {
  const config = await getN8nConfig(req.params.workspaceId);
  if (!config?.config.baseUrl) {
    return verifyResult({
      connected: false,
      configured: false,
      providerReachable: false,
      authValid: false,
      reasonCode: "CONFIG_MISSING",
    });
  }
  try {
    const probeUrl = `${config.config.baseUrl.replace(/\/$/, "")}/api/v1/workflows`;
    const res = await fetchWithTimeout(probeUrl, { method: "GET" });
    if (res.status === 401 || res.status === 403) {
      return verifyResult({
        connected: false,
        configured: true,
        providerReachable: true,
        authValid: false,
        reasonCode: "AUTH_INVALID",
      });
    }
    return verifyResult({
      connected: res.ok,
      configured: true,
      providerReachable: true,
      authValid: res.ok,
      ...(res.ok ? {} : { reasonCode: "VERIFY_FAILED", hint: `n8n HTTP ${res.status}` }),
    });
  } catch {
    return verifyResult({
      connected: false,
      configured: true,
      providerReachable: false,
      authValid: false,
      reasonCode: "PROVIDER_UNREACHABLE",
    });
  }
}));

connectorsRoutes.get("/workspaces/:workspaceId/connectors/whatsapp/config", requirePermission(PERMISSIONS.INTEGRATIONS_READ), entitledIntegrationsForParam, handleAsync(async (req) => {
  const config = await getWhatsAppConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/whatsapp/verify",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const creds = await getWhatsAppCredentialsForSend(req.params.workspaceId);
    if (!creds) {
      return verifyResult({
        connected: false,
        configured: false,
        providerReachable: false,
        authValid: false,
        reasonCode: "CONFIG_MISSING",
      });
    }
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(creds.accountSid)}.json`;
      const res = await fetchWithTimeout(url, {
        method: "GET",
        headers: { Authorization: authBasic(creds.accountSid, creds.authToken) },
      });
      if (res.ok) {
        return verifyResult({
          connected: true,
          configured: true,
          providerReachable: true,
          authValid: true,
        });
      }
      return verifyResult({
        connected: false,
        configured: true,
        providerReachable: res.status >= 500 ? false : true,
        authValid: false,
        reasonCode: "AUTH_INVALID",
        hint: `Twilio ha risposto HTTP ${res.status}. Verifica Account SID/Auth Token.`,
      });
    } catch {
      return verifyResult({
        connected: false,
        configured: true,
        providerReachable: false,
        authValid: false,
        reasonCode: "PROVIDER_UNREACHABLE",
      });
    }
  })
);
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
  "/workspaces/:workspaceId/connectors/mailchimp/verify",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  entitledMailchimpForParam,
  handleAsync(async (req) => {
    const secrets = await getMarketingConnectorSecrets(req.params.workspaceId, "mailchimp");
    if (!secrets?.apiKey) {
      return verifyResult({
        connected: false,
        configured: false,
        providerReachable: false,
        authValid: false,
        reasonCode: "CONFIG_MISSING",
      });
    }
    const dc = secrets.apiKey.split("-").pop()?.trim().toLowerCase();
    if (!dc) {
      return verifyResult({
        connected: false,
        configured: true,
        providerReachable: false,
        authValid: false,
        reasonCode: "CONFIG_INVALID",
        hint: "API key Mailchimp non valida (manca datacenter suffix, es. us1).",
      });
    }
    try {
      const url = `https://${dc}.api.mailchimp.com/3.0/ping`;
      const res = await fetchWithTimeout(url, {
        headers: { Authorization: authBasic("anystring", secrets.apiKey) },
      });
      return verifyResult({
        connected: res.ok,
        configured: true,
        providerReachable: true,
        authValid: res.ok,
        ...(res.ok ? {} : { reasonCode: "AUTH_INVALID", hint: `Mailchimp HTTP ${res.status}` }),
      });
    } catch {
      return verifyResult({
        connected: false,
        configured: true,
        providerReachable: false,
        authValid: false,
        reasonCode: "PROVIDER_UNREACHABLE",
      });
    }
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
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/activecampaign/verify",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  entitledActiveCampaignForParam,
  handleAsync(async (req) => {
    const secrets = await getMarketingConnectorSecrets(req.params.workspaceId, "activecampaign");
    if (!secrets?.apiKey || !secrets.apiBaseUrl) {
      return verifyResult({
        connected: false,
        configured: false,
        providerReachable: false,
        authValid: false,
        reasonCode: "CONFIG_MISSING",
      });
    }
    try {
      const url = `${secrets.apiBaseUrl.replace(/\/$/, "")}/api/3/users/me`;
      const res = await fetchWithTimeout(url, {
        headers: {
          "Api-Token": secrets.apiKey,
          Accept: "application/json",
        },
      });
      return verifyResult({
        connected: res.ok,
        configured: true,
        providerReachable: true,
        authValid: res.ok,
        ...(res.ok ? {} : { reasonCode: "AUTH_INVALID", hint: `ActiveCampaign HTTP ${res.status}` }),
      });
    } catch {
      return verifyResult({
        connected: false,
        configured: true,
        providerReachable: false,
        authValid: false,
        reasonCode: "PROVIDER_UNREACHABLE",
      });
    }
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
connectorsRoutes.get("/workspaces/:workspaceId/connectors/meta-whatsapp/verify", requirePermission(PERMISSIONS.INTEGRATIONS_READ), entitledIntegrationsForParam, handleAsync(async (req) => {
  const cfg = await getMetaWhatsAppConfig(req.params.workspaceId);
  const data = cfg?.config as { phoneNumberId?: string } | undefined;
  const configured = Boolean(data?.phoneNumberId);
  if (!configured) {
    return verifyResult({
      connected: false,
      configured: false,
      providerReachable: false,
      authValid: false,
      reasonCode: "CONFIG_MISSING",
    });
  }
  return verifyResult({
    connected: true,
    configured: true,
    providerReachable: true,
    authValid: true,
  });
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
  "/workspaces/:workspaceId/connectors/marketing-google/verify",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const googleCfg = await getMarketingGoogleAdsConfig(req.params.workspaceId);
    const configured = Boolean(googleCfg?.refreshTokenMasked);
    if (!configured) {
      return verifyResult({
        connected: false,
        configured: false,
        providerReachable: false,
        authValid: false,
        reasonCode: "CONFIG_MISSING",
      });
    }
    const [ads, ga4] = await Promise.all([
      listGoogleAdsAccessibleCustomersWithOutcome(req.params.workspaceId),
      listGa4PropertiesForWorkspaceWithOutcome(req.params.workspaceId),
    ]);
    const providerReachable = ads.ok || ga4.ok;
    const authValid = ads.ok || ga4.ok;
    return verifyResult({
      connected: ads.ok && ga4.ok,
      configured,
      providerReachable,
      authValid,
      ...(ads.ok && ga4.ok
        ? {}
        : {
            reasonCode: !authValid ? "AUTH_INVALID" : "VERIFY_PARTIAL",
            hint: !ads.ok ? ads.message : !ga4.ok ? ga4.message : undefined,
          }),
    });
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
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/marketing-meta/verify",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const cfg = await getMarketingMetaAdsConfig(req.params.workspaceId);
    const configured = Boolean(cfg?.accessTokenMasked);
    if (!configured) {
      return verifyResult({
        connected: false,
        configured: false,
        providerReachable: false,
        authValid: false,
        reasonCode: "CONFIG_MISSING",
      });
    }
    const adAccounts = await listMetaAdAccountsForWorkspace(req.params.workspaceId);
    const hasAccounts = adAccounts.length > 0;
    return verifyResult({
      connected: hasAccounts,
      configured,
      providerReachable: hasAccounts,
      authValid: hasAccounts,
      ...(hasAccounts
        ? {}
        : {
            reasonCode: "VERIFY_FAILED",
            hint: "Token Meta non valido/scaduto o nessun ad account accessibile.",
          }),
    });
  })
);

/** Sumsub (AML/KYC): credenziali app + secret webhook per workspace. */
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/sumsub/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const config = await getSumsubConfig(req.params.workspaceId);
    return {
      config: config ?? null,
      webhookPathTemplate: "/v1/webhooks/sumsub/:workspaceId",
    };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/sumsub/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const body = z
      .object({
        appToken: z.string().min(1),
        secretKey: z.string().min(1),
        levelName: z.string().min(1),
        webhookSecret: z.string().min(1),
      })
      .parse(req.body);
    const config = await saveSumsubConfig(req.params.workspaceId, body);
    return { config };
  })
);
connectorsRoutes.delete(
  "/workspaces/:workspaceId/connectors/sumsub/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const deleted = await deleteSumsubConfig(req.params.workspaceId);
    return { deleted };
  })
);
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/sumsub/verify",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const cfg = await getSumsubConfig(req.params.workspaceId);
    const configured = Boolean(
      cfg?.config?.appTokenMasked && cfg?.config?.secretKeyMasked && cfg?.config?.webhookSecretMasked
    );
    return verifyResult({
      connected: configured,
      configured,
      providerReachable: configured,
      authValid: configured,
      ...(configured ? {} : { reasonCode: "CONFIG_MISSING" }),
    });
  })
);

/** Stripe */
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/stripe/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const config = await getStripeConfig(req.params.workspaceId);
    return { config: config ?? null, webhookUrlTemplate: "/v1/webhooks/stripe/:workspaceId" };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/stripe/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const body = z
      .object({
        secretKey: z.string().min(1),
        webhookSecret: z.string().optional(),
        publishableKey: z.string().optional(),
      })
      .parse(req.body);
    const config = await saveStripeConfig(req.params.workspaceId, body);
    return { config };
  })
);
connectorsRoutes.delete(
  "/workspaces/:workspaceId/connectors/stripe/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const deleted = await deleteStripeConfig(req.params.workspaceId);
    return { deleted };
  })
);
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/stripe/verify",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const secrets = await getStripeSecrets(req.params.workspaceId);
    if (!secrets?.secretKey) {
      return verifyResult({
        connected: false,
        configured: false,
        providerReachable: false,
        authValid: false,
        reasonCode: "CONFIG_MISSING",
      });
    }
    try {
      const res = await fetchWithTimeout("https://api.stripe.com/v1/account", {
        headers: { Authorization: `Bearer ${secrets.secretKey}` },
      });
      return verifyResult({
        connected: res.ok,
        configured: true,
        providerReachable: true,
        authValid: res.ok,
        ...(res.ok ? {} : { reasonCode: "AUTH_INVALID", hint: `Stripe HTTP ${res.status}` }),
      });
    } catch {
      return verifyResult({
        connected: false,
        configured: true,
        providerReachable: false,
        authValid: false,
        reasonCode: "PROVIDER_UNREACHABLE",
      });
    }
  })
);

/** PayPal */
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/paypal/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const config = await getPayPalConfig(req.params.workspaceId);
    return { config: config ?? null, webhookUrlTemplate: "/v1/webhooks/paypal/:workspaceId" };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/paypal/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const body = z
      .object({
        clientId: z.string().min(1),
        clientSecret: z.string().optional(),
        webhookId: z.string().optional(),
        mode: z.enum(["sandbox", "live"]).optional(),
      })
      .parse(req.body);
    const config = await savePayPalConfig(req.params.workspaceId, {
      clientId: body.clientId,
      clientSecret: body.clientSecret ?? "",
      webhookId: body.webhookId,
      mode: body.mode,
    });
    return { config };
  })
);
connectorsRoutes.delete(
  "/workspaces/:workspaceId/connectors/paypal/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const deleted = await deletePayPalConfig(req.params.workspaceId);
    return { deleted };
  })
);
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/paypal/verify",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const secrets = await getPayPalSecrets(req.params.workspaceId);
    if (!secrets?.clientId || !secrets.clientSecret) {
      return verifyResult({
        connected: false,
        configured: false,
        providerReachable: false,
        authValid: false,
        reasonCode: "CONFIG_MISSING",
      });
    }
    try {
      const body = new URLSearchParams({ grant_type: "client_credentials" });
      const res = await fetchWithTimeout(`${paypalApiBase(secrets.mode)}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: authBasic(secrets.clientId, secrets.clientSecret),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body.toString(),
      });
      return verifyResult({
        connected: res.ok,
        configured: true,
        providerReachable: true,
        authValid: res.ok,
        ...(res.ok ? {} : { reasonCode: "AUTH_INVALID", hint: `PayPal HTTP ${res.status}` }),
      });
    } catch {
      return verifyResult({
        connected: false,
        configured: true,
        providerReachable: false,
        authValid: false,
        reasonCode: "PROVIDER_UNREACHABLE",
      });
    }
  })
);

/** Webflow */
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/webflow/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const config = await getWebflowConfig(req.params.workspaceId);
    return { config: config ?? null };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/webflow/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const body = z
      .object({
        apiToken: z.string().min(1),
        siteId: z.string().min(1),
        apartmentsCollectionId: z.string().min(1),
      })
      .parse(req.body);
    const config = await saveWebflowConfig(req.params.workspaceId, body);
    return { config };
  })
);
connectorsRoutes.delete(
  "/workspaces/:workspaceId/connectors/webflow/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const deleted = await deleteWebflowConfig(req.params.workspaceId);
    return { deleted };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/webflow/sync-apartments",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const body = WebflowSyncBodySchema.parse(req.body ?? {});
    const result = await syncApartmentsToWebflow(req.params.workspaceId, body.projectIds);
    return { result };
  })
);
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/webflow/verify",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const secrets = await getWebflowSecrets(req.params.workspaceId);
    if (!secrets) {
      return verifyResult({
        connected: false,
        configured: false,
        providerReachable: false,
        authValid: false,
        reasonCode: "CONFIG_MISSING",
      });
    }
    try {
      const res = await fetchWithTimeout(`https://api.webflow.com/v2/sites/${encodeURIComponent(secrets.siteId)}`, {
        headers: { Authorization: `Bearer ${secrets.apiToken}` },
      });
      return verifyResult({
        connected: res.ok,
        configured: true,
        providerReachable: true,
        authValid: res.ok,
        ...(res.ok ? {} : { reasonCode: "AUTH_INVALID", hint: `Webflow HTTP ${res.status}` }),
      });
    } catch {
      return verifyResult({
        connected: false,
        configured: true,
        providerReachable: false,
        authValid: false,
        reasonCode: "PROVIDER_UNREACHABLE",
      });
    }
  })
);

/** Microsoft Teams (Incoming Webhook) */
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/teams-incoming/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const config = await getTeamsIncomingConfig(req.params.workspaceId);
    return { config: config ?? null };
  })
);
connectorsRoutes.get(
  "/workspaces/:workspaceId/connectors/teams-incoming/verify",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const config = await getTeamsIncomingConfig(req.params.workspaceId);
    const url = config?.config?.incomingWebhookUrl?.trim() || "";
    if (!url) {
      return verifyResult({
        connected: false,
        configured: false,
        providerReachable: false,
        authValid: false,
        reasonCode: "CONFIG_MISSING",
      });
    }
    try {
      const result = await postTeamsIncomingMessage(req.params.workspaceId, {
        title: "FollowUp — verifica connessione Teams",
        text: "Messaggio automatico di verifica connessione.",
      });
      return verifyResult({
        connected: Boolean(result.ok),
        configured: true,
        providerReachable: true,
        authValid: Boolean(result.ok),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore verifica Teams";
      return verifyResult({
        connected: false,
        configured: true,
        providerReachable: true,
        authValid: false,
        reasonCode: "VERIFY_FAILED",
        hint: msg.slice(0, 200),
      });
    }
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/teams-incoming/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const body = z
      .object({
        incomingWebhookUrl: z.string().url(),
        label: z.string().optional(),
      })
      .parse(req.body);
    const config = await saveTeamsIncomingConfig(req.params.workspaceId, body);
    return { config };
  })
);
connectorsRoutes.post(
  "/workspaces/:workspaceId/connectors/teams-incoming/test",
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const body = z
      .object({
        title: z.string().optional(),
        text: z.string().optional(),
      })
      .parse(req.body ?? {});
    return postTeamsIncomingMessage(req.params.workspaceId, {
      title: body.title?.trim() || "FollowUp — test Teams",
      text: body.text?.trim() || "Messaggio di prova dal portale integrazioni.",
    });
  })
);
connectorsRoutes.delete(
  "/workspaces/:workspaceId/connectors/teams-incoming/config",
  requirePermission(PERMISSIONS.INTEGRATIONS_DELETE),
  entitledIntegrationsForParam,
  handleAsync(async (req) => {
    const deleted = await deleteTeamsIncomingConfig(req.params.workspaceId);
    return { deleted };
  })
);
