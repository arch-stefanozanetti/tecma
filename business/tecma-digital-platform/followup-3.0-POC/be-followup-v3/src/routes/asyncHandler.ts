import type { Request, Response, RequestHandler } from "express";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { ZodError } from "zod";
import { isProductionLike } from "../config/env.js";
import { logger } from "../observability/logger.js";
import { getRequestContext } from "../observability/request-context.js";

const statusCodeFromError = (error: unknown): number =>
  typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as { statusCode: number }).statusCode)
    : 400;

const messageFromError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error)
    return String((error as { message: unknown }).message);
  return String(error);
};

const codeFromError = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code: unknown }).code);
  }
  if (typeof error === "object" && error !== null && "name" in error) {
    return String((error as { name: unknown }).name);
  }
  return "UNKNOWN_ERROR";
};

/**
 * Sends error response with status from error.statusCode (e.g. HttpError) or 400.
 * In produzione/staging: messaggi generici per 5xx e Zod, dettagli solo in log.
 */
export const sendError = (res: Response, error: unknown): void => {
  const strict = isProductionLike();
  const context = getRequestContext();
  let statusCode = statusCodeFromError(error);
  let message = messageFromError(error);
  const errorCode = codeFromError(error);
  const span = trace.getActiveSpan();

  if (error instanceof ZodError) {
    statusCode = 400;
    logger.warn({ err: error, statusCode, "error.code": errorCode }, "Request validation failed");
    message = strict
      ? "Richiesta non valida"
      : error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") || "Validazione fallita";
  } else if (strict && statusCode >= 500) {
    logger.error({ err: error, statusCode, "error.code": errorCode }, "[api] server error");
    message =
      statusCode === 503 ? "Servizio temporaneamente non disponibile" : "Errore interno del server";
  } else if (statusCode >= 500) {
    logger.error({ err: error, statusCode, "error.code": errorCode }, "[api] server error");
  }

  if (span) {
    span.setStatus({
      code: statusCode >= 500 ? SpanStatusCode.ERROR : SpanStatusCode.UNSET,
      message: messageFromError(error),
    });
    span.setAttribute("error.code", errorCode);
    span.setAttribute("http.status_code", statusCode);
  }

  const payload: { error: string; requestId?: string; code?: string; hint?: string } = {
    error: message,
    ...(context?.requestId ? { requestId: context.requestId } : {}),
  };
  if (typeof error === "object" && error !== null && "code" in error && typeof (error as { code: unknown }).code === "string") {
    payload.code = (error as { code: string }).code;
  }
  if (typeof error === "object" && error !== null && "hint" in error && typeof (error as { hint: unknown }).hint === "string") {
    payload.hint = (error as { hint: string }).hint;
  }
  res.status(statusCode).json(payload);
};

export const handleAsync = (
  handler: (req: Request) => Promise<unknown>
): RequestHandler => {
  return (req: Request, res: Response) =>
    handler(req)
      .then((payload) => {
        if (payload !== undefined) res.json(payload);
      })
      .catch((err) => sendError(res, err));
};
