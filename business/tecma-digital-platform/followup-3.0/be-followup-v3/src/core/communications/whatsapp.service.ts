/**
 * Invio WhatsApp via Twilio REST (Messages API).
 * Config per workspace in tz_connector_configs (connectorId: 'whatsapp').
 * Twilio richiede indirizzi in forma `whatsapp:+E164` per il canale WhatsApp.
 */
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";
import { isWorkspaceEntitledToFeature } from "../workspaces/workspace-entitlements.service.js";

const CONNECTOR_ID = "whatsapp";

/**
 * Normalizza un numero o indirizzo per Twilio WhatsApp (`whatsapp:+39...`).
 * Accetta già `whatsapp:+...`, E.164 `+39...`, o solo cifre con prefisso paese.
 */
export function normalizeTwilioWhatsAppParty(raw: string): string {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return trimmed;
  const waPrefix = trimmed.match(/^whatsapp:(.+)$/i);
  if (waPrefix) {
    const rest = waPrefix[1].trim();
    if (!rest) return "whatsapp:";
    const withPlus = rest.startsWith("+") ? rest : `+${rest}`;
    return `whatsapp:${withPlus}`;
  }
  const digitsOnly = trimmed.replace(/^\+/, "").replace(/\D/g, "");
  if (digitsOnly.length >= 8) {
    return `whatsapp:+${digitsOnly}`;
  }
  const withPlus = trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
  return `whatsapp:${withPlus}`;
}

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
  const entitled = await isWorkspaceEntitledToFeature(workspaceId, "twilio");
  if (!entitled) {
    throw new Error("Twilio non abilitato per questo workspace (entitlement).");
  }
  const config = await getWhatsAppConfig(workspaceId);
  if (!config) {
    logger.warn({ workspaceId, to }, "[whatsapp] workspace has no config; skipping send");
    return;
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
    const fromAddr = normalizeTwilioWhatsAppParty(config.fromNumber);
    const toAddr = normalizeTwilioWhatsAppParty(to);
    const body = new URLSearchParams({
      To: toAddr,
      From: fromAddr,
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
