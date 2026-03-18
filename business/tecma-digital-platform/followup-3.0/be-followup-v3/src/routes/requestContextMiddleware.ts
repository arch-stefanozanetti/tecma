import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { runWithRequestContext, updateRequestContext } from "../observability/request-context.js";

const headerValue = (raw: string | string[] | undefined): string | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = headerValue(req.headers["x-request-id"]) ?? randomUUID();
  const correlationId = headerValue(req.headers["x-correlation-id"]) ?? requestId;
  const endpoint = req.originalUrl?.split("?")[0] ?? req.path;

  res.setHeader("x-request-id", requestId);
  res.setHeader("x-correlation-id", correlationId);

  runWithRequestContext(
    {
      requestId,
      correlationId,
      method: req.method,
      endpoint,
      userId: null,
      workspaceId: null,
    },
    () => {
      res.on("finish", () => {
        updateRequestContext({
          userId: req.user?.sub ?? null,
          workspaceId:
            (typeof req.body?.workspaceId === "string" && req.body.workspaceId) ||
            (typeof req.query?.workspaceId === "string" && req.query.workspaceId) ||
            null,
        });
      });
      next();
    }
  );
}

