import { ObjectId } from "mongodb";
import { Router } from "express";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { getDb } from "../../config/db.js";
import { canAccess } from "../../core/access/canAccess.js";
import { getModelSample } from "../../core/inspect/inspect.service.js";
import { runReport } from "../../core/reports/reports.service.js";
import {
  createReportDefinitionSnapshot,
  createReportSnapshot,
  getRealtimeReport,
  listReportSnapshots,
  revokeReportSnapshot,
  runAiRealtimeQuery
} from "../../core/reports/realtime-reports.service.js";
import { queryAuditLog } from "../../core/audit/audit-log.service.js";
import { generateAiSuggestions, queryPendingAiSuggestions, decideAiSuggestion } from "../../core/ai/orchestrator.service.js";
import { createAiActionDraft, queryAiActionDrafts, decideAiActionDraft } from "../../core/ai/action-engine.service.js";
import { executeSuggestionWithAgent } from "../../core/ai/suggestion-agent.service.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { requireWorkspaceEntitled, workspaceIdFromBodyOrQuery } from "../workspaceEntitlementMiddleware.js";
import {
  createReportDefinition,
  deleteReportDefinition,
  listReportDefinitions,
  updateReportDefinition,
} from "../../core/reports/report-definitions.service.js";
import { isWorkspaceEntitledToFeature } from "../../core/workspaces/workspace-entitlements.service.js";

export const intelligenceRoutes = Router();

intelligenceRoutes.get(
  "/inspect/model-sample",
  requirePermission(PERMISSIONS.SETTINGS_READ),
  handleAsync((req) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
    if (!projectId) throw new HttpError("Missing projectId query param", 400);
    return getModelSample({ projectId, workspaceId });
  })
);

intelligenceRoutes.post(
  "/reports/:reportType",
  requirePermission(PERMISSIONS.REPORTS_READ),
  requireWorkspaceEntitled("reports", workspaceIdFromBodyOrQuery),
  handleAsync((req) => runReport(req.params.reportType, req.body))
);

intelligenceRoutes.get(
  "/report-definitions",
  requirePermission(PERMISSIONS.REPORTS_READ),
  requireCanAccessWorkspace(),
  handleAsync((req) => {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
    if (!workspaceId) throw new HttpError("workspaceId query required", 400);
    return listReportDefinitions(workspaceId);
  })
);

intelligenceRoutes.post(
  "/report-definitions",
  requirePermission(PERMISSIONS.REPORTS_READ),
  requireCanAccessWorkspace(),
  handleAsync((req) => {
    const userId = req.user?.sub;
    return createReportDefinition(req.body, { userId });
  })
);

intelligenceRoutes.patch(
  "/report-definitions/:id",
  requirePermission(PERMISSIONS.REPORTS_READ),
  requireCanAccessWorkspace(),
  handleAsync((req) => {
    const userId = req.user?.sub;
    return updateReportDefinition(req.params.id, { ...req.body, workspaceId: req.body?.workspaceId }, { userId });
  })
);

intelligenceRoutes.delete(
  "/report-definitions/:id",
  requirePermission(PERMISSIONS.REPORTS_READ),
  requireCanAccessWorkspace(),
  handleAsync((req) => {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
    if (!workspaceId) throw new HttpError("workspaceId query required", 400);
    return deleteReportDefinition(req.params.id, workspaceId);
  })
);

intelligenceRoutes.get(
  "/reports/realtime/kpi-summary",
  requirePermission(PERMISSIONS.REPORTS_READ),
  handleAsync((req) =>
    getRealtimeReport("kpi_summary", {
      workspaceId: typeof req.query.workspaceId === "string" ? req.query.workspaceId : "",
      projectIds:
        typeof req.query.projectIds === "string"
          ? req.query.projectIds.split(",").map((it) => it.trim()).filter(Boolean)
          : [],
    })
  )
);

intelligenceRoutes.get(
  "/reports/realtime/funnel",
  requirePermission(PERMISSIONS.REPORTS_READ),
  handleAsync((req) =>
    getRealtimeReport("pipeline", {
      workspaceId: typeof req.query.workspaceId === "string" ? req.query.workspaceId : "",
      projectIds:
        typeof req.query.projectIds === "string"
          ? req.query.projectIds.split(",").map((it) => it.trim()).filter(Boolean)
          : [],
    })
  )
);

intelligenceRoutes.get(
  "/reports/realtime/conversions",
  requirePermission(PERMISSIONS.REPORTS_READ),
  handleAsync((req) =>
    getRealtimeReport("clients_by_status", {
      workspaceId: typeof req.query.workspaceId === "string" ? req.query.workspaceId : "",
      projectIds:
        typeof req.query.projectIds === "string"
          ? req.query.projectIds.split(",").map((it) => it.trim()).filter(Boolean)
          : [],
    })
  )
);

intelligenceRoutes.post(
  "/reports/ai-query",
  requirePermission(PERMISSIONS.REPORTS_READ),
  handleAsync((req) => runAiRealtimeQuery(req.body))
);

intelligenceRoutes.post(
  "/reports/share",
  requirePermission(PERMISSIONS.REPORTS_READ),
  handleAsync((req) => createReportSnapshot(req.body))
);

intelligenceRoutes.post(
  "/reports/share-definition",
  requirePermission(PERMISSIONS.REPORTS_READ),
  requireCanAccessWorkspace(),
  handleAsync((req) => createReportDefinitionSnapshot(req.body))
);

intelligenceRoutes.get(
  "/reports/share/list",
  requirePermission(PERMISSIONS.REPORTS_READ),
  handleAsync((req) =>
    listReportSnapshots({
      workspaceId: typeof req.query.workspaceId === "string" ? req.query.workspaceId : "",
      limit: typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : undefined,
    })
  )
);

intelligenceRoutes.post(
  "/reports/share/:snapshotId/revoke",
  requirePermission(PERMISSIONS.REPORTS_READ),
  handleAsync((req) => {
    const workspaceId = typeof req.body?.workspaceId === "string" ? req.body.workspaceId : "";
    if (!workspaceId) throw new HttpError("workspaceId required", 400);
    return revokeReportSnapshot(req.params.snapshotId, workspaceId);
  })
);

intelligenceRoutes.post(
  "/audit/query",
  requirePermission(PERMISSIONS.SETTINGS_READ),
  handleAsync((req) => {
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
  })
);

intelligenceRoutes.get(
  "/audit/entity/:entityType/:entityId",
  requirePermission(PERMISSIONS.SETTINGS_READ),
  handleAsync((req) => {
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
  })
);

intelligenceRoutes.get(
  "/ai/suggestions",
  requirePermission(PERMISSIONS.REQUESTS_READ),
  requireWorkspaceEntitled("aiApprovals", workspaceIdFromBodyOrQuery),
  handleAsync(async (req) => {
    const user = req.user;
    if (!user?.email) throw new HttpError("Unauthorized", 401);
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
    if (!workspaceId) throw new HttpError("workspaceId query required", 400);
    const allowed = await canAccess(
      {
        sub: user.sub ?? "",
        email: user.email,
        system_role: user.system_role,
        isTecmaAdmin: user.isAdmin
      },
      { type: "workspace", workspaceId }
    );
    if (!allowed) throw new HttpError("Accesso al workspace non consentito", 403);

    const limitRaw = typeof req.query.limit === "string" ? parseInt(req.query.limit, 10) : 20;
    const limit = Number.isNaN(limitRaw) ? 20 : Math.min(50, Math.max(1, limitRaw));
    const raw = req.query.projectIds;
    const projectIds = Array.isArray(raw)
      ? raw.map((x) => String(x).trim()).filter(Boolean)
      : typeof raw === "string"
        ? raw.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
    if (projectIds.length === 0) throw new HttpError("projectIds query required (repeat param or comma-separated)", 400);

    return queryPendingAiSuggestions({ workspaceId, projectIds, limit });
  })
);

intelligenceRoutes.post(
  "/ai/suggestions",
  requirePermission(PERMISSIONS.REQUESTS_UPDATE),
  requireWorkspaceEntitled("aiApprovals", workspaceIdFromBodyOrQuery),
  handleAsync((req) => generateAiSuggestions(req.body))
);
intelligenceRoutes.post(
  "/ai/suggestions/:suggestionId/execute",
  requirePermission(PERMISSIONS.REQUESTS_UPDATE),
  handleAsync(async (req) => {
    const user = req.user;
    if (!user?.email) throw new HttpError("Unauthorized", 401);
    const suggestionId = req.params.suggestionId;
    if (!ObjectId.isValid(suggestionId)) throw new HttpError("Invalid suggestion id", 400);
    const db = getDb();
    const doc = await db.collection("tz_ai_suggestions").findOne({ _id: new ObjectId(suggestionId) });
    if (!doc) throw new HttpError("Suggestion not found", 404);
    const workspaceId = String(doc.workspaceId ?? "");
    const allowed = await canAccess(
      {
        sub: user.sub ?? "",
        email: user.email,
        system_role: user.system_role,
        isTecmaAdmin: user.isTecmaAdmin === true
      },
      { type: "workspace", workspaceId }
    );
    if (!allowed) throw new HttpError("Accesso al workspace non consentito", 403);
    const entitledAi = await isWorkspaceEntitledToFeature(workspaceId, "aiApprovals");
    if (!entitledAi) throw new HttpError("Funzionalità non abilitata per questo workspace", 403, "FEATURE_NOT_ENTITLED");
    const projectIds = Array.isArray(doc.projectIds) ? doc.projectIds.map((x: unknown) => String(x)) : [];
    return executeSuggestionWithAgent(suggestionId, req.body, {
      workspaceId,
      projectIds,
      actorEmail: user.email,
      actorIsAdmin: user.isAdmin,
      actorIsTecmaAdmin: user.isTecmaAdmin === true
    });
  })
);
intelligenceRoutes.post("/ai/approvals", requirePermission(PERMISSIONS.REQUESTS_UPDATE), handleAsync((req) => decideAiSuggestion(req.body)));
intelligenceRoutes.post(
  "/ai/actions/drafts",
  requirePermission(PERMISSIONS.REQUESTS_UPDATE),
  requireWorkspaceEntitled("aiApprovals", workspaceIdFromBodyOrQuery),
  handleAsync((req) => createAiActionDraft(req.body))
);
intelligenceRoutes.post(
  "/ai/actions/drafts/query",
  requirePermission(PERMISSIONS.REQUESTS_READ),
  requireWorkspaceEntitled("aiApprovals", workspaceIdFromBodyOrQuery),
  handleAsync((req) => queryAiActionDrafts(req.body))
);
intelligenceRoutes.post(
  "/ai/actions/drafts/:id/decision",
  requirePermission(PERMISSIONS.REQUESTS_UPDATE),
  handleAsync((req) => decideAiActionDraft(req.params.id, req.body))
);
