import { getDb } from "../../../config/db.js";
import { logger } from "../../../observability/logger.js";
import { normalizeTwilioWhatsAppParty } from "../../communications/whatsapp.service.js";
import type { ProviderAdapter } from "../provider-adapter.js";
import type { DeliveryRequest, DeliveryResult, MessagingChannel, MessagingProvider, ProviderContext } from "../messaging.types.js";

function getSmsParty(raw: string): string {
  const trimmed = raw.trim().replace(/\s/g, "");
  if (!trimmed) return trimmed;
  return trimmed.startsWith("+") ? trimmed : `+${trimmed.replace(/\D/g, "")}`;
}

async function getTwilioWorkspaceConfig(workspaceId: string): Promise<{ accountSid: string; authToken: string; fromSms?: string; fromWhatsApp?: string } | null> {
  const db = getDb();
  const [waDoc, twilioDoc] = await Promise.all([
    db.collection("tz_connector_configs").findOne({ workspaceId, connectorId: "whatsapp" }),
    db.collection("tz_connector_configs").findOne({ workspaceId, connectorId: "twilio" }),
  ]);

  const waConfig = (waDoc?.config as Record<string, unknown> | undefined) ?? {};
  const twilioConfig = (twilioDoc?.config as Record<string, unknown> | undefined) ?? {};

  const accountSid = String(twilioConfig.accountSid ?? waConfig.accountSid ?? "").trim();
  const authToken = String(twilioConfig.authToken ?? waConfig.authToken ?? "").trim();
  const fromWhatsApp = String(waConfig.fromNumber ?? twilioConfig.fromWhatsApp ?? "").trim();
  const fromSms = String(twilioConfig.fromSms ?? twilioConfig.fromNumber ?? "").trim();

  if (!accountSid || !authToken) return null;
  return { accountSid, authToken, fromSms: fromSms || undefined, fromWhatsApp: fromWhatsApp || undefined };
}

export class TwilioProvider implements ProviderAdapter {
  readonly provider: MessagingProvider = "twilio";

  supports(channel: MessagingChannel): boolean {
    return channel === "sms" || channel === "whatsapp";
  }

  async send(request: DeliveryRequest, context?: ProviderContext): Promise<DeliveryResult> {
    const cfg = await getTwilioWorkspaceConfig(request.workspaceId);
    if (!cfg) {
      throw Object.assign(new Error("Twilio configuration missing for workspace"), {
        status: 503,
        code: "TWILIO_CONFIG_MISSING",
        provider: this.provider,
      });
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${cfg.accountSid}/Messages.json`;
    const isWhatsApp = request.channel === "whatsapp";
    const from = isWhatsApp ? cfg.fromWhatsApp : cfg.fromSms;
    if (!from) {
      throw Object.assign(new Error(`Twilio ${request.channel} from address is missing`), {
        status: 503,
        code: "TWILIO_FROM_MISSING",
        provider: this.provider,
      });
    }

    const toAddress = isWhatsApp ? normalizeTwilioWhatsAppParty(request.to) : getSmsParty(request.to);
    const fromAddress = isWhatsApp ? normalizeTwilioWhatsAppParty(from) : getSmsParty(from);
    const body = new URLSearchParams({
      To: toAddress,
      From: fromAddress,
      Body: request.body,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64"),
      },
      body: body.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
      logger.error(
        {
          requestId: context?.requestId,
          tenantId: context?.tenantId,
          provider: this.provider,
          channel: request.channel,
          status: res.status,
          response: text,
        },
        "[messaging] twilio error"
      );
      throw Object.assign(new Error(`Twilio send failed: ${res.status}`), {
        status: res.status,
        provider: this.provider,
        responseBody: text,
      });
    }

    let sid: string | undefined;
    try {
      const parsed = JSON.parse(text) as { sid?: string };
      sid = parsed.sid;
    } catch {
      sid = undefined;
    }

    return {
      ok: true,
      provider: this.provider,
      channel: request.channel,
      externalId: sid,
      status: "queued",
    };
  }
}

