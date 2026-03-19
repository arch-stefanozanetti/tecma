import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { writeAuditLog } from "../audit/audit.service.js";
import type { SignatureProvider, SignatureRequestStatus } from "./signature.adapter.js";
import { docusignAdapter } from "./docusign.adapter.js";
import { yousignAdapter } from "./yousign.adapter.js";

const COLLECTION = "tz_signature_requests";

const CreateSchema = z.object({
  workspaceId: z.string().min(1),
  requestId: z.string().min(1),
  provider: z.enum(["docusign", "yousign"]).default("yousign"),
  signer: z.object({
    fullName: z.string().min(1),
    email: z.string().email(),
  }),
  document: z.object({
    title: z.string().min(1),
    fileUrl: z.string().url(),
  }),
  callbackUrl: z.string().url().optional(),
  actorUserId: z.string().optional(),
});

const WebhookSchema = z.object({
  provider: z.enum(["docusign", "yousign"]),
  providerRequestId: z.string().min(1),
  status: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
});

const nowIso = (): string => new Date().toISOString();

const getAdapter = (provider: SignatureProvider) => (provider === "docusign" ? docusignAdapter : yousignAdapter);

export const createSignatureRequest = async (rawInput: unknown): Promise<Record<string, unknown>> => {
  const input = CreateSchema.parse(rawInput);
  const db = getDb();
  const adapter = getAdapter(input.provider);
  const providerResult = await adapter.createSignatureRequest({
    requestId: input.requestId,
    workspaceId: input.workspaceId,
    signer: input.signer,
    document: input.document,
    callbackUrl: input.callbackUrl,
  });
  const createdAt = nowIso();
  const insert = await db.collection(COLLECTION).insertOne({
    workspaceId: input.workspaceId,
    requestId: input.requestId,
    provider: input.provider,
    providerRequestId: providerResult.providerRequestId,
    signer: input.signer,
    document: input.document,
    status: providerResult.status,
    signingUrl: providerResult.signingUrl ?? null,
    createdAt,
    updatedAt: createdAt,
  });
  await writeAuditLog({
    userId: input.actorUserId ?? "system",
    action: "contract.signature.requested",
    entityType: "signature_request",
    entityId: insert.insertedId.toHexString(),
    projectId: null,
    changes: { after: { provider: input.provider, requestId: input.requestId, status: providerResult.status } },
  });
  return {
    _id: insert.insertedId.toHexString(),
    provider: input.provider,
    providerRequestId: providerResult.providerRequestId,
    status: providerResult.status,
    signingUrl: providerResult.signingUrl,
  };
};

export const applySignatureWebhook = async (rawInput: unknown): Promise<{ ok: boolean; status: SignatureRequestStatus }> => {
  const input = WebhookSchema.parse(rawInput);
  const db = getDb();
  const adapter = getAdapter(input.provider);
  const status = adapter.mapWebhookStatus(input.status);
  const now = nowIso();
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { provider: input.provider, providerRequestId: input.providerRequestId },
    {
      $set: {
        status,
        webhookPayload: input.payload ?? null,
        updatedAt: now,
        completedAt: status === "completed" ? now : null,
      },
    },
    { returnDocument: "after" },
  );
  if (!result) throw new HttpError("Signature request not found", 404);
  const id = result._id instanceof ObjectId ? result._id.toHexString() : String(result._id ?? "");
  await writeAuditLog({
    userId: "signature_webhook",
    action: "contract.signature.status_updated",
    entityType: "signature_request",
    entityId: id,
    changes: { after: { status, provider: input.provider } },
    projectId: null,
  });
  return { ok: true, status };
};

export const getSignatureStatusForRequest = async (workspaceId: string, requestId: string): Promise<{ data: Record<string, unknown>[] }> => {
  const db = getDb();
  const docs = await db.collection(COLLECTION).find({ workspaceId, requestId }).sort({ createdAt: -1 }).toArray();
  return {
    data: docs.map((doc) => ({
      _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? ""),
      provider: String(doc.provider ?? ""),
      providerRequestId: String(doc.providerRequestId ?? ""),
      status: String(doc.status ?? "unknown"),
      signingUrl: typeof doc.signingUrl === "string" ? doc.signingUrl : undefined,
      createdAt: typeof doc.createdAt === "string" ? doc.createdAt : nowIso(),
      updatedAt: typeof doc.updatedAt === "string" ? doc.updatedAt : nowIso(),
    })),
  };
};

