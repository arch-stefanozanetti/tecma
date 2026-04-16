import { Router } from "express";
import { publicApiRateLimiter } from "./rateLimitMiddleware.js";
import { getSumsubConfigSecrets } from "../core/aml/aml-config.service.js";
import { parseSumsubWebhookPayload } from "../core/aml/sumsub/sumsub-adapter.js";
import { verifySumsubWebhookSignature } from "../core/aml/sumsub/sumsub-signing.js";
import { applyNormalizedAmlWebhookEvent } from "../core/aml/aml-checks.service.js";
import { logger } from "../observability/logger.js";

/**
 * POST /v1/webhooks/sumsub/:workspaceId
 * Body raw JSON. Configurare in Sumsub lo stesso URL (con workspaceId) e il webhook secret salvato nel connettore.
 */
export const sumsubWebhookRouter = Router({ mergeParams: true });

sumsubWebhookRouter.post("/", publicApiRateLimiter, async (req, res) => {
  const workspaceId = typeof req.params.workspaceId === "string" ? req.params.workspaceId : "";
  if (!workspaceId) {
    res.status(400).json({ ok: false });
    return;
  }
  const raw = req.body as Buffer | undefined;
  if (!raw || !Buffer.isBuffer(raw)) {
    res.status(400).json({ ok: false, error: "expected raw body" });
    return;
  }
  const secrets = await getSumsubConfigSecrets(workspaceId);
  if (!secrets) {
    res.status(503).json({ ok: false, error: "sumsub not configured" });
    return;
  }
  const headers = req.headers as Record<string, string | string[] | undefined>;
  if (!verifySumsubWebhookSignature(raw, secrets.webhookSecret, headers)) {
    logger.warn({ workspaceId }, "[aml] sumsub webhook signature mismatch");
    res.status(401).json({ ok: false });
    return;
  }

  let json: unknown;
  try {
    json = JSON.parse(raw.toString("utf8"));
  } catch {
    res.status(400).json({ ok: false });
    return;
  }

  const event = parseSumsubWebhookPayload(json);
  if (!event) {
    res.status(200).json({ ok: true, ignored: true });
    return;
  }

  try {
    const result = await applyNormalizedAmlWebhookEvent(event);
    res.status(200).json({ ok: result.ok });
  } catch (e) {
    logger.error({ err: e, workspaceId }, "[aml] sumsub webhook apply failed");
    res.status(500).json({ ok: false });
  }
});
