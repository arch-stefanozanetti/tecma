export type SignatureProvider = "docusign" | "yousign";
export type SignatureRequestStatus = "created" | "sent" | "completed" | "declined" | "failed";

export interface SignatureSignerInput {
  fullName: string;
  email: string;
}

export interface SignatureDocumentInput {
  title: string;
  fileUrl: string;
}

export interface SignatureCreateInput {
  requestId: string;
  workspaceId: string;
  signer: SignatureSignerInput;
  document: SignatureDocumentInput;
  callbackUrl?: string;
}

export interface SignatureCreateResult {
  providerRequestId: string;
  signingUrl?: string;
  status: SignatureRequestStatus;
}

export interface SignatureAdapter {
  provider: SignatureProvider;
  createSignatureRequest(input: SignatureCreateInput): Promise<SignatureCreateResult>;
  mapWebhookStatus(rawStatus: string): SignatureRequestStatus;
}

