import crypto from "node:crypto";

/**
 * Firma richieste REST Sumsub (HMAC-SHA256).
 * @see https://docs.sumsub.com/reference/authentication
 */
export function signSumsubRequest(params: {
  secretKey: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path con query, es. /resources/applicants?levelName=basic-kyc-level */
  pathWithQuery: string;
  /** Corpo raw (stringa JSON per POST o stringa vuota). */
  body: string;
}): { ts: string; signature: string } {
  const ts = Math.floor(Date.now() / 1000).toString();
  const payload = `${ts}${params.method.toUpperCase()}${params.pathWithQuery}${params.body}`;
  const signature = crypto.createHmac("sha256", params.secretKey).update(payload).digest("hex");
  return { ts, signature };
}

/**
 * Verifica webhook Sumsub: digest HMAC-SHA256 del body raw con il secret del workspace.
 * Header tipico: `X-Payload-Digest` (valore hex) — in assenza si provano varianti note.
 */
export function verifySumsubWebhookSignature(
  rawBody: Buffer,
  webhookSecret: string,
  headers: Record<string, string | string[] | undefined>
): boolean {
  const expected = crypto.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const candidates = [
    headers["x-payload-digest"],
    headers["x-signature"],
    headers["x-sumsub-signature"],
  ]
    .flatMap((h) => (typeof h === "string" ? [h] : Array.isArray(h) ? h : []))
    .map((s) => s.replace(/^sha256=/i, "").trim());

  for (const c of candidates) {
    if (c && timingSafeEqualHex(expected, c)) return true;
  }
  return false;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
