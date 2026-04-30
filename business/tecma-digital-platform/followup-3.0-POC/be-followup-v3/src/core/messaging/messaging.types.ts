export type MessagingChannel = "sms" | "whatsapp";

export type MessagingProvider = "aws_sms" | "meta_whatsapp" | "twilio";

export type MessagingErrorCode =
  | "RateLimited"
  | "InvalidDestination"
  | "ProviderUnavailable"
  | "AuthenticationFailed"
  | "NotEntitled"
  | "UnknownFailure";

/** Payload invio WhatsApp via Meta Cloud API (template approvato). */
export interface WhatsAppTemplatePayload {
  name: string;
  languageCode: string;
  bodyParameterValues: string[];
}

export interface DeliveryRequest {
  workspaceId: string;
  channel: MessagingChannel;
  to: string;
  body: string;
  projectId?: string;
  /** Se presente, MetaWhatsAppProvider invia come template; Twilio ignora e usa `body`. */
  whatsappTemplate?: WhatsAppTemplatePayload;
}

export interface ProviderContext {
  requestId?: string;
  tenantId?: string;
}

export interface DeliveryResult {
  ok: boolean;
  provider: MessagingProvider;
  channel: MessagingChannel;
  externalId?: string;
  status: "sent" | "queued" | "failed";
  errorCode?: MessagingErrorCode;
  errorMessage?: string;
}

export interface ProviderError extends Error {
  status?: number;
  code?: string | number;
  provider?: MessagingProvider;
  responseBody?: string;
}

