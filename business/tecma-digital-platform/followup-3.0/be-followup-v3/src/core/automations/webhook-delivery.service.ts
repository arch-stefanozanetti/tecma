/**
 * Invio webhook con retry e firma HMAC (Wave 4).
 */
import crypto from "crypto";
import type { WebhookConfigRow } from "./webhook-configs.service.js";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export interface WebhookPayload {
  event: string;
  at: string;
  workspaceId: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}

export async function deliverWebhook(
  config: WebhookConfigRow,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  const body: WebhookPayload = {
    event: eventType,
    at: new Date().toISOString(),
    workspaceId: config.workspaceId,
    projectId: payload.projectId as string | undefined,
    entityType: (payload.entityType as string) ?? "",
    entityId: (payload.entityId as string) ?? "",
    payload: payload as Record<string, unknown>,
  };
  const bodyStr = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Webhook-Event": eventType,
  };
  if (config.secret) {
    const sig = crypto.createHmac("sha256", config.secret).update(bodyStr).digest("hex");
    headers["X-Webhook-Signature"] = `sha256=${sig}`;
  }

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(config.url, {
        method: "POST",
        headers,
        body: bodyStr,
      });
      if (res.ok) return;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  throw lastError ?? new Error("Webhook delivery failed");
}
