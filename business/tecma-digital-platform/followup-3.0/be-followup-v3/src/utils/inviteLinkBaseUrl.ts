import type { Request } from "express";
import { ENV } from "../config/env.js";

function normalizeBase(u: string): string {
  return u.replace(/\/$/, "");
}

function allowedHosts(): Set<string> {
  const set = new Set<string>();
  try {
    set.add(new URL(ENV.APP_PUBLIC_URL).hostname);
  } catch {
    /* ignore */
  }
  const extra = process.env.INVITE_LINK_ALLOWED_HOSTS?.split(/[\s,]+/).filter(Boolean) ?? [];
  for (const h of extra) set.add(h);
  return set;
}

function isAllowedHostname(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  if (hostname.endsWith(".onrender.com")) return true;
  return allowedHosts().has(hostname);
}

function baseFromUrlString(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!isAllowedHostname(u.hostname)) return null;
    return normalizeBase(u.origin);
  } catch {
    return null;
  }
}

/**
 * Base URL per il link "Imposta password" nell'invito.
 * Preferisce il frontend da cui parte la richiesta (Origin / body), altrimenti APP_PUBLIC_URL.
 */
export function resolveInviteAppBaseUrl(req: Request, bodyAppPublicUrl?: string | null): string {
  const fromBody = bodyAppPublicUrl ? baseFromUrlString(bodyAppPublicUrl) : null;
  if (fromBody) return fromBody;

  const origin = req.get("origin");
  if (origin) {
    const b = baseFromUrlString(origin);
    if (b) return b;
  }

  const referer = req.get("referer");
  if (referer) {
    try {
      const b = baseFromUrlString(new URL(referer).origin);
      if (b) return b;
    } catch {
      /* ignore */
    }
  }

  return normalizeBase(ENV.APP_PUBLIC_URL);
}
