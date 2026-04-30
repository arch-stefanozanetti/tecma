import { Router } from "express";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { HttpError } from "../../types/http.js";
import { logger } from "../../observability/logger.js";
import { insertZeusTurn, searchZeusTurns, getZeusTurnsStats, type ZeusChannel } from "../../core/zeus/zeus-turns.service.js";
import { runZeusTurn } from "../../core/zeus/zeus-orchestrator.service.js";
import { getZeusPocConfig, patchZeusPocConfig, isZeusChannelEnabled } from "../../core/zeus/zeus-poc-config.service.js";
import { getProactiveSalesConfig, patchProactiveSalesConfig } from "../../core/zeus/proactive-sales-config.service.js";
import {
  dismissOpportunity,
  listProactiveOpportunities,
  refreshSuggestedCopy,
  sendProactiveOpportunity
} from "../../core/zeus/proactive-opportunities.service.js";
import { runProactiveSalesScan } from "../../core/zeus/proactive-engine.service.js";
import { ENV } from "../../config/env.js";
import {
  getZeusEmailInboxConfig,
  patchZeusEmailInboxConfig,
  syncZeusEmailFromInbox
} from "../../core/zeus/zeus-email-inbox.service.js";

export const zeusRoutes = Router();

const ws = "workspaceId";

zeusRoutes.get(
  `/workspaces/:${ws}/zeus/turns`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  handleAsync(async (req) => {
    const wid = req.params.workspaceId;
    let page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) || 1 : 1;
    let perPage = typeof req.query.perPage === "string" ? parseInt(req.query.perPage, 10) || 50 : 50;
    if (typeof req.query.limit === "string" && req.query.perPage === undefined) {
      perPage = Math.min(100, parseInt(req.query.limit, 10) || 50);
      page = 1;
    }
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const channelRaw = typeof req.query.channel === "string" ? req.query.channel : "all";
    const channel =
      channelRaw === "all" || channelRaw === "voice" || channelRaw === "whatsapp" || channelRaw === "email" || channelRaw === "chat"
        ? (channelRaw as "all" | ZeusChannel)
        : "all";
    const dirRaw = typeof req.query.direction === "string" ? req.query.direction : "all";
    const direction = dirRaw === "in" || dirRaw === "out" ? dirRaw : "all";
    const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
    const sortOrder = req.query.sortOrder === "1" ? 1 : -1;

    const { data, paginationInfo } = await searchZeusTurns(wid, {
      page,
      perPage,
      q,
      channel,
      direction,
      dateFrom,
      dateTo,
      sortOrder
    });
    return { data, paginationInfo };
  })
);

zeusRoutes.get(
  `/workspaces/:${ws}/zeus/turns/stats`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  handleAsync(async (req) => {
    const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
    const data = await getZeusTurnsStats(req.params.workspaceId, { dateFrom, dateTo });
    return { data };
  })
);

/** Chat ZEUS nativa (JWT): nessun Twilio — stessa pipeline LLM dei webhook. */
zeusRoutes.post(
  `/workspaces/:${ws}/zeus/chat`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  handleAsync(async (req) => {
    const wid = req.params.workspaceId;
    const text = req.body && typeof req.body === "object" && typeof (req.body as { text?: unknown }).text === "string"
      ? String((req.body as { text: string }).text).trim()
      : "";
    if (!text) throw new HttpError("Campo text obbligatorio", 400);
    if (!(await isZeusChannelEnabled(wid, "chat"))) throw new HttpError("Canale chat disabilitato", 403);

    await insertZeusTurn({
      workspaceId: wid,
      channel: "chat",
      direction: "in",
      text
    });
    let reply: string;
    try {
      reply = await runZeusTurn({ workspaceId: wid, channel: "chat", userText: text });
    } catch (err) {
      logger.error({ err, workspaceId: wid }, "[zeus] chat LLM failed");
      reply = "Al momento non posso rispondere. Riprova tra poco.";
    }
    await insertZeusTurn({
      workspaceId: wid,
      channel: "chat",
      direction: "out",
      text: reply
    });
    return { data: { reply } };
  })
);

zeusRoutes.get(
  `/workspaces/:${ws}/zeus/poc-config`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  handleAsync(async (req) => {
    const config = await getZeusPocConfig(req.params.workspaceId);
    const apiBase = ENV.API_BACKEND_PUBLIC_URL.replace(/\/$/, "");
    const wid = req.params.workspaceId;
    const webhookBase = apiBase ? `${apiBase}/v1/workspaces/${wid}/zeus/webhooks` : "";
    return {
      data: {
        ...config,
        webhookUrls: webhookBase
          ? {
              nativeIngest: `${webhookBase}/ingest`,
              twilioVoice: `${webhookBase}/twilio/voice`,
              twilioWhatsapp: `${webhookBase}/twilio/whatsapp`,
              email: `${webhookBase}/email`,
              sipVoice: `${webhookBase}/sip/voice`
            }
          : null
      }
    };
  })
);

zeusRoutes.patch(
  `/workspaces/:${ws}/zeus/poc-config`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  handleAsync(async (req) => {
    const config = await patchZeusPocConfig(req.params.workspaceId, req.body);
    return { data: config };
  })
);

zeusRoutes.get(
  `/workspaces/:${ws}/zeus/email/inbox-config`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  handleAsync(async (req) => {
    const data = await getZeusEmailInboxConfig(req.params.workspaceId);
    return { data };
  })
);

zeusRoutes.patch(
  `/workspaces/:${ws}/zeus/email/inbox-config`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  handleAsync(async (req) => {
    const data = await patchZeusEmailInboxConfig(req.params.workspaceId, req.body);
    return { data };
  })
);

zeusRoutes.post(
  `/workspaces/:${ws}/zeus/email/sync`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  handleAsync(async (req) => {
    const userId = req.user?.sub;
    if (!userId) throw new HttpError("Unauthorized", 401);
    const limit =
      req.body &&
      typeof req.body === "object" &&
      typeof (req.body as { limit?: unknown }).limit === "number"
        ? Number((req.body as { limit: number }).limit)
        : undefined;
    const data = await syncZeusEmailFromInbox({
      workspaceId: req.params.workspaceId,
      userId,
      limit
    });
    return { data };
  })
);

zeusRoutes.get(
  `/workspaces/:${ws}/zeus/proactive/config`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  handleAsync(async (req) => {
    const data = await getProactiveSalesConfig(req.params.workspaceId);
    return { data };
  })
);

zeusRoutes.patch(
  `/workspaces/:${ws}/zeus/proactive/config`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  handleAsync(async (req) => {
    const data = await patchProactiveSalesConfig(req.params.workspaceId, req.body);
    return { data };
  })
);

zeusRoutes.get(
  `/workspaces/:${ws}/zeus/proactive/opportunities`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  handleAsync(async (req) => {
    const status =
      typeof req.query.status === "string" && ["pending_review", "sent", "dismissed", "expired"].includes(req.query.status)
        ? (req.query.status as "pending_review" | "sent" | "dismissed" | "expired")
        : undefined;
    const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) || 50 : 50;
    const data = await listProactiveOpportunities(req.params.workspaceId, { status, limit });
    return { data };
  })
);

zeusRoutes.post(
  `/workspaces/:${ws}/zeus/proactive/run-scan`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  handleAsync(async (req) => {
    const manual =
      req.body &&
      typeof req.body === "object" &&
      (req.body as { manual?: boolean }).manual === true;
    const data = await runProactiveSalesScan(req.params.workspaceId, { manualTrigger: manual });
    return { data };
  })
);

zeusRoutes.post(
  `/workspaces/:${ws}/zeus/proactive/opportunities/:opportunityId/dismiss`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  handleAsync(async (req) => {
    const data = await dismissOpportunity(req.params.workspaceId, req.params.opportunityId);
    return { data };
  })
);

zeusRoutes.post(
  `/workspaces/:${ws}/zeus/proactive/opportunities/:opportunityId/send`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  handleAsync(async (req) => {
    const data = await sendProactiveOpportunity(req.params.workspaceId, req.params.opportunityId, req.body ?? {});
    return { data };
  })
);

zeusRoutes.post(
  `/workspaces/:${ws}/zeus/proactive/opportunities/:opportunityId/regenerate`,
  requireCanAccessWorkspace(ws),
  requirePermission(PERMISSIONS.INTEGRATIONS_UPDATE),
  handleAsync(async (req) => {
    const data = await refreshSuggestedCopy(req.params.workspaceId, req.params.opportunityId);
    return { data };
  })
);
