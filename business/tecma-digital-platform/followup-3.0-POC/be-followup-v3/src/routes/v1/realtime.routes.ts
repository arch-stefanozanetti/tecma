import { Router } from "express";
import type { Request, Response } from "express";
import { HttpError } from "../../types/http.js";
import { hasAnyPermission, PERMISSIONS } from "../../core/rbac/permissions.js";
import { canAccess } from "../../core/access/canAccess.js";
import { subscribeRealtimeEvents } from "../../core/realtime/realtime-bus.service.js";
import { sendError } from "../asyncHandler.js";
import { verifyAccessToken } from "../../core/auth/token.service.js";

export const realtimeRoutes = Router();

const writeSseEvent = (res: Response, event: string, payload: unknown): void => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

realtimeRoutes.get("/realtime/stream", async (req: Request, res: Response) => {
  try {
    const authHeader = req.get("authorization");
    const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice("bearer ".length).trim() : "";
    if (!token) throw new HttpError("Unauthorized", 401);
    try {
      req.user = verifyAccessToken(token);
    } catch {
      throw new HttpError("Invalid access token", 401);
    }

    const granted = req.user?.permissions ?? [];
    const isPrivileged =
      req.user?.isAdmin === true ||
      (Array.isArray(granted) && granted.includes(PERMISSIONS.ALL));
    if (
      !isPrivileged &&
      !hasAnyPermission(granted, [
        PERMISSIONS.CLIENTS_READ,
        PERMISSIONS.APARTMENTS_READ,
        PERMISSIONS.REQUESTS_READ,
      ])
    ) {
      throw new HttpError("Permesso negato", 403);
    }

    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    if (!workspaceId) throw new HttpError("workspaceId query required", 400);

    const user = req.user && (req.user.sub || req.user.email) ? { sub: req.user.sub ?? "", email: req.user.email ?? "", system_role: req.user.system_role, isTecmaAdmin: req.user.isTecmaAdmin } : null;
    if (!user) throw new HttpError("Unauthorized", 401);
    const canAccessWorkspace = await canAccess(user, { type: "workspace", workspaceId });
    if (!canAccessWorkspace) throw new HttpError("Accesso al workspace non consentito", 403);

    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
    if (projectId) {
      const canAccessProject = await canAccess(user, { type: "project", projectId, workspaceId });
      if (!canAccessProject) throw new HttpError("Accesso al progetto non consentito", 403);
    }
    const eventTypesRaw = typeof req.query.eventTypes === "string" ? req.query.eventTypes : "";
    const eventTypes = eventTypesRaw
      .split(",")
      .map((it) => it.trim())
      .filter(Boolean);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    writeSseEvent(res, "hello", {
      ok: true,
      workspaceId,
      projectId: projectId || null,
      eventTypes,
      ts: new Date().toISOString(),
    });

    const heartbeat = setInterval(() => {
      writeSseEvent(res, "heartbeat", { ts: new Date().toISOString() });
    }, 15000);

    const unsubscribe = subscribeRealtimeEvents((event) => {
      if (event.workspaceId !== workspaceId) return;
      if (projectId && event.projectId && event.projectId !== projectId) return;
      if (eventTypes.length > 0 && !eventTypes.includes(event.eventType)) return;
      writeSseEvent(res, "domain-event", event);
    });

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
      res.end();
    });
  } catch (error) {
    sendError(res, error);
  }
});
