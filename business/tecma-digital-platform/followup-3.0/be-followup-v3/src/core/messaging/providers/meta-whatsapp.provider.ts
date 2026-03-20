import { getMetaWhatsAppCredentialsForSend } from "../../connectors/meta-whatsapp-config.service.js";
import { logger } from "../../../observability/logger.js";
import type { ProviderAdapter } from "../provider-adapter.js";
import type { DeliveryRequest, DeliveryResult, MessagingChannel, MessagingProvider, ProviderContext } from "../messaging.types.js";

function graphApiVersion(): string {
  return (process.env.META_GRAPH_API_VERSION ?? "v21.0").replace(/^v?/, "v");
}

/** E.164 senza + per API Meta WhatsApp Cloud (solo cifre, prefisso paese). */
export function normalizeToMetaWhatsAppTo(raw: string): string {
  const digits = raw.replace(/^whatsapp:/i, "").replace(/\D/g, "");
  return digits;
}

export class MetaWhatsAppProvider implements ProviderAdapter {
  readonly provider: MessagingProvider = "meta_whatsapp";

  supports(channel: MessagingChannel): boolean {
    return channel === "whatsapp";
  }

  async send(request: DeliveryRequest, context?: ProviderContext): Promise<DeliveryResult> {
    const tpl = request.whatsappTemplate;
    if (!tpl?.name?.trim() || !tpl.languageCode?.trim()) {
      throw Object.assign(
        new Error("Meta WhatsApp richiede whatsappTemplate con name e languageCode (template approvato)"),
        { status: 400, code: "META_TEMPLATE_REQUIRED", provider: this.provider }
      );
    }

    const cfg = await getMetaWhatsAppCredentialsForSend(request.workspaceId);
    if (!cfg) {
      throw Object.assign(new Error("Meta WhatsApp configuration missing for workspace"), {
        status: 503,
        code: "META_WHATSAPP_CONFIG_MISSING",
        provider: this.provider,
      });
    }

    const to = normalizeToMetaWhatsAppTo(request.to);
    if (to.length < 8) {
      throw Object.assign(new Error("Invalid WhatsApp destination for Meta"), {
        status: 400,
        code: "META_INVALID_TO",
        provider: this.provider,
      });
    }

    const version = graphApiVersion();
    const url = `https://graph.facebook.com/${version}/${cfg.phoneNumberId}/messages`;

    const bodyParameters = (tpl.bodyParameterValues ?? []).map((text) => ({
      type: "text" as const,
      text: String(text ?? ""),
    }));

    const components =
      bodyParameters.length > 0
        ? [
            {
              type: "body" as const,
              parameters: bodyParameters,
            },
          ]
        : [];

    const payload = {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: tpl.name.trim(),
        language: { code: tpl.languageCode.trim() },
        ...(components.length > 0 ? { components } : {}),
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      logger.error(
        {
          requestId: context?.requestId,
          tenantId: context?.tenantId,
          provider: this.provider,
          status: res.status,
          response: text.slice(0, 2000),
        },
        "[messaging] meta whatsapp error"
      );
      throw Object.assign(new Error(`Meta WhatsApp send failed: ${res.status}`), {
        status: res.status,
        provider: this.provider,
        responseBody: text,
      });
    }

    let externalId: string | undefined;
    try {
      const parsed = JSON.parse(text) as { messages?: Array<{ id?: string }> };
      externalId = parsed.messages?.[0]?.id;
    } catch {
      externalId = undefined;
    }

    return {
      ok: true,
      provider: this.provider,
      channel: request.channel,
      externalId,
      status: "sent",
    };
  }
}
