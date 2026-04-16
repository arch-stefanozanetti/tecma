/**
 * Stati AML normalizzati nel dominio (indipendenti dal vendor).
 */
export type AmlCheckStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "manual_review"
  | "not_started";

export type AmlProviderId = "sumsub" | string;

/** Capability UI / canali di verifica esposte dal connettore. */
export interface AmlProviderCapabilities {
  supportsHostedLink: boolean;
  supportsSdkWeb: boolean;
}

export interface NormalizedAmlWebhookEvent {
  providerId: AmlProviderId;
  /** Id check interno (es. ObjectId hex) passato come external user id al provider. */
  externalCheckId: string;
  /** Id lato provider (es. applicant Sumsub). */
  providerSubjectId: string;
  status: AmlCheckStatus;
  /** Dettaglio opzionale per audit (senza PII grezze). */
  reviewAnswer?: string;
  rawType?: string;
}
