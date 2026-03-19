import type {
  SignatureAdapter,
  SignatureCreateInput,
  SignatureCreateResult,
  SignatureRequestStatus,
} from "./signature.adapter.js";
import { ENV } from "../../config/env.js";

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
    const liveBase = ENV.YOUSIGN_API_BASE_URL?.trim();
    const liveToken = ENV.YOUSIGN_API_TOKEN?.trim();
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
        throw new Error(`Yousign API error ${res.status}: ${body.slice(0, 250)}`);
      }
      const data = (await res.json()) as { id?: string; signingUrl?: string; status?: string };
      return {
        providerRequestId: data.id ?? `ys-live-${input.requestId}-${Date.now()}`,
        signingUrl: data.signingUrl,
        status: STATUS_MAP[String(data.status ?? "").toLowerCase()] ?? "sent",
      };
    }
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
