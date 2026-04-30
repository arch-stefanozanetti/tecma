import type {
  SignatureAdapter,
  SignatureCreateInput,
  SignatureCreateResult,
  SignatureRequestStatus,
} from "./signature.adapter.js";
import { ENV } from "../../config/env.js";

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
    const liveBase = ENV.DOCUSIGN_API_BASE_URL?.trim();
    const liveToken = ENV.DOCUSIGN_API_TOKEN?.trim();
    if (liveBase && liveToken) {
      const res = await fetch(`${liveBase.replace(/\/$/, "")}/signature-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${liveToken}`,
        },
        body: JSON.stringify({
          externalId: input.requestId,
          signer: input.signer,
          document: input.document,
          callbackUrl: input.callbackUrl,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`DocuSign API error ${res.status}: ${body.slice(0, 250)}`);
      }
      const data = (await res.json()) as { id?: string; signingUrl?: string; status?: string };
      return {
        providerRequestId: data.id ?? `ds-live-${input.requestId}-${Date.now()}`,
        signingUrl: data.signingUrl,
        status: STATUS_MAP[String(data.status ?? "").toLowerCase()] ?? "sent",
      };
    }
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
