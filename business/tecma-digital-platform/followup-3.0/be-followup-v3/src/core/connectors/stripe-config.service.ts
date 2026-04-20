/**
 * Stripe: configurazione per workspace (tz_connector_configs, connectorId: stripe).
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_connector_configs";
const CONNECTOR_ID = "stripe";

const ConfigSchema = z.object({
  /** sk_live_... o sk_test_... */
  secretKey: z.string().min(1),
  /** whsec_... per verifica firma webhook */
  webhookSecret: z.string().min(1).optional(),
  /** pk_live_... opzionale (solo riferimento UI) */
  publishableKey: z.string().optional(),
});

export interface StripeConfigRow {
  _id: string;
  workspaceId: string;
  connectorId: string;
  config: {
    secretKeyMasked?: string;
    webhookSecretMasked?: string;
    publishableKey?: string;
  };
  updatedAt: string;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function maskKey(key: string): string {
  if (!key || key.length <= 6) return "****";
  return "*".repeat(Math.min(key.length - 4, 24)) + key.slice(-4);
}

export async function getStripeConfig(workspaceId: string): Promise<StripeConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId),
    connectorId: CONNECTOR_ID,
    config: {
      secretKeyMasked: config?.secretKey ? maskKey(String(config.secretKey)) : undefined,
      webhookSecretMasked: config?.webhookSecret ? maskKey(String(config.webhookSecret)) : undefined,
      publishableKey: config?.publishableKey != null ? String(config.publishableKey) : undefined,
    },
    updatedAt: toIso(doc.updatedAt),
  };
}

export async function saveStripeConfig(
  workspaceId: string,
  input: { secretKey: string; webhookSecret?: string; publishableKey?: string }
): Promise<StripeConfigRow> {
  const parsed = ConfigSchema.parse({
    secretKey: input.secretKey.trim(),
    webhookSecret: input.webhookSecret?.trim() || undefined,
    publishableKey: input.publishableKey?.trim() || undefined,
  });
  const db = getDb();
  const existing = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  const prev = (existing?.config ?? {}) as Record<string, unknown>;
  const webhookSecret =
    parsed.webhookSecret ?? (typeof prev.webhookSecret === "string" ? prev.webhookSecret : undefined);
  const publishableKey =
    parsed.publishableKey ?? (typeof prev.publishableKey === "string" ? prev.publishableKey : undefined);
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId: CONNECTOR_ID },
    {
      $set: {
        workspaceId,
        connectorId: CONNECTOR_ID,
        config: {
          secretKey: parsed.secretKey,
          ...(webhookSecret && { webhookSecret }),
          ...(publishableKey && { publishableKey }),
        },
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  const row = await getStripeConfig(workspaceId);
  if (!row) throw new HttpError("Errore salvataggio Stripe", 500);
  return row;
}

export async function deleteStripeConfig(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: CONNECTOR_ID });
  return (result.deletedCount ?? 0) > 0;
}

/** Segreti in chiaro (solo backend / webhook). */
export async function getStripeSecrets(
  workspaceId: string
): Promise<{ secretKey: string; webhookSecret?: string } | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const secretKey = String(config?.secretKey ?? "").trim();
  if (!secretKey) return null;
  return {
    secretKey,
    webhookSecret: config?.webhookSecret != null ? String(config.webhookSecret).trim() : undefined,
  };
}
