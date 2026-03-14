import { Router } from "express";
import { z } from "zod";
import { queryCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "../core/calendar/calendar.service.js";
import { queryClients, createClient, updateClient, getClientById } from "../core/clients/clients.service.js";
import { queryApartments } from "../core/apartments/apartments.service.js";
import { getCurrentPriceForUnit } from "../core/unit-pricing/unit-pricing.service.js";
import { listSalePricesByUnitId, createSalePrice, updateSalePrice } from "../core/sale-prices/sale-prices.service.js";
import { listMonthlyRentsByUnitId, createMonthlyRent, updateMonthlyRent } from "../core/monthly-rents/monthly-rents.service.js";
import { getInventoryByUnitId, setInventoryStatus } from "../core/inventory/inventory.service.js";
import { getActiveLockForApartment } from "../core/workflow/apartment-lock.service.js";
import { listPriceCalendarByUnitAndRange, upsertPriceCalendarEntry } from "../core/price-calendar/price-calendar.service.js";
import { getPriceAvailabilityMatrix } from "../core/price-availability-matrix/price-availability-matrix.service.js";
import {
  parseExcelBuffer,
  validateRows,
  executeImport,
  type OnDuplicate,
} from "../core/units-import/units-import.service.js";
import { queryRequests, getRequestById, createRequest, updateRequestStatus, listRequestTransitions, revertRequestStatus } from "../core/requests/requests.service.js";
import { listRequestActions, createRequestAction, updateRequestAction, deleteRequestAction } from "../core/requests/request-actions.service.js";
import { getProjectAccessByEmail } from "../core/auth/projectAccess.service.js";
import { getUserPreferences, upsertUserPreferences } from "../core/auth/userPreferences.service.js";
import {
  loginWithCredentials,
  exchangeSsoJwt,
  refreshAccessToken,
  logoutWithRefreshToken
} from "../core/auth/auth.service.js";
import { openApiV1 } from "../docs/openapi.js";
import { decideAiSuggestion, generateAiSuggestions } from "../core/ai/orchestrator.service.js";
import { createAiActionDraft, decideAiActionDraft, queryAiActionDrafts } from "../core/ai/action-engine.service.js";
import {
  createApartment,
  updateApartment,
  getApartmentById,
  upsertHCApartment,
  getHCApartment,
  queryHCApartments,
  createAssociation,
  queryAssociations,
  deleteAssociation,
  previewCompleteFlow,
  executeCompleteFlow,
  queryHCMaster,
  createHCMaster,
  updateHCMaster,
  deleteHCMaster,
  getTemplateConfiguration,
  saveTemplateConfiguration,
  validateTemplateConfiguration,
  queryClientsLite
} from "../core/future/future.service.js";
import { getModelSample } from "../core/inspect/inspect.service.js";
import { getClientCandidates, getApartmentCandidates } from "../core/matching/matching.service.js";
import { getWorkflowConfig } from "../core/workflow/workflow.service.js";
import {
  listWorkflowsByWorkspace,
  getWorkflowWithStatesAndTransitions,
  createWorkflow,
  createWorkflowState,
  createWorkflowTransition,
} from "../core/workflow/workflow-engine.service.js";
import {
  listWorkspaces,
  createWorkspace,
  getWorkspaceById,
  updateWorkspace,
  deleteWorkspace,
  listWorkspaceProjects,
  associateProjectToWorkspace,
  dissociateProjectFromWorkspace,
} from "../core/workspaces/workspaces.service.js";
import {
  listWorkspaceUsers,
  listWorkspaceIdsForUser,
  addWorkspaceUser,
  updateWorkspaceUser,
  removeWorkspaceUser,
} from "../core/workspaces/workspace-users.service.js";
import {
  listWorkspaceUserProjects,
  addWorkspaceUserProject,
  removeWorkspaceUserProject,
} from "../core/workspaces/workspace-user-projects.service.js";
import {
  listEntityAssignments,
  listEntityAssignmentsByUser,
  assignEntity,
  unassignEntity,
} from "../core/workspaces/entity-assignments.service.js";
import { listUsersWithVisibility } from "../core/users/users-admin.service.js";
import { createProject } from "../core/projects/projects.service.js";
import {
  getProjectDetail,
  getProjectPolicies,
  putProjectPolicies,
  getProjectBranding,
  putProjectBranding,
  getProjectEmailConfig,
  putProjectEmailConfig,
  listProjectEmailTemplates,
  createProjectEmailTemplate,
  getProjectEmailTemplate,
  patchProjectEmailTemplate,
  deleteProjectEmailTemplate,
  listProjectPdfTemplates,
  createProjectPdfTemplate,
  getProjectPdfTemplate,
  patchProjectPdfTemplate,
  deleteProjectPdfTemplate,
} from "../core/projects/project-config.service.js";
import {
  listByWorkspace as listAdditionalInfos,
  createAdditionalInfo,
  updateAdditionalInfo,
  deleteAdditionalInfo,
} from "../core/additional-infos/additional-infos.service.js";
import { HttpError } from "../types/http.js";
import { handleAsync, sendError } from "./asyncHandler.js";
import { requireAuth, requireAdmin } from "./authMiddleware.js";
import { authRateLimiter, publicApiRateLimiter } from "./rateLimitMiddleware.js";
import { record as auditRecord, queryAuditLog } from "../core/audit/audit-log.service.js";
import {
  queryNotifications,
  markRead as markNotificationRead,
  markAllRead as markAllNotificationsRead,
} from "../core/notifications/notifications.service.js";
import { dispatchEvent } from "../core/automations/automation-events.service.js";
import {
  listByWorkspace as listAutomationRules,
  create as createAutomationRule,
  getById as getAutomationRuleById,
  update as updateAutomationRule,
  remove as removeAutomationRule,
} from "../core/automations/automation-rules.service.js";
import {
  listByWorkspace as listWebhookConfigs,
  create as createWebhookConfig,
  getById as getWebhookConfigById,
  update as updateWebhookConfig,
  remove as removeWebhookConfig,
} from "../core/automations/webhook-configs.service.js";
import {
  listByWorkspace as listCommunicationTemplates,
  create as createCommunicationTemplate,
  getById as getCommunicationTemplateById,
  update as updateCommunicationTemplate,
  remove as removeCommunicationTemplate,
} from "../core/communications/templates.service.js";
import {
  listByWorkspace as listCommunicationRules,
  create as createCommunicationRule,
  getById as getCommunicationRuleById,
  update as updateCommunicationRule,
  remove as removeCommunicationRule,
} from "../core/communications/communication-rules.service.js";
import { listByWorkspace as listCommunicationDeliveries } from "../core/communications/communication-deliveries.service.js";
import { getN8nConfig, saveN8nConfig, triggerN8nWorkflow, deleteN8nConfig } from "../core/connectors/n8n.service.js";
import {
  getWhatsAppConfig,
  saveWhatsAppConfig,
  deleteWhatsAppConfig,
} from "../core/connectors/whatsapp-config.service.js";
import {
  getAuthUrl,
  exchangeCodeForTokens,
  getCalendarEvents,
  hasOutlookConnected,
  deleteOutlookCredentials,
} from "../core/connectors/outlook.service.js";
import { runReport } from "../core/reports/reports.service.js";

export const v1Router = Router();

// ─── Public routes (no JWT required) ─────────────────────────────────────────
v1Router.get("/health", (_req, res) => {
  res.json({ ok: true, service: "be-followup-v3" });
});

v1Router.get("/openapi.json", (_req, res) => {
  res.json(openApiV1);
});

const SWAGGER_UI_HTML = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>Followup 3.0 API - Swagger UI</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/v1/openapi.json",
        dom_id: "#swagger-ui",
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>
`;

v1Router.get("/docs", (_req, res) => {
  res.type("html").send(SWAGGER_UI_HTML);
});

v1Router.post("/auth/login", authRateLimiter, handleAsync((req) => loginWithCredentials(req.body)));
v1Router.post("/auth/sso-exchange", authRateLimiter, handleAsync((req) => exchangeSsoJwt(req.body)));
v1Router.post("/auth/refresh", handleAsync((req) => refreshAccessToken(req.body)));
v1Router.post("/auth/logout", (req, res) => {
  logoutWithRefreshToken(req.body)
    .then(() => res.status(204).end())
    .catch((err) => sendError(res, err));
});

// ─── Public API (no JWT; rate limited) ───────────────────────────────────────
v1Router.post("/public/listings", publicApiRateLimiter, handleAsync((req) => queryApartments(req.body)));
v1Router.get("/public/listings", publicApiRateLimiter, handleAsync((req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const projectIdsRaw = typeof req.query.projectIds === "string" ? req.query.projectIds : "";
  const projectIds = projectIdsRaw ? projectIdsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  if (!workspaceId || projectIds.length === 0) throw new HttpError("workspaceId and projectIds (comma-separated) query params required", 400);
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const perPage = typeof req.query.perPage === "string" ? parseInt(req.query.perPage, 10) : 25;
  const searchText = typeof req.query.searchText === "string" ? req.query.searchText : undefined;
  const body = {
    workspaceId,
    projectIds,
    page: Number.isNaN(page) ? 1 : page,
    perPage: Number.isNaN(perPage) ? 25 : Math.min(200, perPage),
    ...(searchText !== undefined && searchText !== "" && { searchText }),
  };
  return queryApartments(body);
}));

// ─── Outlook OAuth callback (no JWT; Microsoft redirects here) ─────────────────
v1Router.get("/connectors/outlook/callback", (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : "";
  const stateRaw = typeof req.query.state === "string" ? req.query.state : "";
  const base = (process.env.OUTLOOK_FRONTEND_REDIRECT_BASE ?? "").replace(/\/$/, "");
  const toPath = (q: string) => (base ? `${base}/integrations?tab=connettori&outlook=${q}` : `/integrations?tab=connettori&outlook=${q}`);
  if (!code || !stateRaw) {
    res.redirect(302, toPath("error"));
    return;
  }
  let state: { userId: string; workspaceId?: string };
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")) as { userId: string; workspaceId?: string };
  } catch {
    res.redirect(302, toPath("error"));
    return;
  }
  const redirectUri = process.env.OUTLOOK_REDIRECT_URI ?? "";
  exchangeCodeForTokens(code, redirectUri, state)
    .then(() => res.redirect(302, toPath("connected")))
    .catch(() => res.redirect(302, toPath("error")));
});

// ─── Protected routes (require valid JWT) ────────────────────────────────────
v1Router.use(requireAuth);

v1Router.get("/auth/me", handleAsync((req) => {
  const payload = req.user!;
  return Promise.resolve({
    id: payload.sub,
    email: payload.email,
    role: payload.role,
    isAdmin: payload.isAdmin
  });
}));

v1Router.post("/calendar/events/query", handleAsync((req) => queryCalendarEvents(req.body)));
v1Router.post("/calendar/events", handleAsync((req) => createCalendarEvent(req.body)));
v1Router.patch("/calendar/events/:id", handleAsync((req) => updateCalendarEvent(req.params.id, req.body)));
v1Router.delete("/calendar/events/:id", handleAsync((req) => deleteCalendarEvent(req.params.id)));
v1Router.post("/clients/query", handleAsync((req) => queryClients(req.body)));
v1Router.get("/clients/:id", handleAsync((req) => getClientById(req.params.id)));
v1Router.get(
  "/clients/:id/requests",
  handleAsync(async (req) => {
    const clientId = req.params.id;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    const projectIdsRaw = typeof req.query.projectIds === "string" ? req.query.projectIds : "";
    const projectIds = projectIdsRaw ? projectIdsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (!workspaceId || projectIds.length === 0) {
      throw new HttpError("Missing workspaceId or projectIds query params", 400);
    }
    const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const perPage = typeof req.query.perPage === "string" ? parseInt(req.query.perPage, 10) : 25;
    return queryRequests({
      workspaceId,
      projectIds,
      page: Number.isNaN(page) ? 1 : page,
      perPage: Number.isNaN(perPage) ? 25 : perPage,
      filters: { clientId }
    });
  })
);
v1Router.post("/clients", handleAsync(async (req) => {
  const result = await createClient(req.body);
  const workspaceId = req.body.workspaceId as string;
  auditRecord({
    action: "client.created",
    workspaceId,
    projectId: req.body.projectId,
    entityType: "client",
    entityId: result.client._id,
    actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
    payload: { fullName: result.client.fullName },
  }).catch(() => {});
  dispatchEvent(workspaceId, "client.created", {
    workspaceId,
    projectId: req.body.projectId,
    entityType: "client",
    entityId: result.client._id,
  }).catch(() => {});
  return result;
}));
v1Router.patch("/clients/:id", handleAsync(async (req) => {
  const result = await updateClient(req.params.id, req.body);
  const workspaceId = result.workspaceId ?? "";
  if (workspaceId) {
    auditRecord({
      action: "client.updated",
      workspaceId,
      projectId: result.client.projectId || undefined,
      entityType: "client",
      entityId: req.params.id,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: req.body,
    }).catch(() => {});
  }
  return { client: result.client };
}));

// POST /clients/:clientId/actions — registra azione (mail_received, mail_sent, call_completed, meeting_scheduled) per tab Profilo/Timeline
v1Router.post("/clients/:clientId/actions", handleAsync(async (req) => {
  const clientId = req.params.clientId;
  const body = z.object({ type: z.enum(["mail_received", "mail_sent", "call_completed", "meeting_scheduled"]) }).parse(req.body);
  const clientRes = await getClientById(clientId).catch(() => null);
  const workspaceId = clientRes?.client?.workspaceId ?? "";
  const { getDb } = await import("../config/db.js");
  const db = getDb();
  const now = new Date();
  const doc = {
    at: now,
    action: `client.${body.type}`,
    workspaceId,
    projectId: clientRes?.client?.projectId,
    entityType: "client",
    entityId: clientId,
    actor: { type: "user" as const, userId: req.user?.sub, email: req.user?.email },
  };
  const res = await db.collection("tz_audit_log").insertOne(doc);
  return {
    action: {
      _id: res.insertedId.toHexString(),
      type: body.type,
      at: now.toISOString(),
    },
  };
}));

v1Router.post("/apartments/query", handleAsync((req) => queryApartments(req.body)));
v1Router.post("/requests/query", handleAsync((req) => queryRequests(req.body)));
v1Router.get("/requests/actions", handleAsync((req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const requestId = typeof req.query.requestId === "string" ? req.query.requestId : undefined;
  if (!workspaceId) throw new HttpError("workspaceId query required", 400);
  return listRequestActions(workspaceId, requestId);
}));
v1Router.post("/requests/actions", handleAsync((req) =>
  createRequestAction(req.body, { userId: req.user?.sub })
));
v1Router.patch("/requests/actions/:id", handleAsync((req) =>
  updateRequestAction(req.params.id, req.body, { userId: req.user?.sub })
));
v1Router.delete("/requests/actions/:id", handleAsync((req) => deleteRequestAction(req.params.id)));
v1Router.get("/requests/:id", handleAsync((req) => getRequestById(req.params.id)));
v1Router.post("/requests", handleAsync(async (req) => {
  const result = await createRequest(req.body);
  const workspaceId = req.body.workspaceId as string | undefined;
  if (result?.request?._id && workspaceId) {
    auditRecord({
      action: "request.created",
      workspaceId,
      projectId: req.body.projectId,
      entityType: "request",
      entityId: result.request._id,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: { status: result.request.status },
    }).catch(() => {});
    dispatchEvent(workspaceId, "request.created", {
      workspaceId,
      projectId: req.body.projectId,
      entityType: "request",
      entityId: result.request._id,
      toStatus: result.request.status,
    }).catch(() => {});
  }
  return result;
}));
v1Router.patch("/requests/:id/status", handleAsync(async (req) => {
  const result = await updateRequestStatus(req.params.id, req.body, { userId: req.user?.sub });
  if (req.body.status) {
    const reqDoc = await getRequestById(req.params.id).catch(() => null);
    const workspaceId = reqDoc?.request?.workspaceId;
    if (workspaceId) {
      auditRecord({
        action: "request.status_changed",
        workspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { toStatus: req.body.status, reason: req.body.reason },
      }).catch(() => {});
      dispatchEvent(workspaceId, "request.status_changed", {
        workspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        toStatus: req.body.status,
      }).catch(() => {});
    }
  }
  return result;
}));
v1Router.get("/requests/:id/transitions", handleAsync((req) => listRequestTransitions(req.params.id)));
v1Router.post("/requests/:id/revert", handleAsync(async (req) => {
  const body = z.object({ transitionId: z.string().min(1) }).parse(req.body);
  return revertRequestStatus(req.params.id, body.transitionId, { userId: req.user?.sub });
}));
v1Router.post("/session/projects-by-email", handleAsync((req) => getProjectAccessByEmail(req.body)));

v1Router.get("/session/preferences", handleAsync(async (req) => {
  const email = typeof req.query.email === "string" ? req.query.email : "";
  if (!email) throw new HttpError("Missing email query param", 400);
  const prefs = await getUserPreferences(email);
  if (!prefs) return { found: false };
  return {
    found: true,
    email: prefs.email,
    workspaceId: prefs.workspaceId,
    selectedProjectIds: prefs.selectedProjectIds,
    updatedAt: prefs.updatedAt
  };
}));

v1Router.post("/session/preferences", handleAsync(async (req) => {
  const body = z
    .object({
      email: z.string().email(),
      workspaceId: z.string().min(1),
      selectedProjectIds: z.array(z.string().min(1)).min(1)
    })
    .parse(req.body);
  const prefs = await upsertUserPreferences(body.email, body.workspaceId, body.selectedProjectIds);
  return {
    email: prefs.email,
    workspaceId: prefs.workspaceId,
    selectedProjectIds: prefs.selectedProjectIds,
    updatedAt: prefs.updatedAt
  };
}));

v1Router.get("/notifications", handleAsync(async (req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("workspaceId query required", 400);
  const read = req.query.read === "true" ? true : req.query.read === "false" ? false : undefined;
  const type = typeof req.query.type === "string" && req.query.type ? req.query.type : undefined;
  const dateFrom = typeof req.query.dateFrom === "string" && req.query.dateFrom ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === "string" && req.query.dateTo ? req.query.dateTo : undefined;
  const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
  const perPage = typeof req.query.perPage === "string" ? parseInt(req.query.perPage, 10) : 25;
  return queryNotifications(workspaceId, {
    read,
    type: type as import("../core/notifications/notifications.service.js").NotificationType | undefined,
    dateFrom,
    dateTo,
    page: Number.isNaN(page) ? 1 : page,
    perPage: Number.isNaN(perPage) ? 25 : Math.min(200, perPage),
  });
}));
v1Router.patch("/notifications/:id", handleAsync(async (req) => {
  const notification = await markNotificationRead(req.params.id);
  if (!notification) throw new HttpError("Notification not found", 404);
  return { notification };
}));
v1Router.post("/notifications/read-all", handleAsync(async (req) => {
  const body = z.object({ workspaceId: z.string().min(1) }).parse(req.body);
  const count = await markAllNotificationsRead(body.workspaceId);
  return { count };
}));

v1Router.get("/workspaces/:workspaceId/automation-rules", handleAsync(async (req) => {
  const rules = await listAutomationRules(req.params.workspaceId);
  return { data: rules };
}));
v1Router.post("/workspaces/:workspaceId/automation-rules", handleAsync(async (req) => {
  const body = z.record(z.unknown()).parse(req.body);
  const rule = await createAutomationRule({ ...body, workspaceId: req.params.workspaceId });
  return { rule };
}));
v1Router.get("/automation-rules/:id", handleAsync(async (req) => {
  const rule = await getAutomationRuleById(req.params.id);
  if (!rule) throw new HttpError("Rule not found", 404);
  return { rule };
}));
v1Router.patch("/automation-rules/:id", handleAsync(async (req) => {
  const rule = await updateAutomationRule(req.params.id, req.body);
  if (!rule) throw new HttpError("Rule not found", 404);
  return { rule };
}));
v1Router.delete("/automation-rules/:id", handleAsync(async (req) => {
  const ok = await removeAutomationRule(req.params.id);
  if (!ok) throw new HttpError("Rule not found", 404);
  return { deleted: true };
}));

// ─── Communication templates & rules ────────────────────────────────────────
v1Router.get("/workspaces/:workspaceId/communication-templates", handleAsync(async (req) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const channelRaw = typeof req.query.channel === "string" ? req.query.channel : undefined;
  const channel = channelRaw && ["email", "whatsapp", "sms", "in_app"].includes(channelRaw) ? (channelRaw as "email" | "whatsapp" | "sms" | "in_app") : undefined;
  const data = await listCommunicationTemplates(req.params.workspaceId, { projectId, channel });
  return { data };
}));
v1Router.post("/workspaces/:workspaceId/communication-templates", handleAsync(async (req) => {
  const body = z.object({
    projectId: z.string().optional(),
    channel: z.enum(["email", "whatsapp", "sms", "in_app"]),
    name: z.string().min(1),
    subject: z.string().optional(),
    bodyText: z.string().min(1),
    bodyHtml: z.string().optional(),
    variables: z.array(z.string()).optional(),
  }).parse(req.body);
  const template = await createCommunicationTemplate({
    ...body,
    workspaceId: req.params.workspaceId,
    variables: body.variables ?? [],
  });
  return { template };
}));
v1Router.get("/communication-templates/:id", handleAsync(async (req) => {
  const template = await getCommunicationTemplateById(req.params.id);
  if (!template) throw new HttpError("Template not found", 404);
  return { template };
}));
v1Router.patch("/communication-templates/:id", handleAsync(async (req) => {
  const template = await updateCommunicationTemplate(req.params.id, req.body);
  if (!template) throw new HttpError("Template not found", 404);
  return { template };
}));
v1Router.delete("/communication-templates/:id", handleAsync(async (req) => {
  const ok = await removeCommunicationTemplate(req.params.id);
  if (!ok) throw new HttpError("Template not found", 404);
  return { deleted: true };
}));
v1Router.get("/workspaces/:workspaceId/communication-rules", handleAsync(async (req) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
  const data = await listCommunicationRules(req.params.workspaceId, { projectId });
  return { data };
}));
v1Router.get("/workspaces/:workspaceId/communication-deliveries", handleAsync(async (req) => {
  const limit = typeof req.query.limit === "string" ? Math.min(100, parseInt(req.query.limit, 10) || 50) : 50;
  const data = await listCommunicationDeliveries(req.params.workspaceId, limit);
  return { data };
}));
v1Router.post("/workspaces/:workspaceId/communication-rules", handleAsync(async (req) => {
  const body = z.record(z.unknown()).parse(req.body);
  const rule = await createCommunicationRule({ ...body, workspaceId: req.params.workspaceId } as Parameters<typeof createCommunicationRule>[0]);
  return { rule };
}));
v1Router.get("/communication-rules/:id", handleAsync(async (req) => {
  const rule = await getCommunicationRuleById(req.params.id);
  if (!rule) throw new HttpError("Communication rule not found", 404);
  return { rule };
}));
v1Router.patch("/communication-rules/:id", handleAsync(async (req) => {
  const rule = await updateCommunicationRule(req.params.id, req.body);
  if (!rule) throw new HttpError("Communication rule not found", 404);
  return { rule };
}));
v1Router.delete("/communication-rules/:id", handleAsync(async (req) => {
  const ok = await removeCommunicationRule(req.params.id);
  if (!ok) throw new HttpError("Communication rule not found", 404);
  return { deleted: true };
}));

v1Router.get("/workspaces/:workspaceId/webhook-configs", handleAsync(async (req) => {
  const configs = await listWebhookConfigs(req.params.workspaceId);
  return { data: configs };
}));
v1Router.post("/workspaces/:workspaceId/webhook-configs", handleAsync(async (req) => {
  const body = z.record(z.unknown()).parse(req.body);
  const config = await createWebhookConfig({ ...body, workspaceId: req.params.workspaceId });
  return { config };
}));
v1Router.get("/webhook-configs/:id", handleAsync(async (req) => {
  const config = await getWebhookConfigById(req.params.id);
  if (!config) throw new HttpError("Webhook config not found", 404);
  return { config };
}));
v1Router.patch("/webhook-configs/:id", handleAsync(async (req) => {
  const config = await updateWebhookConfig(req.params.id, req.body);
  if (!config) throw new HttpError("Webhook config not found", 404);
  return { config };
}));
v1Router.delete("/webhook-configs/:id", handleAsync(async (req) => {
  const ok = await removeWebhookConfig(req.params.id);
  if (!ok) throw new HttpError("Webhook config not found", 404);
  return { deleted: true };
}));

// ─── Connettore n8n ─────────────────────────────────────────────────────────
v1Router.get("/workspaces/:workspaceId/connectors/n8n/config", handleAsync(async (req) => {
  const config = await getN8nConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
v1Router.post("/workspaces/:workspaceId/connectors/n8n/config", handleAsync(async (req) => {
  const body = z.object({
    baseUrl: z.string().min(1),
    apiKey: z.string().min(1),
    defaultWorkflowId: z.string().optional(),
  }).parse(req.body);
  const config = await saveN8nConfig(req.params.workspaceId, body);
  return { config };
}));
v1Router.post("/workspaces/:workspaceId/connectors/n8n/trigger", handleAsync(async (req) => {
  const body = z.object({
    workflowId: z.string().optional(),
    data: z.record(z.unknown()).optional(),
  }).parse(req.body ?? {});
  const result = await triggerN8nWorkflow(req.params.workspaceId, body.workflowId, body.data ?? {});
  return result;
}));
v1Router.delete("/workspaces/:workspaceId/connectors/n8n/config", handleAsync(async (req) => {
  const deleted = await deleteN8nConfig(req.params.workspaceId);
  return { deleted };
}));

// ─── Connettore WhatsApp (Twilio) ────────────────────────────────────────────
v1Router.get("/workspaces/:workspaceId/connectors/whatsapp/config", handleAsync(async (req) => {
  const config = await getWhatsAppConfig(req.params.workspaceId);
  return { config: config ?? null };
}));
v1Router.post("/workspaces/:workspaceId/connectors/whatsapp/config", handleAsync(async (req) => {
  const body = z.object({
    accountSid: z.string().min(1),
    authToken: z.string().min(1),
    fromNumber: z.string().min(1),
  }).parse(req.body);
  const config = await saveWhatsAppConfig(req.params.workspaceId, body);
  return { config };
}));
v1Router.delete("/workspaces/:workspaceId/connectors/whatsapp/config", handleAsync(async (req) => {
  const deleted = await deleteWhatsAppConfig(req.params.workspaceId);
  return { deleted };
}));

// ─── Connettore Outlook (OAuth2 + Graph) ────────────────────────────────────
v1Router.get("/connectors/outlook/auth", (req, res) => {
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
v1Router.get("/connectors/outlook/calendar/events", handleAsync(async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw new HttpError("Unauthorized", 401);
  const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : "";
  const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : "";
  if (!dateFrom || !dateTo) throw new HttpError("dateFrom and dateTo query params required (ISO datetime)", 400);
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const events = await getCalendarEvents(userId, dateFrom, dateTo, workspaceId);
  return { data: events };
}));
v1Router.get("/connectors/outlook/status", handleAsync(async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw new HttpError("Unauthorized", 401);
  const connected = await hasOutlookConnected(userId);
  return { connected };
}));
v1Router.delete("/connectors/outlook", handleAsync(async (req) => {
  const userId = req.user?.sub;
  if (!userId) throw new HttpError("Unauthorized", 401);
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  const deleted = await deleteOutlookCredentials(userId, workspaceId);
  return { deleted };
}));

v1Router.post("/apartments", handleAsync(async (req) => {
  const result = await createApartment(req.body);
  if (result?.apartmentId && req.body.workspaceId) {
    auditRecord({
      action: "apartment.created",
      workspaceId: req.body.workspaceId,
      projectId: req.body.projectId,
      entityType: "apartment",
      entityId: result.apartmentId,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: { code: result.apartment?.code },
    }).catch(() => {});
  }
  return result;
}));
v1Router.patch("/apartments/:id", handleAsync(async (req) => {
  const result = await updateApartment({ ...req.body, apartmentId: req.params.id });
  if (req.body.workspaceId) {
    auditRecord({
      action: "apartment.updated",
      workspaceId: req.body.workspaceId,
      projectId: req.body.projectId,
      entityType: "apartment",
      entityId: req.params.id,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: req.body,
    }).catch(() => {});
  }
  return result;
}));
v1Router.get("/apartments/:id", handleAsync((req) => getApartmentById(req.params.id)));
v1Router.get("/apartments/:id/prices", handleAsync(async (req) => {
  const unitId = req.params.id;
  const [current, salePrices, monthlyRents] = await Promise.all([
    getCurrentPriceForUnit(unitId),
    listSalePricesByUnitId(unitId),
    listMonthlyRentsByUnitId(unitId),
  ]);
  return { current, salePrices, monthlyRents };
}));
v1Router.get("/apartments/:id/inventory", handleAsync(async (req) => {
  const unitId = req.params.id;
  const [inventory, lock] = await Promise.all([
    getInventoryByUnitId(unitId),
    getActiveLockForApartment(unitId),
  ]);
  const effectiveStatus = lock ? "locked" : (inventory?.inventoryStatus ?? "available");
  return {
    inventory: inventory ?? null,
    lock: lock ? { requestId: lock.requestId, type: lock.type } : null,
    effectiveStatus,
  };
}));
v1Router.patch("/apartments/:id/inventory", handleAsync(async (req) => {
  const unitId = req.params.id;
  const body = req.body as { workspaceId?: string; inventoryStatus?: "available" | "locked" | "reserved" | "sold" };
  if (!body.workspaceId) throw new HttpError("workspaceId required", 400);
  const status = body.inventoryStatus ?? "available";
  return setInventoryStatus(unitId, body.workspaceId, status);
}));
v1Router.post("/apartments/:id/prices/sale", handleAsync(async (req) => {
  const unitId = req.params.id;
  const body = req.body as { workspaceId: string; price: number; currency?: string; validFrom?: string; validTo?: string };
  if (!body.workspaceId) throw new HttpError("workspaceId required", 400);
  return createSalePrice({
    unitId,
    workspaceId: body.workspaceId,
    price: body.price,
    currency: body.currency,
    validFrom: body.validFrom,
    validTo: body.validTo,
  });
}));
v1Router.post("/apartments/:id/prices/monthly-rent", handleAsync(async (req) => {
  const unitId = req.params.id;
  const body = req.body as { workspaceId: string; pricePerMonth: number; deposit?: number; currency?: string; validFrom?: string; validTo?: string };
  if (!body.workspaceId) throw new HttpError("workspaceId required", 400);
  return createMonthlyRent({
    unitId,
    workspaceId: body.workspaceId,
    pricePerMonth: body.pricePerMonth,
    deposit: body.deposit,
    currency: body.currency,
    validFrom: body.validFrom,
    validTo: body.validTo,
  });
}));
v1Router.patch("/apartments/:id/prices/sale/:priceId", handleAsync(async (req) => {
  const unitId = req.params.id;
  const priceId = req.params.priceId;
  const body = req.body as { validTo?: string; price?: number };
  return updateSalePrice(unitId, priceId, { validTo: body.validTo, price: body.price });
}));
v1Router.patch("/apartments/:id/prices/monthly-rent/:rentId", handleAsync(async (req) => {
  const unitId = req.params.id;
  const rentId = req.params.rentId;
  const body = req.body as { validTo?: string; pricePerMonth?: number; deposit?: number };
  return updateMonthlyRent(unitId, rentId, {
    validTo: body.validTo,
    pricePerMonth: body.pricePerMonth,
    deposit: body.deposit,
  });
}));
v1Router.get("/apartments/:id/prices/calendar", handleAsync(async (req) => {
  const unitId = req.params.id;
  const from = (req.query.from as string) ?? "";
  const to = (req.query.to as string) ?? "";
  if (!from || !to) throw new HttpError("query from and to (YYYY-MM-DD) required", 400);
  return listPriceCalendarByUnitAndRange(unitId, from, to);
}));
v1Router.put("/apartments/:id/prices/calendar", handleAsync(async (req) => {
  const unitId = req.params.id;
  const body = req.body as { date: string; price: number; minStay?: number; availability?: "available" | "blocked" | "reserved" };
  if (!body.date || typeof body.price !== "number") throw new HttpError("date and price required", 400);
  await upsertPriceCalendarEntry({
    unitId,
    date: body.date,
    price: body.price,
    minStay: body.minStay,
    availability: body.availability,
  });
  return { ok: true };
}));
v1Router.post("/workspaces/:workspaceId/projects/:projectId/units/import/preview", requireAdmin, handleAsync(async (req) => {
  const workspaceId = req.params.workspaceId;
  const projectId = req.params.projectId;
  const body = req.body as { fileBase64?: string; fileName?: string };
  const b64 = body.fileBase64;
  if (typeof b64 !== "string" || !b64) throw new HttpError("fileBase64 obbligatorio", 400);
  const buffer = Buffer.from(b64, "base64");
  const rows = parseExcelBuffer(buffer);
  return validateRows(rows, workspaceId, projectId);
}));
v1Router.post("/workspaces/:workspaceId/projects/:projectId/units/import/execute", requireAdmin, handleAsync(async (req) => {
  const workspaceId = req.params.workspaceId;
  const projectId = req.params.projectId;
  const body = req.body as { validRows?: unknown[]; onDuplicate?: OnDuplicate };
  const validRows = Array.isArray(body.validRows) ? body.validRows as Parameters<typeof executeImport>[2] : [];
  const onDuplicate = (body.onDuplicate === "overwrite" || body.onDuplicate === "fail" ? body.onDuplicate : "skip") as OnDuplicate;
  return executeImport(workspaceId, projectId, validRows, onDuplicate);
}));
v1Router.get(
  "/apartments/:id/requests",
  handleAsync(async (req) => {
    const apartmentId = req.params.id;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    const projectIdsRaw = typeof req.query.projectIds === "string" ? req.query.projectIds : "";
    const projectIds = projectIdsRaw ? projectIdsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
    if (!workspaceId || projectIds.length === 0) {
      throw new HttpError("Missing workspaceId or projectIds query params", 400);
    }
    const page = typeof req.query.page === "string" ? parseInt(req.query.page, 10) : 1;
    const perPage = typeof req.query.perPage === "string" ? parseInt(req.query.perPage, 10) : 25;
    return queryRequests({
      workspaceId,
      projectIds,
      page: Number.isNaN(page) ? 1 : page,
      perPage: Number.isNaN(perPage) ? 25 : perPage,
      filters: { apartmentId }
    });
  })
);

v1Router.post("/hc/apartments", handleAsync((req) => upsertHCApartment(req.body)));
v1Router.get("/hc/apartments/:apartmentId", handleAsync((req) => getHCApartment(req.params.apartmentId)));
v1Router.patch("/hc/apartments/:apartmentId", handleAsync((req) => upsertHCApartment({ ...req.body, apartmentId: req.params.apartmentId })));
v1Router.post("/hc/apartments/query", handleAsync((req) => queryHCApartments(req.body)));

v1Router.post("/associations/apartment-client", handleAsync(async (req) => {
  const result = await createAssociation(req.body);
  if (result?.association?._id && req.body.workspaceId) {
    auditRecord({
      action: "association.created",
      workspaceId: req.body.workspaceId,
      projectId: req.body.projectId,
      entityType: "association",
      entityId: String(result.association._id),
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: { apartmentId: req.body.apartmentId, clientId: req.body.clientId },
    }).catch(() => {});
  }
  return result;
}));
v1Router.post("/associations/query", handleAsync((req) => queryAssociations(req.body)));
v1Router.delete("/associations/:id", handleAsync(async (req) => {
  const result = await deleteAssociation(req.params.id);
  const workspaceId = (result as { workspaceId?: string }).workspaceId ?? "";
  if (workspaceId) {
    auditRecord({
      action: "association.deleted",
      workspaceId,
      projectId: (result as { projectId?: string }).projectId,
      entityType: "association",
      entityId: req.params.id,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
    }).catch(() => {});
  }
  return { deleted: true };
}));

v1Router.post("/workflows/complete-flow/preview", handleAsync((req) => previewCompleteFlow(req.body)));
v1Router.post("/workflows/complete-flow/execute", handleAsync((req) => executeCompleteFlow(req.body)));

v1Router.post("/hc-master/:entity/query", handleAsync((req) => queryHCMaster(req.params.entity, req.body)));
v1Router.post("/hc-master/:entity", handleAsync((req) => createHCMaster(req.params.entity, req.body)));
v1Router.patch("/hc-master/:entity/:id", handleAsync((req) => updateHCMaster(req.params.entity, req.params.id, req.body)));
v1Router.delete("/hc-master/:entity/:id", handleAsync((req) => deleteHCMaster(req.params.entity, req.params.id)));

v1Router.get("/templates/configuration", handleAsync((req) => getTemplateConfiguration(req.query.projectId)));
v1Router.put("/templates/configuration/:projectId", handleAsync((req) => saveTemplateConfiguration(req.params.projectId, req.body)));
v1Router.post("/templates/configuration/:projectId/validate", handleAsync((req) => validateTemplateConfiguration(req.body)));

v1Router.post("/clients/lite/query", handleAsync(async (req) => {
  const body = z.object({ workspaceId: z.string().min(1), projectIds: z.array(z.string().min(1)).min(1) }).parse(req.body);
  return { data: await queryClientsLite(body.workspaceId, body.projectIds) };
}));

// ─── Projects (admin) ────────────────────────────────────────────────────────
v1Router.post("/projects", requireAdmin, handleAsync((req) => createProject(req.body)));

// ─── Project config (dettaglio, policies, email, pdf) ───────────────────────
v1Router.get("/projects/:projectId", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return getProjectDetail(projectId, workspaceId, isAdmin);
}));
v1Router.get("/projects/:projectId/policies", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return getProjectPolicies(projectId, workspaceId, isAdmin);
}));
v1Router.put("/projects/:projectId/policies", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return putProjectPolicies(projectId, workspaceId, isAdmin, req.body);
}));
v1Router.get("/projects/:projectId/branding", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return getProjectBranding(projectId, workspaceId, isAdmin);
}));
v1Router.put("/projects/:projectId/branding", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return putProjectBranding(projectId, workspaceId, isAdmin, req.body);
}));
v1Router.get("/projects/:projectId/email-config", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return getProjectEmailConfig(projectId, workspaceId, isAdmin);
}));
v1Router.put("/projects/:projectId/email-config", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return putProjectEmailConfig(projectId, workspaceId, isAdmin, req.body);
}));
v1Router.get("/projects/:projectId/email-templates", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return listProjectEmailTemplates(projectId, workspaceId, isAdmin);
}));
v1Router.post("/projects/:projectId/email-templates", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return createProjectEmailTemplate(projectId, workspaceId, isAdmin, req.body);
}));
v1Router.get("/projects/:projectId/email-templates/:templateId", handleAsync(async (req) => {
  const { projectId, templateId } = req.params;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return getProjectEmailTemplate(projectId, templateId, workspaceId, isAdmin);
}));
v1Router.patch("/projects/:projectId/email-templates/:templateId", handleAsync(async (req) => {
  const { projectId, templateId } = req.params;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return patchProjectEmailTemplate(projectId, templateId, workspaceId, isAdmin, req.body);
}));
v1Router.delete("/projects/:projectId/email-templates/:templateId", handleAsync(async (req) => {
  const { projectId, templateId } = req.params;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return deleteProjectEmailTemplate(projectId, templateId, workspaceId, isAdmin);
}));
v1Router.get("/projects/:projectId/pdf-templates", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return listProjectPdfTemplates(projectId, workspaceId, isAdmin);
}));
v1Router.post("/projects/:projectId/pdf-templates", handleAsync(async (req) => {
  const projectId = req.params.projectId;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return createProjectPdfTemplate(projectId, workspaceId, isAdmin, req.body);
}));
v1Router.get("/projects/:projectId/pdf-templates/:templateId", handleAsync(async (req) => {
  const { projectId, templateId } = req.params;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return getProjectPdfTemplate(projectId, templateId, workspaceId, isAdmin);
}));
v1Router.patch("/projects/:projectId/pdf-templates/:templateId", handleAsync(async (req) => {
  const { projectId, templateId } = req.params;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return patchProjectPdfTemplate(projectId, templateId, workspaceId, isAdmin, req.body);
}));
v1Router.delete("/projects/:projectId/pdf-templates/:templateId", handleAsync(async (req) => {
  const { projectId, templateId } = req.params;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("Missing workspaceId query param", 400);
  const isAdmin = req.user?.isAdmin ?? false;
  return deleteProjectPdfTemplate(projectId, templateId, workspaceId, isAdmin);
}));

// ─── Matching (candidati stesso progetto) ──────────────────────────────────
v1Router.get("/matching/clients/:id/candidates", handleAsync(async (req) => {
  const clientId = req.params.id;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const projectIds = typeof req.query.projectIds === "string"
    ? req.query.projectIds.split(",").map((p) => p.trim()).filter(Boolean)
    : [];
  return getClientCandidates(clientId, workspaceId, projectIds);
}));
v1Router.get("/matching/apartments/:id/candidates", handleAsync(async (req) => {
  const apartmentId = req.params.id;
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const projectIds = typeof req.query.projectIds === "string"
    ? req.query.projectIds.split(",").map((p) => p.trim()).filter(Boolean)
    : [];
  return getApartmentCandidates(apartmentId, workspaceId, projectIds);
}));

// ─── Users (admin: lista utenti e visibilità) ─────────────────────────────────
v1Router.get("/users", requireAdmin, handleAsync(() => listUsersWithVisibility()));

// ─── Workspaces ──────────────────────────────────────────────────────────────
v1Router.get("/workspaces", handleAsync(async (req) => {
  const all = await listWorkspaces();
  const isAdmin = req.user?.isAdmin === true;
  const email = typeof req.user?.email === "string" ? req.user.email : "";
  if (isAdmin || !email) return all;
  const allowedIds = await listWorkspaceIdsForUser(email);
  const set = new Set(allowedIds);
  return all.filter((w) => set.has(w._id));
}));
v1Router.get("/workspaces/:id/users", handleAsync(async (req) => listWorkspaceUsers(req.params.id)));
v1Router.post("/workspaces/:id/users", requireAdmin, handleAsync(async (req) => {
  const body = req.body as { userId?: string; role?: "vendor" | "vendor_manager" | "admin" };
  return addWorkspaceUser(req.params.id, { userId: body.userId ?? "", role: body.role ?? "vendor" });
}));
v1Router.patch("/workspaces/:id/users/:userId", requireAdmin, handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  return updateWorkspaceUser(req.params.id, userId, req.body as { role?: "vendor" | "vendor_manager" | "admin" });
}));
v1Router.delete("/workspaces/:id/users/:userId", requireAdmin, handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  return removeWorkspaceUser(req.params.id, userId);
}));
v1Router.get("/workspaces/:id/users/:userId/projects", handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  return listWorkspaceUserProjects(req.params.id, userId);
}));
v1Router.post("/workspaces/:id/users/:userId/projects", requireAdmin, handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  const body = req.body as { projectId?: string };
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  return addWorkspaceUserProject(req.params.id, userId, projectId);
}));
v1Router.delete("/workspaces/:id/users/:userId/projects/:projectId", requireAdmin, handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  const projectId = typeof req.params.projectId === "string" ? decodeURIComponent(req.params.projectId) : "";
  return removeWorkspaceUserProject(req.params.id, userId, projectId);
}));
v1Router.get("/workspaces/:id/projects", handleAsync((req) =>
  listWorkspaceProjects(req.params.id).then((rows) => ({ data: rows }))
));
v1Router.get("/workspaces/:workspaceId/price-availability", handleAsync(async (req) => {
  const workspaceId = req.params.workspaceId;
  const projectIdsRaw = req.query.projectIds;
  const projectIds = typeof projectIdsRaw === "string" ? projectIdsRaw.split(",").map((p) => p.trim()).filter(Boolean) : [];
  const from = (req.query.from as string) ?? "";
  const to = (req.query.to as string) ?? "";
  if (!from || !to) throw new HttpError("query from and to (YYYY-MM-DD) required", 400);
  if (projectIds.length === 0) throw new HttpError("projectIds required (comma-separated)", 400);
  return getPriceAvailabilityMatrix(workspaceId, projectIds, from, to);
}));
v1Router.get("/workspaces/:workspaceId/entities/:entityType/:entityId/assignments", handleAsync(async (req) => {
  const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
  const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
  return listEntityAssignments(req.params.workspaceId, entityType, entityId);
}));
v1Router.post("/workspaces/:workspaceId/entities/:entityType/:entityId/assignments", requireAdmin, handleAsync(async (req) => {
  const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
  const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
  const body = req.body as { userId?: string };
  const userId = typeof body.userId === "string" ? body.userId : "";
  return assignEntity(req.params.workspaceId, entityType, entityId, userId);
}));
v1Router.delete("/workspaces/:workspaceId/entities/:entityType/:entityId/assignments/:userId", requireAdmin, handleAsync(async (req) => {
  const entityType = typeof req.params.entityType === "string" ? req.params.entityType : "";
  const entityId = typeof req.params.entityId === "string" ? decodeURIComponent(req.params.entityId) : "";
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  return unassignEntity(req.params.workspaceId, entityType, entityId, userId);
}));
v1Router.get("/workspaces/:id/users/:userId/assignments", handleAsync(async (req) => {
  const userId = typeof req.params.userId === "string" ? decodeURIComponent(req.params.userId) : "";
  return listEntityAssignmentsByUser(req.params.id, userId);
}));
v1Router.post("/workspaces", requireAdmin, handleAsync((req) => createWorkspace(req.body)));
v1Router.patch("/workspaces/:id", requireAdmin, handleAsync((req) => updateWorkspace(req.params.id, req.body)));
v1Router.delete("/workspaces/:id", requireAdmin, handleAsync(async (req) => {
  await deleteWorkspace(req.params.id);
  return { deleted: true };
}));
v1Router.post("/workspaces/projects/associate", requireAdmin, handleAsync((req) =>
  associateProjectToWorkspace(req.body)
));
v1Router.delete("/workspaces/:workspaceId/projects/:projectId", requireAdmin, handleAsync(async (req) => {
  await dissociateProjectFromWorkspace(req.params.workspaceId, req.params.projectId);
  return { deleted: true };
}));

// ─── Additional infos (per workspace) ─────────────────────────────────────────
v1Router.get("/workspaces/:workspaceId/additional-infos", handleAsync((req) =>
  listAdditionalInfos(req.params.workspaceId).then((rows) => ({ data: rows }))
));
// GET /workspaces/:id per dettaglio workspace (dopo tutte le route più specifiche)
v1Router.get("/workspaces/:id", handleAsync((req) => getWorkspaceById(req.params.id)));
v1Router.post("/additional-infos", requireAdmin, handleAsync((req) => createAdditionalInfo(req.body)));
v1Router.patch("/additional-infos/:id", requireAdmin, handleAsync((req) =>
  updateAdditionalInfo(req.params.id, req.body)
));
v1Router.delete("/additional-infos/:id", requireAdmin, handleAsync((req) =>
  deleteAdditionalInfo(req.params.id)
));

// ─── Workflow ─────────────────────────────────────────────────────────────────
v1Router.get("/workflow/config", handleAsync(async (req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const flowType = (typeof req.query.flowType === "string" ? req.query.flowType : "sell") as "rent" | "sell";
  if (!workspaceId || !projectId) {
    throw new HttpError("Missing workspaceId or projectId query params", 400);
  }
  if (flowType !== "rent" && flowType !== "sell") {
    throw new HttpError("flowType must be rent or sell", 400);
  }
  return getWorkflowConfig(workspaceId, projectId, flowType);
}));

// Workflow engine (stati/transizioni configurabili per workspace)
v1Router.get("/workspaces/:workspaceId/workflows", handleAsync((req) =>
  listWorkflowsByWorkspace(req.params.workspaceId)
));
v1Router.post("/workflows", requireAdmin, handleAsync((req) => createWorkflow(req.body)));
v1Router.post("/workflows/states", requireAdmin, handleAsync((req) => createWorkflowState(req.body)));
v1Router.post("/workflows/transitions", requireAdmin, handleAsync((req) => createWorkflowTransition(req.body)));
v1Router.get("/workflows/:workflowId", handleAsync(async (req) => {
  const detail = await getWorkflowWithStatesAndTransitions(req.params.workflowId);
  if (!detail) throw new HttpError("Workflow not found", 404);
  return detail;
}));

v1Router.get("/inspect/model-sample", handleAsync(async (req) => {
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
  if (!projectId) throw new HttpError("Missing projectId query param", 400);
  return getModelSample({ projectId, workspaceId });
}));

v1Router.post("/reports/:reportType", handleAsync(async (req) => {
  const reportType = req.params.reportType;
  return runReport(reportType, req.body);
}));

v1Router.post("/audit/query", handleAsync(async (req) => {
  const body = req.body as Record<string, unknown>;
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
  if (!workspaceId) throw new HttpError("workspaceId required", 400);
  return queryAuditLog({
    workspaceId,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    entityType: typeof body.entityType === "string" ? body.entityType : undefined,
    entityId: typeof body.entityId === "string" ? body.entityId : undefined,
    actorUserId: typeof body.actorUserId === "string" ? body.actorUserId : undefined,
    action: typeof body.action === "string" ? body.action : undefined,
    dateFrom: typeof body.dateFrom === "string" ? body.dateFrom : undefined,
    dateTo: typeof body.dateTo === "string" ? body.dateTo : undefined,
    page: typeof body.page === "number" ? body.page : 1,
    perPage: typeof body.perPage === "number" ? body.perPage : 25,
  });
}));

// GET /audit/entity/:entityType/:entityId — per tab Timeline in scheda cliente/appartamento
v1Router.get("/audit/entity/:entityType/:entityId", handleAsync(async (req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  if (!workspaceId) throw new HttpError("workspaceId query required", 400);
  const limit = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 25;
  const perPage = Number.isNaN(limit) || limit < 1 ? 25 : Math.min(100, limit);
  return queryAuditLog({
    workspaceId,
    entityType: req.params.entityType,
    entityId: req.params.entityId,
    page: 1,
    perPage,
  });
}));

v1Router.post("/ai/suggestions", handleAsync((req) => generateAiSuggestions(req.body)));
v1Router.post("/ai/approvals", handleAsync((req) => decideAiSuggestion(req.body)));
v1Router.post("/ai/actions/drafts", handleAsync((req) => createAiActionDraft(req.body)));
v1Router.post("/ai/actions/drafts/query", handleAsync((req) => queryAiActionDrafts(req.body)));
v1Router.post("/ai/actions/drafts/:id/decision", handleAsync((req) => decideAiActionDraft(req.params.id, req.body)));
