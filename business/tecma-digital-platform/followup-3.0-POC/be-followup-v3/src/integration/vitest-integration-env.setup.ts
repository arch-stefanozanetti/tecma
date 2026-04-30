/**
 * Garantisce variabili minime prima che i test importino config/env (webhook firme, ecc.).
 */
if (!process.env.SIGNATURE_WEBHOOK_SECRET?.trim()) {
  process.env.SIGNATURE_WEBHOOK_SECRET = "integration-test-signature-webhook-32chars!!";
}
