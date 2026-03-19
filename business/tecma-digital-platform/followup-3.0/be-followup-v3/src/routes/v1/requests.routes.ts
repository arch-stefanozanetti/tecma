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
  getRequestActionById,
} from "../../core/requests/request-actions.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace, requireCanAccessProject } from "../accessMiddleware.js";
import { canAccess } from "../../core/access/canAccess.js";
import { record as auditRecord } from "../../core/audit/audit-log.service.js";
import { dispatchEvent } from "../../core/automations/automation-events.service.js";

export const requestsRoutes = Router();

function toAccessUser(req: { user?: { sub?: string; email?: string; system_role?: string | null; isTecmaAdmin?: boolean } }): { sub: string; email: string; system_role?: string | null; isTecmaAdmin?: boolean } | null {
  const u = req.user;
  if (!u) return null;
  return { sub: u.sub ?? "", email: u.email ?? "", system_role: u.system_role ?? undefined, isTecmaAdmin: u.isTecmaAdmin };
}

requestsRoutes.post("/requests/query", requireCanAccessWorkspace("workspaceId"), handleAsync((req) => queryRequests(req.body)));

requestsRoutes.get("/requests/actions", requireCanAccessWorkspace("workspaceId"), handleAsync((req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const requestId = typeof req.query.requestId === "string" ? req.query.requestId : undefined;
  if (!workspaceId) throw new HttpError("workspaceId query required", 400);
  return listRequestActions(workspaceId, requestId);
}));

requestsRoutes.post("/requests/actions", requireCanAccessWorkspace("workspaceId"), handleAsync((req) =>
  createRequestAction(req.body, { userId: req.user?.sub })
));

requestsRoutes.patch("/requests/actions/:id", handleAsync(async (req) => {
  const action = await getRequestActionById(req.params.id);
  if (!action) throw new HttpError("Action not found", 404);
  const workspaceId = action.workspaceId ?? "";
  if (workspaceId) {
    const user = toAccessUser(req);
    if (!user) throw new HttpError("Unauthorized", 401);
    const ok = await canAccess(user, { type: "workspace", workspaceId });
    if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
  }
  return updateRequestAction(req.params.id, req.body, { userId: req.user?.sub });
}));

requestsRoutes.delete("/requests/actions/:id", handleAsync(async (req) => {
  const action = await getRequestActionById(req.params.id);
  if (!action) throw new HttpError("Action not found", 404);
  const workspaceId = action.workspaceId ?? "";
  if (workspaceId) {
    const user = toAccessUser(req);
    if (!user) throw new HttpError("Unauthorized", 401);
    const ok = await canAccess(user, { type: "workspace", workspaceId });
    if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
  }
  return deleteRequestAction(req.params.id);
}));

requestsRoutes.get("/requests/:id", handleAsync(async (req) => {
  const result = await getRequestById(req.params.id);
  const workspaceId = result.request?.workspaceId ?? "";
  if (workspaceId) {
    const user = toAccessUser(req);
    if (!user) throw new HttpError("Unauthorized", 401);
    const ok = await canAccess(user, { type: "workspace", workspaceId });
    if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
  }
  return result;
}));

requestsRoutes.post("/requests", requireCanAccessProject("workspaceId", "projectId"), handleAsync(async (req) => {
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
    }).catch((err) => console.warn("[audit] failed", err));
    dispatchEvent(workspaceId, "request.created", {
      workspaceId,
      projectId: req.body.projectId,
      entityType: "request",
      entityId: result.request._id,
      toStatus: result.request.status,
    }).catch((err) => console.warn("[event] failed", err));
  }
  return result;
}));

requestsRoutes.patch("/requests/:id/status", handleAsync(async (req) => {
  const existing = await getRequestById(req.params.id);
  const workspaceId = existing.request?.workspaceId ?? "";
  if (workspaceId) {
    const user = toAccessUser(req);
    if (!user) throw new HttpError("Unauthorized", 401);
    const ok = await canAccess(user, { type: "workspace", workspaceId });
    if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
  }
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
      }).catch((err) => console.warn("[audit] failed", err));
      dispatchEvent(workspaceId, "request.status_changed", {
        workspaceId,
        projectId: reqDoc.request.projectId,
        entityType: "request",
        entityId: req.params.id,
        toStatus: req.body.status,
      }).catch((err) => console.warn("[event] failed", err));
    }
  }
  return result;
}));

requestsRoutes.get("/requests/:id/transitions", handleAsync(async (req) => {
  const existing = await getRequestById(req.params.id);
  const workspaceId = existing.request?.workspaceId ?? "";
  if (workspaceId) {
    const user = toAccessUser(req);
    if (!user) throw new HttpError("Unauthorized", 401);
    const ok = await canAccess(user, { type: "workspace", workspaceId });
    if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
  }
  return listRequestTransitions(req.params.id);
}));

requestsRoutes.post("/requests/:id/revert", handleAsync(async (req) => {
  const existing = await getRequestById(req.params.id);
  const workspaceId = existing.request?.workspaceId ?? "";
  if (workspaceId) {
    const user = toAccessUser(req);
    if (!user) throw new HttpError("Unauthorized", 401);
    const ok = await canAccess(user, { type: "workspace", workspaceId });
    if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
  }
  const body = z.object({ transitionId: z.string().min(1) }).parse(req.body);
  return revertRequestStatus(req.params.id, body.transitionId, { userId: req.user?.sub });
}));
