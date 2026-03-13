import { Router } from "express";
import { z } from "zod";
import { queryCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from "../core/calendar/calendar.service.js";
import { queryClients, createClient, updateClient, getClientById } from "../core/clients/clients.service.js";
import { queryApartments } from "../core/apartments/apartments.service.js";
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
import { createProject } from "../core/projects/projects.service.js";
import {
  getProjectDetail,
  getProjectPolicies,
  putProjectPolicies,
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
  auditRecord({
    action: "client.created",
    workspaceId: req.body.workspaceId,
    projectId: req.body.projectId,
    entityType: "client",
    entityId: result.client._id,
    actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
    payload: { fullName: result.client.fullName },
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
  if (result?.request?._id && req.body.workspaceId) {
    auditRecord({
      action: "request.created",
      workspaceId: req.body.workspaceId,
      projectId: req.body.projectId,
      entityType: "request",
      entityId: result.request._id,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: { status: result.request.status },
    }).catch(() => {});
  }
  return result;
}));
v1Router.patch("/requests/:id/status", handleAsync(async (req) => {
  const result = await updateRequestStatus(req.params.id, req.body, { userId: req.user?.sub });
  if (req.body.status) {
    const reqDoc = await getRequestById(req.params.id).catch(() => null);
    if (reqDoc?.request?.workspaceId) {
      auditRecord({
        action: "request.status_changed",
        workspaceId: reqDoc.request.workspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { toStatus: req.body.status, reason: req.body.reason },
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
      entityId: result.association._id,
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

// ─── Workspaces ──────────────────────────────────────────────────────────────
v1Router.get("/workspaces", handleAsync(() => listWorkspaces()));
v1Router.get("/workspaces/:id/users", handleAsync(async (_req) => ({ data: [] })));
v1Router.get("/workspaces/:id/projects", handleAsync((req) =>
  listWorkspaceProjects(req.params.id).then((rows) => ({ data: rows }))
));
v1Router.get("/workspaces/:workspaceId/entities/:entityType/:entityId/assignments", handleAsync(async (_req) => ({ data: [] })));
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
