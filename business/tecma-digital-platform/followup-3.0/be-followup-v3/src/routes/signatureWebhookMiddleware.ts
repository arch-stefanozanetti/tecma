/**
 * Protezione webhook stato firma: segreto condiviso (non JWT utente).
 * Il provider esterno deve inviare lo stesso valore configurato in SIGNATURE_WEBHOOK_SECRET.
 */
import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { ENV } from "../config/env.js";
import { HttpError } from "../types/http.js";
import { sendError } from "./asyncHandler.js";

export function getSignatureWebhookSecretFromRequest(req: Request): string | null {
  const auth = req.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const t = auth.slice(7).trim();
    if (t) return t;
  }
  const h = req.get("x-signature-webhook-secret");
  if (h?.trim()) return h.trim();
  return null;
}

export function requireSignatureWebhookSecret(req: Request, res: Response, next: NextFunction): void {
  const configured = (ENV.SIGNATURE_WEBHOOK_SECRET ?? "").trim();
  if (!configured) {
    sendError(res, new HttpError("Webhook firme non configurato: impostare SIGNATURE_WEBHOOK_SECRET", 503));
    return;
  }
  const provided = getSignatureWebhookSecretFromRequest(req);
  if (!provided) {
    sendError(res, new HttpError("Unauthorized", 401));
    return;
  }
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(configured, "utf8");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    sendError(res, new HttpError("Unauthorized", 401));
    return;
  }
  next();
}
