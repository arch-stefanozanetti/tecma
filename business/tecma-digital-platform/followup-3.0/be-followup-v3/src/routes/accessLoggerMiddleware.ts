import type { Request, Response, NextFunction } from "express";
import { writeAccessLog } from "../core/audit/accessLog.service.js";
import { getClientIp } from "./requestMeta.js";

/**
 * Registra ogni richiesta su /v1 con tempo di risposta (dopo che req.user è eventualmente impostato da requireAuth).
 */
export function accessLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const path = req.originalUrl?.split("?")[0] ?? req.path;
  const method = req.method;

  res.on("finish", () => {
    const ms = Date.now() - start;
    void writeAccessLog({
      userId: req.user?.sub ?? null,
      endpoint: path,
      method,
      projectId: req.user?.projectId ?? null,
      statusCode: res.statusCode,
      responseTimeMs: ms,
      ipAddress: getClientIp(req)
    });
  });

  next();
}
