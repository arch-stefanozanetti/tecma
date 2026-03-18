/**
 * Invio WhatsApp (Twilio / MessageBird). Config per workspace in tz_connector_configs (connectorId: 'whatsapp').
 * Fase 2: implementazione piena; qui stub che logga se non configurato.
 */
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";

const CONNECTOR_ID = "whatsapp";

async function getWhatsAppConfig(workspaceId: string): Promise<{ fromNumber: string; accountSid: string; authToken: string } | null> {
  const db = getDb();
  const doc = await db.collection("tz_connector_configs").findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const fromNumber = config?.fromNumber ?? config?.from ?? "";
  const accountSid = config?.accountSid ?? "";
  const authToken = config?.authToken ?? "";
  if (!fromNumber || !accountSid || !authToken) return null;
  return { fromNumber: String(fromNumber), accountSid: String(accountSid), authToken: String(authToken) };
}

/**
 * Invia un messaggio WhatsApp al numero indicato.
 * Se il workspace non ha config WhatsApp, logga e non invia (Fase 1 compat).
 */
export async function sendWhatsAppMessage(workspaceId: string, to: string, bodyText: string): Promise<void> {
  const config = await getWhatsAppConfig(workspaceId);
  if (!config) {
    logger.warn({ workspaceId, to }, "[whatsapp] workspace has no config; skipping send");
    return;
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    const body = new URLSearchParams({
      To: to.startsWith("+") ? to : `+${to}`,
      From: config.fromNumber,
      Body: bodyText,
    });
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64"),
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      logger.error({ status: res.status, response: text }, "[whatsapp] Twilio error");
      throw new Error(`WhatsApp send failed: ${res.status}`);
    }
  } catch (err) {
    logger.error({ err }, "[whatsapp] send failed");
    throw err;
  }
}
