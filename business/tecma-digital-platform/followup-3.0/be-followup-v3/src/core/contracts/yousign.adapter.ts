import type {
  SignatureAdapter,
  SignatureCreateInput,
  SignatureCreateResult,
  SignatureRequestStatus,
} from "./signature.adapter.js";

const STATUS_MAP: Record<string, SignatureRequestStatus> = {
  draft: "created",
  ongoing: "sent",
  done: "completed",
  declined: "declined",
  error: "failed",
};

export const yousignAdapter: SignatureAdapter = {
  provider: "yousign",
  async createSignatureRequest(input: SignatureCreateInput): Promise<SignatureCreateResult> {
    const providerRequestId = `ys-${input.requestId}-${Date.now()}`;
    return {
      providerRequestId,
      signingUrl: input.callbackUrl ? `${input.callbackUrl}?provider=yousign&requestId=${encodeURIComponent(providerRequestId)}` : undefined,
      status: "sent",
    };
  },
  mapWebhookStatus(rawStatus: string): SignatureRequestStatus {
    const normalized = rawStatus.trim().toLowerCase();
    return STATUS_MAP[normalized] ?? "failed";
  },
};

