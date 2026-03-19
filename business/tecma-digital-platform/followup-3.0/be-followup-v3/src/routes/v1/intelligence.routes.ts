import { Router } from "express";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { getModelSample } from "../../core/inspect/inspect.service.js";
import { runReport } from "../../core/reports/reports.service.js";
import { queryAuditLog } from "../../core/audit/audit-log.service.js";
import { generateAiSuggestions, decideAiSuggestion } from "../../core/ai/orchestrator.service.js";
import { createAiActionDraft, queryAiActionDrafts, decideAiActionDraft } from "../../core/ai/action-engine.service.js";

export const intelligenceRoutes = Router();

intelligenceRoutes.get(
  "/inspect/model-sample",
  handleAsync((req) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined;
    if (!projectId) throw new HttpError("Missing projectId query param", 400);
    return getModelSample({ projectId, workspaceId });
  })
);

intelligenceRoutes.post("/reports/:reportType", handleAsync((req) => runReport(req.params.reportType, req.body)));

intelligenceRoutes.post(
  "/audit/query",
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

intelligenceRoutes.post("/ai/suggestions", handleAsync((req) => generateAiSuggestions(req.body)));
intelligenceRoutes.post("/ai/approvals", handleAsync((req) => decideAiSuggestion(req.body)));
intelligenceRoutes.post("/ai/actions/drafts", handleAsync((req) => createAiActionDraft(req.body)));
intelligenceRoutes.post("/ai/actions/drafts/query", handleAsync((req) => queryAiActionDrafts(req.body)));
intelligenceRoutes.post(
  "/ai/actions/drafts/:id/decision",
  handleAsync((req) => decideAiActionDraft(req.params.id, req.body))
);
