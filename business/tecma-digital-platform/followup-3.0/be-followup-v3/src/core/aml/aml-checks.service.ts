import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import type { AmlCheckStatus, NormalizedAmlWebhookEvent } from "./aml-domain.js";
import { getAmlProviderForWorkspace } from "./aml-provider-factory.js";
import { getClientById } from "../clients/clients.service.js";
import { getSumsubConfigSecrets } from "./aml-config.service.js";

const COLLECTION = "tz_aml_checks";

export interface AmlCheckRow {
  _id: string;
  workspaceId: string;
  clientId: string;
  projectId: string;
  providerId: string;
  status: AmlCheckStatus;
  providerApplicantId?: string;
  externalUserId: string;
  updatedAt: string;
  createdAt: string;
  reviewAnswer?: string;
  lastWebhookType?: string;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function mapDoc(doc: Record<string, unknown>): AmlCheckRow {
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId ?? ""),
    clientId: String(doc.clientId ?? ""),
    projectId: String(doc.projectId ?? ""),
    providerId: String(doc.providerId ?? ""),
    status: (doc.status as AmlCheckStatus) ?? "pending",
    providerApplicantId: typeof doc.providerApplicantId === "string" ? doc.providerApplicantId : undefined,
    externalUserId: String(doc.externalUserId ?? ""),
    updatedAt: toIso(doc.updatedAt),
    createdAt: toIso(doc.createdAt),
    reviewAnswer: typeof doc.reviewAnswer === "string" ? doc.reviewAnswer : undefined,
    lastWebhookType: typeof doc.lastWebhookType === "string" ? doc.lastWebhookType : undefined,
  };
}

export async function listAmlChecksForClient(workspaceId: string, clientId: string): Promise<AmlCheckRow[]> {
  const db = getDb();
  const cursor = db
    .collection(COLLECTION)
    .find({ workspaceId, clientId })
    .sort({ createdAt: -1 })
    .limit(50);
  const docs = await cursor.toArray();
  return docs.map((d) => mapDoc(d as Record<string, unknown>));
}

export async function startAmlCheckForClient(
  workspaceId: string,
  clientId: string,
  providerId: string,
  userId?: string
): Promise<{ check: AmlCheckRow; sdkAccessToken?: string }> {
  if (providerId !== "sumsub") {
    throw new HttpError("Provider AML non supportato", 400);
  }
  const provider = await getAmlProviderForWorkspace(workspaceId, providerId);
  if (!provider) {
    throw new HttpError("Configura Sumsub nelle integrazioni (workspace).", 424);
  }
  const secrets = await getSumsubConfigSecrets(workspaceId);
  if (!secrets) {
    throw new HttpError("Configura Sumsub nelle integrazioni (workspace).", 424);
  }

  const { client } = await getClientById(clientId);
  if (client.workspaceId !== workspaceId) {
    throw new HttpError("Client not found", 404);
  }

  const db = getDb();
  const checkId = new ObjectId();
  const externalUserId = checkId.toHexString();

  const created = await provider.createApplicant({
    externalUserId,
    email: client.email,
    phone: client.phone,
    fixedInfo: {
      firstName: client.firstName,
      lastName: client.lastName,
    },
  });

  const now = new Date();
  const doc = {
    _id: checkId,
    workspaceId,
    clientId,
    projectId: client.projectId,
    providerId,
    status: "pending" as const,
    providerApplicantId: created.providerApplicantId,
    externalUserId,
    createdAt: now,
    updatedAt: now,
    createdByUserId: userId,
  };
  await db.collection(COLLECTION).insertOne(doc as never);

  await db.collection("tz_clients").updateOne(
    { _id: new ObjectId(clientId) },
    {
      $set: {
        amlStatus: "pending",
        amlCheckId: checkId.toHexString(),
        updatedAt: now,
      },
    }
  );

  const sdk = await provider.getSdkAccessToken({
    providerApplicantId: created.providerApplicantId,
    levelName: secrets.levelName,
  });

  const inserted = await db.collection(COLLECTION).findOne({ _id: checkId });
  const row = mapDoc((inserted ?? doc) as unknown as Record<string, unknown>);
  return { check: row, sdkAccessToken: sdk.token };
}

const WebhookUpdateSchema = z.object({
  externalCheckId: z.string().min(1),
  providerSubjectId: z.string().min(1),
  status: z.enum(["pending", "approved", "rejected", "manual_review", "not_started"]),
  reviewAnswer: z.string().optional(),
  rawType: z.string().optional(),
});

export async function applyAmlWebhookUpdate(
  parsed: z.infer<typeof WebhookUpdateSchema>
): Promise<{ ok: boolean; clientId?: string }> {
  const db = getDb();
  const checkId = ObjectId.isValid(parsed.externalCheckId) ? new ObjectId(parsed.externalCheckId) : null;
  if (!checkId) return { ok: false };

  const doc = await db.collection(COLLECTION).findOne({ _id: checkId });
  if (!doc) return { ok: false };

  const clientId = String(doc.clientId ?? "");

  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { _id: checkId },
    {
      $set: {
        status: parsed.status,
        providerApplicantId: parsed.providerSubjectId,
        reviewAnswer: parsed.reviewAnswer,
        lastWebhookType: parsed.rawType,
        updatedAt: now,
      },
    }
  );

  if (clientId && ObjectId.isValid(clientId)) {
    await db.collection("tz_clients").updateOne(
      { _id: new ObjectId(clientId) },
      {
        $set: {
          amlStatus: parsed.status,
          amlCheckId: checkId.toHexString(),
          updatedAt: now,
        },
      }
    );
  }

  return { ok: true, clientId };
}

export async function applyNormalizedAmlWebhookEvent(event: NormalizedAmlWebhookEvent): Promise<{ ok: boolean; clientId?: string }> {
  return applyAmlWebhookUpdate({
    externalCheckId: event.externalCheckId,
    providerSubjectId: event.providerSubjectId,
    status: event.status,
    reviewAnswer: event.reviewAnswer,
    rawType: event.rawType,
  });
}
