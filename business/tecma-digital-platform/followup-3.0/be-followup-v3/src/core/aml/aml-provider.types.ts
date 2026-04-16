import type { AmlProviderCapabilities, AmlProviderId, NormalizedAmlWebhookEvent } from "./aml-domain.js";

export interface CreateApplicantInput {
  externalUserId: string;
  email?: string;
  phone?: string;
  fixedInfo: {
    firstName: string;
    lastName: string;
  };
}

export interface CreateApplicantResult {
  providerApplicantId: string;
}

export interface SdkAccessTokenInput {
  providerApplicantId: string;
  levelName: string;
}

export interface SdkAccessTokenResult {
  token: string;
  userId: string;
}

/**
 * Contratto astratto per connettori AML/KYC: il dominio dipende solo da questo.
 */
export interface AmlProvider {
  readonly id: AmlProviderId;
  readonly capabilities: AmlProviderCapabilities;

  createApplicant(input: CreateApplicantInput): Promise<CreateApplicantResult>;

  getSdkAccessToken(input: SdkAccessTokenInput): Promise<SdkAccessTokenResult>;

  /** Interpreta il body JSON del webhook e restituisce evento normalizzato o null se ignorabile. */
  parseWebhookPayload(body: unknown): NormalizedAmlWebhookEvent | null;
}
