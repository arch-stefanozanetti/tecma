import { Router } from "express";
import { z } from "zod";
import {
  queryRequests,
  getRequestById,
  createRequest,
  updateRequestStatus,
  listRequestTransitions,
  revertRequestStatus,
} from "../../core/requests/requests.service.js";
import {
  listRequestActions,
  createRequestAction,
  updateRequestAction,
  deleteRequestAction,
} from "../../core/requests/request-actions.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { record as auditRecord } from "../../core/audit/audit-log.service.js";
import { dispatchEvent } from "../../core/automations/automation-events.service.js";
import { safeAsync } from "../../core/shared/safeAsync.js";

export const requestsRoutes = Router();

const parseScope = (req: { query: Record<string, unknown> }): { workspaceId: string; projectIds: string[] } => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  const projectIdsRaw = typeof req.query.projectIds === "string" ? req.query.projectIds : "";
  const projectIds = projectIdsRaw ? projectIdsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return { workspaceId, projectIds };
};

requestsRoutes.post("/requests/query", handleAsync((req) => queryRequests(req.body)));

requestsRoutes.get("/requests/actions", handleAsync((req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const requestId = typeof req.query.requestId === "string" ? req.query.requestId : undefined;
  if (!workspaceId) throw new HttpError("workspaceId query required", 400);
  return listRequestActions(workspaceId, requestId);
}));

requestsRoutes.post("/requests/actions", handleAsync((req) =>
  createRequestAction(req.body, { userId: req.user?.sub })
));

requestsRoutes.patch("/requests/actions/:id", handleAsync((req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  if (!workspaceId) throw new HttpError("workspaceId query required", 400, { code: "WORKSPACE_REQUIRED" });
  return updateRequestAction(req.params.id, req.body, {
    userId: req.user?.sub,
    workspaceId,
  });
}));

requestsRoutes.delete("/requests/actions/:id", handleAsync((req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  if (!workspaceId) throw new HttpError("workspaceId query required", 400, { code: "WORKSPACE_REQUIRED" });
  return deleteRequestAction(req.params.id, { workspaceId });
}));
requestsRoutes.get("/requests/:id", handleAsync((req) => {
  const { workspaceId, projectIds } = parseScope(req);
  if (!workspaceId) throw new HttpError("workspaceId query required", 400, { code: "WORKSPACE_REQUIRED" });
  return getRequestById(req.params.id, { workspaceId, projectIds });
}));

requestsRoutes.post("/requests", handleAsync(async (req) => {
  const result = await createRequest(req.body);
  const workspaceId = req.body.workspaceId as string | undefined;
  if (result?.request?._id && workspaceId) {
    safeAsync(auditRecord({
      action: "request.created",
      workspaceId,
      projectId: req.body.projectId,
      entityType: "request",
      entityId: result.request._id,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: { status: result.request.status },
    }), {
      operation: "audit.request.created",
      workspaceId,
      projectId: req.body.projectId,
      entityType: "request",
      entityId: result.request._id,
      userId: req.user?.sub,
    });
    safeAsync(dispatchEvent(workspaceId, "request.created", {
      workspaceId,
      projectId: req.body.projectId,
      entityType: "request",
      entityId: result.request._id,
      toStatus: result.request.status,
    }), {
      operation: "event.request.created",
      workspaceId,
      projectId: req.body.projectId,
      entityType: "request",
      entityId: result.request._id,
      userId: req.user?.sub,
    });
  }
  return result;
}));

requestsRoutes.patch("/requests/:id/status", handleAsync(async (req) => {
  const workspaceId = typeof req.body?.workspaceId === "string" ? req.body.workspaceId.trim() : "";
  if (!workspaceId) throw new HttpError("workspaceId required in body", 400, { code: "WORKSPACE_REQUIRED" });
  const projectIds =
    Array.isArray(req.body?.projectIds) && req.body.projectIds.every((p: unknown) => typeof p === "string")
      ? (req.body.projectIds as string[]).map((p) => p.trim()).filter(Boolean)
      : typeof req.body?.projectId === "string" && req.body.projectId.trim()
        ? [req.body.projectId.trim()]
        : [];
  const result = await updateRequestStatus(req.params.id, req.body, {
    userId: req.user?.sub,
    workspaceId,
    projectIds,
  });
  if (req.body.status) {
    const reqDoc = await getRequestById(req.params.id, { workspaceId, projectIds }).catch(() => null);
    const scopedWorkspaceId = reqDoc?.request?.workspaceId ?? workspaceId;
    if (reqDoc?.request && scopedWorkspaceId) {
      safeAsync(auditRecord({
        action: "request.status_changed",
        workspaceId: scopedWorkspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { toStatus: req.body.status, reason: req.body.reason },
      }), {
        operation: "audit.request.status_changed",
        workspaceId: scopedWorkspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        userId: req.user?.sub,
      });
      safeAsync(dispatchEvent(scopedWorkspaceId, "request.status_changed", {
        workspaceId: scopedWorkspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        toStatus: req.body.status,
      }), {
        operation: "event.request.status_changed",
        workspaceId: scopedWorkspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        userId: req.user?.sub,
      });
    }
  }
  return result;
}));

requestsRoutes.get("/requests/:id/transitions", handleAsync(async (req) => {
  const { workspaceId, projectIds } = parseScope(req);
  if (!workspaceId) throw new HttpError("workspaceId query required", 400, { code: "WORKSPACE_REQUIRED" });
  await getRequestById(req.params.id, { workspaceId, projectIds });
  return listRequestTransitions(req.params.id);
}));

requestsRoutes.post("/requests/:id/revert", handleAsync(async (req) => {
  const workspaceId = typeof req.body?.workspaceId === "string" ? req.body.workspaceId.trim() : "";
  if (!workspaceId) throw new HttpError("workspaceId required in body", 400, { code: "WORKSPACE_REQUIRED" });
  const body = z.object({ transitionId: z.string().min(1) }).parse(req.body);
  const projectIds =
    Array.isArray(req.body?.projectIds) && req.body.projectIds.every((p: unknown) => typeof p === "string")
      ? (req.body.projectIds as string[]).map((p) => p.trim()).filter(Boolean)
      : typeof req.body?.projectId === "string" && req.body.projectId.trim()
        ? [req.body.projectId.trim()]
        : [];
  await getRequestById(req.params.id, { workspaceId, projectIds });
  return revertRequestStatus(req.params.id, body.transitionId, { userId: req.user?.sub });
}));
