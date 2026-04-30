/**
 * Verifica firma webhook Stripe (header Stripe-Signature).
 * @see https://stripe.com/docs/webhooks/signatures
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyStripeWebhookSignature(
  rawBody: Buffer,
  stripeSignatureHeader: string | undefined,
  webhookSecret: string
): { ok: boolean; t?: string } {
  if (!stripeSignatureHeader || !webhookSecret) return { ok: false };
  const parts = stripeSignatureHeader.split(",").map((p) => p.trim());
  let t = "";
  const v1s: string[] = [];
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === "t") t = v ?? "";
    if (k === "v1" && v) v1s.push(v);
  }
  if (!t || v1s.length === 0) return { ok: false };
  const signedPayload = Buffer.from(`${t}.${rawBody.toString("utf8")}`, "utf8");
  const expected = createHmac("sha256", webhookSecret).update(signedPayload).digest("hex");
  const ok = v1s.some((sig) => {
    try {
      return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
    } catch {
      return false;
    }
  });
  return { ok, t };
}
