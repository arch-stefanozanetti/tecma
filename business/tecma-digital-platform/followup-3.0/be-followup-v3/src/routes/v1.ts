import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { getPriceAvailabilityMatrix } from "../core/price-availability-matrix/price-availability-matrix.service.js";
import { decideAiSuggestion, generateAiSuggestions } from "../core/ai/orchestrator.service.js";
import { createAiActionDraft, decideAiActionDraft, queryAiActionDrafts } from "../core/ai/action-engine.service.js";
import {
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
import {
  listByWorkspace as listAdditionalInfos,
  createAdditionalInfo,
  updateAdditionalInfo,
  deleteAdditionalInfo,
} from "../core/additional-infos/additional-infos.service.js";
import {
  listCustomerNeeds,
  getCustomerNeedById,
  createCustomerNeed,
  updateCustomerNeed,
} from "../core/product-discovery/customer-needs.service.js";
import {
  listInitiatives,
  listSuggestedRoadmap,
  getInitiativeById,
  createInitiative,
  updateInitiative,
} from "../core/product-discovery/initiatives.service.js";
import {
  listOpportunities,
  listTopProblems,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
} from "../core/product-discovery/opportunities.service.js";
import {
  listFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
} from "../core/product-discovery/features.service.js";
import { HttpError } from "../types/http.js";
import { handleAsync, sendError } from "./asyncHandler.js";
import { PERMISSIONS } from "../core/rbac/permissions.js";
import { writeAuditLog } from "../core/audit/audit.service.js";
import {
  inviteUser,
  findUserById,
  updateUserById,
  deleteUserById
} from "../core/users/users-mutations.service.js";
import { requireAuth, requireAdmin } from "./authMiddleware.js";
import { accessLoggerMiddleware } from "./accessLoggerMiddleware.js";
import { requirePermission, requireAnyPermission } from "./permissionMiddleware.js";
import { publicRoutes } from "./v1/public.routes.js";
import { projectsRoutes } from "./v1/projects.routes.js";
import { connectorsRoutes } from "./v1/connectors.routes.js";
import { communicationsRoutes } from "./v1/communications.routes.js";
import { authRoutes } from "./v1/auth.routes.js";
import { calendarRoutes } from "./v1/calendar.routes.js";
import { clientsRoutes } from "./v1/clients.routes.js";
import { requestsRoutes } from "./v1/requests.routes.js";
import { sessionRoutes } from "./v1/session.routes.js";
import { notificationsRoutes } from "./v1/notifications.routes.js";
import { automationRulesRoutes } from "./v1/automation-rules.routes.js";
import { apartmentsRoutes } from "./v1/apartments.routes.js";
import { record as auditRecord, queryAuditLog } from "../core/audit/audit-log.service.js";
import {
  listByWorkspace as listWebhookConfigs,
  create as createWebhookConfig,
  getById as getWebhookConfigById,
  update as updateWebhookConfig,
  remove as removeWebhookConfig,
} from "../core/automations/webhook-configs.service.js";
import { runReport } from "../core/reports/reports.service.js";
import {
  listEmailFlows,
  getEmailFlow,
  upsertEmailFlow,
  previewEmailFlow,
  previewEmailFlowFromLayout,
} from "../core/email/emailFlows.service.js";
import { emailLayoutSchema } from "../core/email/emailLayout.schema.js";
import { uploadEmailFlowAsset } from "../core/email/emailFlowAssetUpload.service.js";
import { getSuggestedEmailTemplate } from "../core/email/email.service.js";

const EmailFlowKeySchema = z.enum(["user_invite", "password_reset", "email_verification"]);

const emailFlowUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

export const v1Router = Router();

v1Router.use(accessLoggerMiddleware);
v1Router.use("/", publicRoutes);

// ─── Protected routes (require valid JWT) ────────────────────────────────────
v1Router.use(requireAuth);

v1Router.use("/", projectsRoutes);
v1Router.use("/", connectorsRoutes);
v1Router.use("/", communicationsRoutes);
v1Router.use("/", authRoutes);
v1Router.use("/", calendarRoutes);
v1Router.use("/", clientsRoutes);
v1Router.use("/", requestsRoutes);
v1Router.use("/", sessionRoutes);
v1Router.use("/", notificationsRoutes);
v1Router.use("/", automationRulesRoutes);
v1Router.use("/", apartmentsRoutes);

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

// ─── Users (permesso users.read = tipicamente solo admin via *) ───────────────
v1Router.get("/users", requirePermission(PERMISSIONS.USERS_READ), handleAsync(() => listUsersWithVisibility()));

v1Router.post(
  "/users",
  requireAnyPermission(PERMISSIONS.USERS_INVITE, PERMISSIONS.USERS_CREATE),
  handleAsync(async (req) => {
    const body = z
      .object({
        email: z.string().email(),
        role: z.string().min(1),
        projectId: z.string().min(1),
        projectName: z.string().min(1).optional(),
        /** Opzionale: base URL FE; se assente si usa header Origin / Referer / APP_PUBLIC_URL */
        appPublicUrl: z.string().url().optional()
      })
      .parse(req.body);
    const { resolveInviteAppBaseUrl } = await import("../utils/inviteLinkBaseUrl.js");
    const appPublicBaseUrl = resolveInviteAppBaseUrl(req, body.appPublicUrl ?? null);
    const result = await inviteUser({
      email: body.email,
      role: body.role,
      projectId: body.projectId,
      projectName: body.projectName ?? body.projectId,
      appPublicBaseUrl
    });
    await writeAuditLog({
      userId: req.user!.sub,
      action: "user.invite",
      entityType: "user",
      entityId: result.userId,
      changes: { after: { email: body.email, role: body.role, projectId: body.projectId } },
      projectId: req.user!.projectId ?? body.projectId
    });
    return result;
  })
);

v1Router.patch("/users/:id", requirePermission(PERMISSIONS.USERS_UPDATE), handleAsync(async (req) => {
  const id = req.params.id;
  const before = await findUserById(id);
  if (!before) throw new HttpError("Utente non trovato", 404);
  const body = z
    .object({
      role: z.string().optional(),
      status: z.enum(["invited", "active", "disabled"]).optional(),
      permissions_override: z.array(z.string()).optional(),
      isDisabled: z.boolean().optional()
    })
    .parse(req.body);
  const after = await updateUserById(id, body);
  const safe = (u: typeof before) => ({
    email: u.email,
    role: u.role,
    status: u.status,
    permissions_override: u.permissions_override,
    isDisabled: u.isDisabled
  });
  await writeAuditLog({
    userId: req.user!.sub,
    action: "user.update",
    entityType: "user",
    entityId: id,
    changes: { before: safe(before), after: after ? safe(after) : null },
    projectId: req.user!.projectId
  });
  return { ok: true, user: after };
}));

v1Router.delete("/users/:id", requirePermission(PERMISSIONS.USERS_DELETE), handleAsync(async (req) => {
  const id = req.params.id;
  const before = await findUserById(id);
  if (!before) throw new HttpError("Utente non trovato", 404);
  await writeAuditLog({
    userId: req.user!.sub,
    action: "user.delete",
    entityType: "user",
    entityId: id,
    changes: {
      before: { email: before.email, role: before.role }
    },
    projectId: req.user!.projectId
  });
  const ok = await deleteUserById(id);
  if (!ok) throw new HttpError("Eliminazione non riuscita", 500);
  return { ok: true };
}));

// ─── Email transazionali (admin) ──────────────────────────────────────────────
v1Router.get(
  "/admin/email-flows",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  handleAsync(() => listEmailFlows())
);

v1Router.get(
  "/admin/email-flows/:flowKey/suggested",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  handleAsync(async (req) => {
    const flowKey = EmailFlowKeySchema.parse(req.params.flowKey);
    return getSuggestedEmailTemplate(flowKey);
  })
);

v1Router.get(
  "/admin/email-flows/:flowKey",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  handleAsync(async (req) => {
    const flowKey = EmailFlowKeySchema.parse(req.params.flowKey);
    const item = await getEmailFlow(flowKey);
    if (!item) throw new HttpError("Flusso non trovato", 404);
    return item;
  })
);

v1Router.put(
  "/admin/email-flows/:flowKey",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  handleAsync(async (req) => {
    const flowKey = EmailFlowKeySchema.parse(req.params.flowKey);
    const raw = req.body as Record<string, unknown>;
    const enabled = z.boolean().parse(raw.enabled);
    const subject = z.string().max(500).parse(raw.subject);
    const editorMode =
      raw.editorMode === "blocks" ? ("blocks" as const) : ("html" as const);
    let payload:
      | { editorMode: "html"; enabled: boolean; subject: string; bodyHtml: string }
      | { editorMode: "blocks"; enabled: boolean; subject: string; layout: z.infer<typeof emailLayoutSchema> };
    if (editorMode === "blocks") {
      const layout = emailLayoutSchema.parse(raw.layout);
      payload = { editorMode: "blocks", enabled, subject, layout };
    } else {
      const bodyHtml = z.string().max(200_000).parse(raw.bodyHtml ?? "");
      payload = { editorMode: "html", enabled, subject, bodyHtml };
    }
    if (payload.enabled && !subject.trim()) {
      throw new HttpError("Con template attivo serve un oggetto non vuoto", 400);
    }
    const updatedBy = req.user!.email || req.user!.sub;
    let item;
    try {
      item = await upsertEmailFlow(flowKey, payload, updatedBy);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpError(msg, 400);
    }
    await writeAuditLog({
      userId: req.user!.sub,
      action: "email_flow.update",
      entityType: "email_flow",
      entityId: flowKey,
      changes: { after: { enabled: payload.enabled, editorMode: payload.editorMode } },
      projectId: req.user!.projectId
    });
    return item;
  })
);

v1Router.post(
  "/admin/email-flows/upload-asset",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  emailFlowUpload.single("file"),
  handleAsync(async (req) => {
    const f = req.file;
    if (!f?.buffer) throw new HttpError("Nessun file (campo: file)", 400);
    try {
      const url = await uploadEmailFlowAsset(f.buffer, f.mimetype);
      return { url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpError(msg, 400);
    }
  })
);

v1Router.post(
  "/admin/email-flows/:flowKey/preview",
  requirePermission(PERMISSIONS.EMAIL_FLOWS_MANAGE),
  handleAsync(async (req) => {
    const flowKey = EmailFlowKeySchema.parse(req.params.flowKey);
    const body = z
      .object({
        subject: z.string(),
        bodyHtml: z.string().optional(),
        layout: emailLayoutSchema.optional(),
        sampleVars: z.record(z.string()).optional()
      })
      .parse(req.body);
    if (body.layout) {
      return previewEmailFlowFromLayout(flowKey, body.subject, body.layout, body.sampleVars ?? {});
    }
    const html = body.bodyHtml ?? "";
    return previewEmailFlow(flowKey, body.subject, html, body.sampleVars ?? {});
  })
);

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

// ─── Product Discovery (admin only) ───────────────────────────────────────────
v1Router.get("/customer-needs", requireAdmin, handleAsync(async (req) => {
  const opportunityId = typeof req.query.opportunityId === "string" ? req.query.opportunityId : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  return listCustomerNeeds({ opportunityId, status });
}));
v1Router.post("/customer-needs", requireAdmin, handleAsync(async (req) => {
  const createdBy = typeof req.user?.sub === "string" ? req.user.sub : undefined;
  return createCustomerNeed(req.body, createdBy);
}));
v1Router.get("/customer-needs/:id", requireAdmin, handleAsync((req) => getCustomerNeedById(req.params.id)));
v1Router.patch("/customer-needs/:id", requireAdmin, handleAsync((req) => updateCustomerNeed(req.params.id, req.body)));

v1Router.get("/opportunities", requireAdmin, handleAsync(async (req) => {
  const initiativeId = typeof req.query.initiativeId === "string" ? req.query.initiativeId : undefined;
  return listOpportunities({ initiativeId });
}));
v1Router.post("/opportunities", requireAdmin, handleAsync((req) => createOpportunity(req.body)));
v1Router.get("/opportunities/:id", requireAdmin, handleAsync((req) => getOpportunityById(req.params.id)));
v1Router.patch("/opportunities/:id", requireAdmin, handleAsync((req) => updateOpportunity(req.params.id, req.body)));

v1Router.get("/initiatives", requireAdmin, handleAsync(() => listInitiatives()));
v1Router.post("/initiatives", requireAdmin, handleAsync((req) => createInitiative(req.body)));
v1Router.get("/initiatives/:id", requireAdmin, handleAsync((req) => getInitiativeById(req.params.id)));
v1Router.patch("/initiatives/:id", requireAdmin, handleAsync((req) => updateInitiative(req.params.id, req.body)));

v1Router.get("/product-discovery/suggested-roadmap", requireAdmin, handleAsync(() => listSuggestedRoadmap()));
v1Router.get("/product-discovery/top-problems", requireAdmin, handleAsync(() => listTopProblems()));

v1Router.get("/features", requireAdmin, handleAsync(async (req) => {
  const initiativeId = typeof req.query.initiativeId === "string" ? req.query.initiativeId : undefined;
  return listFeatures({ initiativeId });
}));
v1Router.post("/features", requireAdmin, handleAsync((req) => createFeature(req.body)));
v1Router.get("/features/:id", requireAdmin, handleAsync((req) => getFeatureById(req.params.id)));
v1Router.patch("/features/:id", requireAdmin, handleAsync((req) => updateFeature(req.params.id, req.body)));

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
