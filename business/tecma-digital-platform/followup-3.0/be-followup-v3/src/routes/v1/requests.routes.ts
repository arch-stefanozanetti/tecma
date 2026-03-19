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

requestsRoutes.patch("/requests/actions/:id", handleAsync((req) =>
  updateRequestAction(req.params.id, req.body, { userId: req.user?.sub })
));

requestsRoutes.delete("/requests/actions/:id", handleAsync((req) => deleteRequestAction(req.params.id)));
requestsRoutes.get("/requests/:id", handleAsync((req) => getRequestById(req.params.id)));

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
  const result = await updateRequestStatus(req.params.id, req.body, { userId: req.user?.sub });
  if (req.body.status) {
    const reqDoc = await getRequestById(req.params.id).catch(() => null);
    const workspaceId = reqDoc?.request?.workspaceId;
    if (workspaceId) {
      safeAsync(auditRecord({
        action: "request.status_changed",
        workspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { toStatus: req.body.status, reason: req.body.reason },
      }), {
        operation: "audit.request.status_changed",
        workspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        userId: req.user?.sub,
      });
      safeAsync(dispatchEvent(workspaceId, "request.status_changed", {
        workspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        toStatus: req.body.status,
      }), {
        operation: "event.request.status_changed",
        workspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        userId: req.user?.sub,
      });
    }
  }
  return result;
}));

requestsRoutes.get("/requests/:id/transitions", handleAsync((req) => listRequestTransitions(req.params.id)));

requestsRoutes.post("/requests/:id/revert", handleAsync(async (req) => {
  const body = z.object({ transitionId: z.string().min(1) }).parse(req.body);
  return revertRequestStatus(req.params.id, body.transitionId, { userId: req.user?.sub });
}));
