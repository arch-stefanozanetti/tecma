import { Router } from "express";
import { z } from "zod";
import { getClientById, queryClients, createClient, updateClient } from "../../core/clients/clients.service.js";
import { queryRequests } from "../../core/requests/requests.service.js";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace, requireCanAccessProject } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { auditAndDispatchEntityEvent } from "../helpers/auditAndDispatch.js";
import { resolveListQueryFromRequestQuery } from "../helpers/parseListQuery.js";
import { resolveListQueryFromRequest, toEntityAssignmentListViewer } from "../helpers/listQueryViewer.js";
import { buildListQueryContext, clampProjectIds, toEntityAssignmentViewer } from "../../core/access/listQueryContext.js";
import { HttpError } from "../../types/http.js";

export const clientsRoutes = Router();

clientsRoutes.post(
  "/clients/query",
  requirePermission(PERMISSIONS.CLIENTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
    const { input, viewer } = await resolveListQueryFromRequest(req.user, req.body);
    return queryClients(input, viewer);
  })
);
clientsRoutes.get(
  "/clients/:id",
  requirePermission(PERMISSIONS.CLIENTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
    const ctx = workspaceId ? await buildListQueryContext(req.user, workspaceId) : null;
    const viewer = ctx ? toEntityAssignmentViewer(ctx) : toEntityAssignmentListViewer(req.user);
    const result = await getClientById(req.params.id, viewer);
    if (ctx && !ctx.isAdmin && !ctx.isTecmaAdmin && result.client.projectId) {
      const allowed = clampProjectIds([result.client.projectId], ctx.allowedProjectIds, false);
      if (allowed.length === 0) throw new HttpError("Client not found", 404);
    }
    return result;
  })
);

clientsRoutes.get(
  "/clients/:id/requests",
  requirePermission(PERMISSIONS.REQUESTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
    const { input, viewer } = await resolveListQueryFromRequestQuery(req.user, req);
    return queryRequests(
      {
        ...input,
        filters: { clientId: req.params.id },
      },
      viewer
    );
  })
);

clientsRoutes.post(
  "/clients",
  requirePermission(PERMISSIONS.CLIENTS_CREATE),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync(async (req) => {
  const result = await createClient(req.body);
  const workspaceId = req.body.workspaceId as string;
  auditAndDispatchEntityEvent({
    action: "client.created",
    workspaceId,
    projectId: req.body.projectId,
    entityType: "client",
    entityId: result.client._id,
    actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
    payload: {
      fullName: result.client.fullName,
      firstName: result.client.firstName,
      lastName: result.client.lastName,
    },
    userId: req.user?.sub,
  });
  return result;
  })
);

clientsRoutes.patch(
  "/clients/:id",
  requirePermission(PERMISSIONS.CLIENTS_UPDATE),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync(async (req) => {
  const result = await updateClient(req.params.id, req.body);
  const workspaceId = result.workspaceId ?? "";
  if (workspaceId) {
    auditAndDispatchEntityEvent({
      action: "client.updated",
      workspaceId,
      projectId: result.client.projectId || undefined,
      entityType: "client",
      entityId: req.params.id,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: req.body,
      userId: req.user?.sub,
    });
  }
  return { client: result.client };
  })
);

clientsRoutes.post(
  "/clients/:clientId/actions",
  requirePermission(PERMISSIONS.CLIENTS_UPDATE),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
  const clientId = req.params.clientId;
  const body = z.object({ type: z.enum(["mail_received", "mail_sent", "call_completed", "meeting_scheduled"]) }).parse(req.body);
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
  const ctx = workspaceId ? await buildListQueryContext(req.user, workspaceId) : null;
  const viewer = ctx ? toEntityAssignmentViewer(ctx) : toEntityAssignmentListViewer(req.user);
  const clientRes = await getClientById(clientId, viewer).catch(() => null);
  const resolvedWorkspaceId = clientRes?.client?.workspaceId ?? "";
  const { getDb } = await import("../../config/db.js");
  const db = getDb();
  const now = new Date();
  const doc = {
    at: now,
    action: `client.${body.type}`,
    workspaceId: resolvedWorkspaceId,
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
  })
);
