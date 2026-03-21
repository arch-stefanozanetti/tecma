/**
 * Allowlist opzionale IP (o CIDR IPv4) per POST webhook firme.
 * Se SIGNATURE_WEBHOOK_ALLOWED_CIDRS è vuota, nessun vincolo oltre al segreto.
 */
import type { Request, Response, NextFunction } from "express";
import { ENV } from "../config/env.js";
import { HttpError } from "../types/http.js";
import { sendError } from "./asyncHandler.js";
import { getClientIp } from "./requestMeta.js";

function normalizeClientIp(req: Request): string {
  const raw = (req.ip && String(req.ip).trim()) || getClientIp(req) || "";
  return raw.replace(/^::ffff:/i, "").trim();
}

function ipv4ToUint32(ip: string): number | null {
  const parts = ip.split(".").map((x) => Number(x));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) return null;
  return (((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0) as number;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [net, bitsStr] = cidr.split("/").map((s) => s.trim());
  if (!net || !bitsStr) return false;
  const bits = Number(bitsStr);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipN = ipv4ToUint32(ip);
  const netN = ipv4ToUint32(net);
  if (ipN === null || netN === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipN & mask) === (netN & mask);
}

export function parseSignatureWebhookAllowlist(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function ipMatchesEntry(clientIp: string, entry: string): boolean {
  if (entry.includes("/")) {
    if (!clientIp.includes(":")) return ipv4InCidr(clientIp, entry);
    return false;
  }
  return clientIp === entry;
}

export function getSignatureWebhookAllowlistEntries(): string[] {
  return parseSignatureWebhookAllowlist((ENV.SIGNATURE_WEBHOOK_ALLOWED_CIDRS ?? "").trim());
}

/** Per test: verifica IP normalizzato contro voci allowlist. */
export function isClientIpAllowedForSignatureWebhook(clientIpNorm: string, entries: string[]): boolean {
  if (entries.length === 0) return true;
  if (!clientIpNorm) return false;
  return entries.some((e) => ipMatchesEntry(clientIpNorm, e));
}

export function requireSignatureWebhookClientIp(req: Request, res: Response, next: NextFunction): void {
  const entries = getSignatureWebhookAllowlistEntries();
  const clientIp = normalizeClientIp(req);
  if (isClientIpAllowedForSignatureWebhook(clientIp, entries)) {
    next();
    return;
  }
  if (!clientIp) {
    sendError(res, new HttpError("Indirizzo client non determinabile", 403));
    return;
  }
  sendError(res, new HttpError("Forbidden", 403));
}
