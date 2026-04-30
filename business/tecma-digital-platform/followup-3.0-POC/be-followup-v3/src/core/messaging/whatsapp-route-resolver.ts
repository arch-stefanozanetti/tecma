import { hasMetaWhatsAppConfig } from "../connectors/meta-whatsapp-config.service.js";
import type { MessagingProvider } from "./messaging.types.js";

export interface WhatsAppRouteDecision {
  primary: MessagingProvider;
}

/**
 * Se esiste config valida Meta WhatsApp per il workspace, usa Meta (solo template approvati).
 * Altrimenti Twilio (testo libero / formato attuale).
 */
export async function resolveWhatsAppRoute(workspaceId: string): Promise<WhatsAppRouteDecision> {
  const metaOk = await hasMetaWhatsAppConfig(workspaceId);
  if (metaOk) {
    return { primary: "meta_whatsapp" };
  }
  return { primary: "twilio" };
}
