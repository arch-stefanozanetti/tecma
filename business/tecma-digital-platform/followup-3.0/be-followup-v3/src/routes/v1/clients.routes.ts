import { Router } from "express";
import { z } from "zod";
import { getClientById, queryClients, createClient, updateClient } from "../../core/clients/clients.service.js";
import { queryRequests } from "../../core/requests/requests.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { record as auditRecord } from "../../core/audit/audit-log.service.js";
import { dispatchEvent } from "../../core/automations/automation-events.service.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { canAccess } from "../../core/access/canAccess.js";

export const clientsRoutes = Router();

function toAccessUser(req: { user?: { sub?: string; email?: string; system_role?: string | null; isTecmaAdmin?: boolean } }): { sub: string; email: string; system_role?: string | null; isTecmaAdmin?: boolean } | null {
  const u = req.user;
  if (!u) return null;
  return { sub: u.sub ?? "", email: u.email ?? "", system_role: u.system_role ?? undefined, isTecmaAdmin: u.isTecmaAdmin };
}

clientsRoutes.post("/clients/query", requireCanAccessWorkspace("workspaceId"), handleAsync((req) => queryClients(req.body)));
clientsRoutes.get(
  "/clients/:id",
  handleAsync(async (req) => {
    const result = await getClientById(req.params.id);
    const workspaceId = result.client?.workspaceId;
    if (workspaceId) {
      const user = toAccessUser(req);
      if (!user) throw new HttpError("Unauthorized", 401);
      const ok = await canAccess(user, { type: "workspace", workspaceId });
      if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
    }
    return result;
  })
);

clientsRoutes.get(
  "/clients/:id/requests",
  requireCanAccessWorkspace("workspaceId"),
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

clientsRoutes.post("/clients", requireCanAccessWorkspace("workspaceId"), handleAsync(async (req) => {
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
  }).catch((err) => console.warn("[audit] failed", err));
  dispatchEvent(workspaceId, "client.created", {
    workspaceId,
    projectId: req.body.projectId,
    entityType: "client",
    entityId: result.client._id,
  }).catch((err) => console.warn("[event] failed", err));
  return result;
}));

clientsRoutes.patch(
  "/clients/:id",
  handleAsync(async (req) => {
    const existing = await getClientById(req.params.id);
    const workspaceId = existing.client?.workspaceId ?? "";
    if (workspaceId) {
      const user = toAccessUser(req);
      if (!user) throw new HttpError("Unauthorized", 401);
      const ok = await canAccess(user, { type: "workspace", workspaceId });
      if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
    }
    const result = await updateClient(req.params.id, req.body);
    const wsId = result.workspaceId ?? result.client?.workspaceId ?? "";
    if (wsId) {
      auditRecord({
        action: "client.updated",
        workspaceId: wsId,
        projectId: result.client.projectId || undefined,
        entityType: "client",
        entityId: req.params.id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: req.body,
      }).catch((err) => console.warn("[audit] failed", err));
    }
    return { client: result.client };
  })
);

clientsRoutes.post("/clients/:clientId/actions", handleAsync(async (req) => {
  const clientId = req.params.clientId;
  const body = z.object({ type: z.enum(["mail_received", "mail_sent", "call_completed", "meeting_scheduled"]) }).parse(req.body);
  const clientRes = await getClientById(clientId).catch(() => null);
  if (!clientRes?.client) throw new HttpError("Client not found", 404);
  const workspaceId = clientRes.client.workspaceId ?? "";
  if (workspaceId) {
    const user = toAccessUser(req);
    if (!user) throw new HttpError("Unauthorized", 401);
    const ok = await canAccess(user, { type: "workspace", workspaceId });
    if (!ok) throw new HttpError("Accesso al workspace non consentito", 403);
  }
  const { getDb } = await import("../../config/db.js");
  const db = getDb();
  const now = new Date();
  const doc = {
    at: now,
    action: `client.${body.type}`,
    workspaceId,
    projectId: clientRes.client.projectId,
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
