/**
 * Mitigazione SSRF basilare per URL webhook in uscita: schema, host noti pericolosi, IP privati, risoluzione DNS.
 */
import dns from "node:dns/promises";
import net from "node:net";
import { isProductionLike } from "../../config/env.js";
import { HttpError } from "../../types/http.js";

const BLOCKED_HOSTNAMES = new Set(
  ["metadata.google.internal", "metadata.goog", "169.254.169.254"].map((h) => h.toLowerCase())
);

function isPrivateOrReservedIPv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

function isUnsafeIpLiteral(host: string): boolean {
  if (net.isIPv4(host)) {
    const parts = host.split(".").map((x) => Number(x));
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
    return isPrivateOrReservedIPv4(parts);
  }
  if (net.isIPv6(host)) {
    const h = host.toLowerCase();
    if (h === "::1") return true;
    if (h.startsWith("fe80:")) return true;
    if (h.startsWith("fc") || h.startsWith("fd")) return true;
    if (h.startsWith("::ffff:")) {
      const v4 = h.slice(7);
      if (net.isIPv4(v4)) {
        const parts = v4.split(".").map((x) => Number(x));
        return isPrivateOrReservedIPv4(parts);
      }
    }
  }
  return false;
}

function isUnsafeResolvedIp(ip: string): boolean {
  return isUnsafeIpLiteral(ip);
}

/**
 * Verifica che l'URL sia usabile per POST server-to-server senza puntare a reti interne note.
 * In produzione/staging consente solo https.
 */
export async function assertSafeWebhookDeliveryUrl(rawUrl: string): Promise<void> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new HttpError("URL webhook non valido", 400);
  }
  if (u.username || u.password) {
    throw new HttpError("URL webhook non deve contenere credenziali inline", 400);
  }
  const proto = u.protocol.toLowerCase();
  if (isProductionLike()) {
    if (proto !== "https:") {
      throw new HttpError("In produzione lo webhook in uscita deve usare HTTPS", 400);
    }
  } else if (proto !== "https:" && proto !== "http:") {
    throw new HttpError("Schema URL webhook non supportato", 400);
  }
  const host = u.hostname.toLowerCase();
  if (!host) {
    throw new HttpError("Host URL webhook mancante", 400);
  }
  if (BLOCKED_HOSTNAMES.has(host)) {
    throw new HttpError("Host URL webhook non consentito", 400);
  }
  if (host === "localhost" || host.endsWith(".localhost")) {
    if (isProductionLike()) {
      throw new HttpError("localhost non consentito per webhook in uscita in produzione", 400);
    }
  }
  if (isUnsafeIpLiteral(host)) {
    throw new HttpError("Indirizzo IP privato o riservato non consentito per webhook in uscita", 400);
  }
  if (net.isIP(host)) {
    return;
  }
  try {
    const resolved = await dns.lookup(host, { verbatim: true });
    if (resolved.address && isUnsafeResolvedIp(resolved.address)) {
      throw new HttpError("L'host del webhook risolve a un indirizzo non consentito", 400);
    }
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError("Impossibile verificare l'host del webhook", 400);
  }
}
