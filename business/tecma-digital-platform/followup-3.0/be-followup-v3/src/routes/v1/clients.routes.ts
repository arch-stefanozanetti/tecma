import { Router } from "express";
import { z } from "zod";
import { getClientById, queryClients, createClient, updateClient } from "../../core/clients/clients.service.js";
import { queryRequests } from "../../core/requests/requests.service.js";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace, requireCanAccessProject } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { auditAndDispatchEntityEvent } from "../helpers/auditAndDispatch.js";
import { parseListQueryFromRequest } from "../helpers/parseListQuery.js";
import { toEntityAssignmentListViewer } from "../helpers/listQueryViewer.js";

export const clientsRoutes = Router();

clientsRoutes.post(
  "/clients/query",
  requirePermission(PERMISSIONS.CLIENTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync((req) => queryClients(req.body, toEntityAssignmentListViewer(req.user)))
);
clientsRoutes.get(
  "/clients/:id",
  requirePermission(PERMISSIONS.CLIENTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync((req) => getClientById(req.params.id, toEntityAssignmentListViewer(req.user)))
);

clientsRoutes.get(
  "/clients/:id/requests",
  requirePermission(PERMISSIONS.REQUESTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
    const { workspaceId, projectIds, page, perPage } = parseListQueryFromRequest(req);
    return queryRequests({
      workspaceId,
      projectIds,
      page,
      perPage,
      filters: { clientId: req.params.id },
    });
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
  const clientRes = await getClientById(clientId).catch(() => null);
  const workspaceId = clientRes?.client?.workspaceId ?? "";
  const { getDb } = await import("../../config/db.js");
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
  })
);
