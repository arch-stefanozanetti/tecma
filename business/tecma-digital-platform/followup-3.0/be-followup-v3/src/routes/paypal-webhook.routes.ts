import { Router } from "express";
import type { Request, Response } from "express";
import { logger } from "../observability/logger.js";
import { getPayPalSecrets } from "../core/connectors/paypal-config.service.js";

/**
 * Webhook PayPal: accetta evento JSON; verifica opzionale webhookId vs config.
 * Verifica firma completa: usare PayPal verify API in evoluzione.
 */
export const paypalWebhookRouter = Router();

paypalWebhookRouter.post("/:workspaceId", async (req: Request, res: Response): Promise<void> => {
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
  const secrets = await getPayPalSecrets(workspaceId);
  if (!secrets) {
    res.status(503).json({ ok: false, error: "paypal not configured" });
    return;
  }
  let parsed: { id?: string; event_type?: string; resource?: { id?: string }; webhook_id?: string };
  try {
    parsed = JSON.parse(rawBody.toString("utf8")) as typeof parsed;
  } catch {
    res.status(400).json({ ok: false, error: "invalid json" });
    return;
  }
  if (secrets.webhookId && parsed.webhook_id && parsed.webhook_id !== secrets.webhookId) {
    logger.warn({ workspaceId, got: parsed.webhook_id }, "[paypal] webhook id mismatch");
    res.status(401).json({ ok: false, error: "webhook id mismatch" });
    return;
  }
  logger.info(
    { workspaceId, eventType: parsed.event_type, eventId: parsed.id },
    "[paypal] webhook received"
  );
  res.status(200).json({ ok: true });
});
