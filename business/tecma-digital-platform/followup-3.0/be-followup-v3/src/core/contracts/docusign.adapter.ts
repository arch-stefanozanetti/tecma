import type {
  SignatureAdapter,
  SignatureCreateInput,
  SignatureCreateResult,
  SignatureRequestStatus,
} from "./signature.adapter.js";

const STATUS_MAP: Record<string, SignatureRequestStatus> = {
  created: "created",
  sent: "sent",
  delivered: "sent",
  completed: "completed",
  declined: "declined",
  voided: "failed",
};

export const docusignAdapter: SignatureAdapter = {
  provider: "docusign",
  async createSignatureRequest(input: SignatureCreateInput): Promise<SignatureCreateResult> {
    const providerRequestId = `ds-${input.requestId}-${Date.now()}`;
    return {
      providerRequestId,
      signingUrl: input.callbackUrl ? `${input.callbackUrl}?provider=docusign&requestId=${encodeURIComponent(providerRequestId)}` : undefined,
      status: "sent",
    };
  },
  mapWebhookStatus(rawStatus: string): SignatureRequestStatus {
    const normalized = rawStatus.trim().toLowerCase();
    return STATUS_MAP[normalized] ?? "failed";
  },
};

