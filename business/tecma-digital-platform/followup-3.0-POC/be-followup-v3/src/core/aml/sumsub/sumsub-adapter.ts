import type {
  AmlProvider,
  CreateApplicantInput,
  CreateApplicantResult,
  SdkAccessTokenInput,
  SdkAccessTokenResult,
} from "../aml-provider.types.js";
import type { AmlProviderCapabilities, NormalizedAmlWebhookEvent } from "../aml-domain.js";
import { signSumsubRequest } from "./sumsub-signing.js";

const SUMSUB_API_BASE = "https://api.sumsub.com";

export interface SumsubAdapterConfig {
  appToken: string;
  secretKey: string;
  /** Livello di verifica Sumsub (dashboard). */
  levelName: string;
}

export class SumsubAdapter implements AmlProvider {
  readonly id = "sumsub" as const;

  readonly capabilities: AmlProviderCapabilities = {
    supportsHostedLink: true,
    supportsSdkWeb: true,
  };

  constructor(private readonly cfg: SumsubAdapterConfig) {}

  async createApplicant(input: CreateApplicantInput): Promise<CreateApplicantResult> {
    const pathWithQuery = `/resources/applicants?levelName=${encodeURIComponent(this.cfg.levelName)}`;
    const bodyObj: Record<string, unknown> = {
      externalUserId: input.externalUserId,
      fixedInfo: {
        firstName: input.fixedInfo.firstName,
        lastName: input.fixedInfo.lastName,
      },
    };
    if (input.email) bodyObj.email = input.email;
    if (input.phone) bodyObj.phone = input.phone;
    const body = JSON.stringify(bodyObj);
    const { ts, signature } = signSumsubRequest({
      secretKey: this.cfg.secretKey,
      method: "POST",
      pathWithQuery,
      body,
    });
    const res = await fetch(`${SUMSUB_API_BASE}${pathWithQuery}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-App-Token": this.cfg.appToken,
        "X-App-Access-Ts": ts,
        "X-App-Access-Sig": signature,
      },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        typeof json.description === "string"
          ? json.description
          : typeof json.errorName === "string"
            ? json.errorName
            : `Sumsub createApplicant failed: ${res.status}`
      );
    }
    const id = json.id != null ? String(json.id) : "";
    if (!id) throw new Error("Sumsub createApplicant: missing id");
    return { providerApplicantId: id };
  }

  async getSdkAccessToken(input: SdkAccessTokenInput): Promise<SdkAccessTokenResult> {
    const pathWithQuery = `/resources/accessTokens?userId=${encodeURIComponent(input.providerApplicantId)}&levelName=${encodeURIComponent(input.levelName)}`;
    const body = "";
    const { ts, signature } = signSumsubRequest({
      secretKey: this.cfg.secretKey,
      method: "POST",
      pathWithQuery,
      body,
    });
    const res = await fetch(`${SUMSUB_API_BASE}${pathWithQuery}`, {
      method: "POST",
      headers: {
        "X-App-Token": this.cfg.appToken,
        "X-App-Access-Ts": ts,
        "X-App-Access-Sig": signature,
      },
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new Error(
        typeof json.description === "string" ? json.description : `Sumsub accessTokens failed: ${res.status}`
      );
    }
    const token = json.token != null ? String(json.token) : "";
    const userId = json.userId != null ? String(json.userId) : input.providerApplicantId;
    if (!token) throw new Error("Sumsub accessTokens: missing token");
    return { token, userId };
  }

  parseWebhookPayload(body: unknown): NormalizedAmlWebhookEvent | null {
    return parseSumsubWebhookPayload(body);
  }
}

/** Parser webhook senza credenziali (solo normalizzazione). */
export function parseSumsubWebhookPayload(body: unknown): NormalizedAmlWebhookEvent | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const type = typeof o.type === "string" ? o.type : "";
  const externalUserId = typeof o.externalUserId === "string" ? o.externalUserId : "";
  const applicantId = typeof o.applicantId === "string" ? o.applicantId : "";
  if (!externalUserId || !applicantId) return null;

  let status: NormalizedAmlWebhookEvent["status"] = "pending";
  let reviewAnswer: string | undefined;

  if (type === "applicantReviewed") {
    const review = o.reviewResult as Record<string, unknown> | undefined;
    const answer = review && typeof review.reviewAnswer === "string" ? review.reviewAnswer : "";
    reviewAnswer = answer;
    if (answer === "GREEN") status = "approved";
    else if (answer === "RED") status = "rejected";
    else if (answer === "YELLOW") status = "manual_review";
    else status = "manual_review";
  } else if (type === "applicantPending" || type === "applicantCreated") {
    status = "pending";
  } else {
    return null;
  }

  return {
    providerId: "sumsub",
    externalCheckId: externalUserId,
    providerSubjectId: applicantId,
    status,
    reviewAnswer,
    rawType: type,
  };
}
