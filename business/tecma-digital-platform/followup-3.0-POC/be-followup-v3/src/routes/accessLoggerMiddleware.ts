import type { Request, Response, NextFunction } from "express";
import { context, trace } from "@opentelemetry/api";
import { writeAccessLog } from "../core/audit/accessLog.service.js";
import { getClientIp } from "./requestMeta.js";
import { logger } from "../observability/logger.js";
import { observeHttpRequest } from "../observability/metrics.js";

/** Path che non devono scrivere su Mongo (health check Render / probe): evita timeout e rumore su DB lento. */
export function shouldSkipAccessLogWrite(method: string, pathOnly: string): boolean {
  const m = method.toUpperCase();
  if (m !== "GET" && m !== "HEAD") return false;
  const p = pathOnly.replace(/\/$/, "") || "/";
  return p === "/v1/health";
}

/**
 * Registra ogni richiesta su /v1 con tempo di risposta (dopo che req.user è eventualmente impostato da requireAuth).
 */
export function accessLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const path = req.originalUrl?.split("?")[0] ?? req.path;
  const method = req.method;
  const span = trace.getSpan(context.active());

  res.on("finish", () => {
    const ms = Date.now() - start;
    const workspaceId =
      (typeof req.body?.workspaceId === "string" && req.body.workspaceId) ||
      (typeof req.query?.workspaceId === "string" && req.query.workspaceId) ||
      null;
    if (!shouldSkipAccessLogWrite(method, path)) {
      void writeAccessLog({
        userId: req.user?.sub ?? null,
        endpoint: path,
        method,
        projectId: req.user?.projectId ?? null,
        statusCode: res.statusCode,
        responseTimeMs: ms,
        ipAddress: getClientIp(req)
      });
    }
    observeHttpRequest({
      method,
      endpoint: path,
      statusCode: res.statusCode,
      latencyMs: ms,
    });

    if (span) {
      span.setAttribute("app.endpoint", path);
      span.setAttribute("app.latency_ms", ms);
      span.setAttribute("app.workspace_id", workspaceId ?? "");
      span.setAttribute("http.status_code", res.statusCode);
    }

    logger.info({
      userId: req.user?.sub ?? null,
      workspaceId,
      endpoint: path,
      method,
      statusCode: res.statusCode,
      latencyMs: ms,
      ipAddress: getClientIp(req)
    }, "HTTP request completed");
  });

  next();
}
