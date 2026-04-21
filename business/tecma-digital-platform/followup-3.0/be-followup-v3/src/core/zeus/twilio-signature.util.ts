/**
 * Validazione richieste Twilio (X-Twilio-Signature) senza dipendenza twilio npm.
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
import crypto from "node:crypto";

export function validateTwilioRequest(authToken: string, twilioSignature: string | undefined, url: string, params: Record<string, string>): boolean {
  if (!twilioSignature || !authToken) return false;
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  const hmac = crypto.createHmac("sha1", authToken);
  hmac.update(Buffer.from(data, "utf-8"));
  const expected = hmac.digest("base64");
  try {
    const a = Buffer.from(expected, "utf-8");
    const b = Buffer.from(twilioSignature, "utf-8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Normalizza body urlencoded in Record<string, string>. */
export function flattenTwilioBody(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (typeof v === "string") out[k] = v;
    else if (v != null && typeof v !== "object") out[k] = String(v);
  }
  return out;
}
