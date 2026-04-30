import { Router } from "express";
import type { Request, Response } from "express";
import { logger } from "../observability/logger.js";
import { getStripeSecrets } from "../core/connectors/stripe-config.service.js";
import { verifyStripeWebhookSignature } from "../core/connectors/stripe-webhook-verify.js";

export const stripeWebhookRouter = Router();

stripeWebhookRouter.post("/:workspaceId", async (req: Request, res: Response): Promise<void> => {
  const workspaceId = String(req.params.workspaceId ?? "").trim();
  if (!workspaceId) {
    res.status(400).json({ ok: false, error: "workspaceId required" });
    return;
  }
  const rawBody = req.body as Buffer;
  if (!Buffer.isBuffer(rawBody)) {
    res.status(400).json({ ok: false, error: "raw body required" });
    return;
  }
  const sig = req.headers["stripe-signature"];
  const sigStr = Array.isArray(sig) ? sig[0] : sig;
  const secrets = await getStripeSecrets(workspaceId);
  if (!secrets?.webhookSecret) {
    logger.warn({ workspaceId }, "[stripe] webhook: webhookSecret non configurato");
    res.status(503).json({ ok: false, error: "stripe webhook not configured" });
    return;
  }
  const { ok } = verifyStripeWebhookSignature(rawBody, sigStr, secrets.webhookSecret);
  if (!ok) {
    logger.warn({ workspaceId }, "[stripe] webhook: firma non valida");
    res.status(401).json({ ok: false, error: "invalid signature" });
    return;
  }
  let event: { type?: string; id?: string };
  try {
    event = JSON.parse(rawBody.toString("utf8")) as { type?: string; id?: string };
  } catch {
    res.status(400).json({ ok: false, error: "invalid json" });
    return;
  }
  logger.info(
    { workspaceId, eventType: event.type, eventId: event.id },
    "[stripe] webhook received"
  );
  res.status(200).json({ received: true });
});
