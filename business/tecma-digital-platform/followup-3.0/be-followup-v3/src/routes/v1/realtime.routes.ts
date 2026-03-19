import { Router } from "express";
import type { Request, Response } from "express";
import { HttpError } from "../../types/http.js";
import { subscribeRealtimeEvents } from "../../core/realtime/realtime-bus.service.js";
import { sendError } from "../asyncHandler.js";
import { verifyAccessToken } from "../../core/auth/token.service.js";

export const realtimeRoutes = Router();

const writeSseEvent = (res: Response, event: string, payload: unknown): void => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
};

realtimeRoutes.get("/realtime/stream", (req: Request, res: Response) => {
  try {
    const tokenFromQuery = typeof req.query.accessToken === "string" ? req.query.accessToken : "";
    const authHeader = req.get("authorization");
    const bearer = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice("bearer ".length).trim() : "";
    const token = tokenFromQuery || bearer;
    if (!token) throw new HttpError("Unauthorized", 401);
    try {
      req.user = verifyAccessToken(token);
    } catch {
      throw new HttpError("Invalid access token", 401);
    }

    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    if (!workspaceId) throw new HttpError("workspaceId query required", 400);

    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
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
