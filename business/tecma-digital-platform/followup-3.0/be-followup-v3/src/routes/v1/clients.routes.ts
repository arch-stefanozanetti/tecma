import { Router } from "express";
import { z } from "zod";
import { getClientById, queryClients, createClient, updateClient } from "../../core/clients/clients.service.js";
import { queryRequests } from "../../core/requests/requests.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { record as auditRecord } from "../../core/audit/audit-log.service.js";
import { dispatchEvent } from "../../core/automations/automation-events.service.js";

export const clientsRoutes = Router();

clientsRoutes.post("/clients/query", handleAsync((req) => queryClients(req.body)));
clientsRoutes.get("/clients/:id", handleAsync((req) => getClientById(req.params.id)));

clientsRoutes.get(
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
      filters: { clientId },
    });
  })
);

clientsRoutes.post("/clients", handleAsync(async (req) => {
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

clientsRoutes.patch("/clients/:id", handleAsync(async (req) => {
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

clientsRoutes.post("/clients/:clientId/actions", handleAsync(async (req) => {
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
}));
