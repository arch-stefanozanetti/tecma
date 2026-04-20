/**
 * PayPal REST: credenziali per workspace (tz_connector_configs, connectorId: paypal).
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_connector_configs";
const CONNECTOR_ID = "paypal";

const ConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  /** ID webhook creato nel PayPal Developer Dashboard */
  webhookId: z.string().optional(),
  mode: z.enum(["sandbox", "live"]).default("live"),
});

export interface PayPalConfigRow {
  _id: string;
  workspaceId: string;
  connectorId: string;
  config: {
    clientId: string;
    clientSecretMasked?: string;
    webhookId?: string;
    mode: "sandbox" | "live";
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

function mask(s: string): string {
  if (!s || s.length <= 4) return "****";
  return "*".repeat(Math.min(s.length - 4, 20)) + s.slice(-4);
}

export async function getPayPalConfig(workspaceId: string): Promise<PayPalConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId),
    connectorId: CONNECTOR_ID,
    config: {
      clientId: String(config?.clientId ?? ""),
      clientSecretMasked: config?.clientSecret ? mask(String(config.clientSecret)) : undefined,
      webhookId: config?.webhookId != null ? String(config.webhookId) : undefined,
      mode: config?.mode === "sandbox" ? "sandbox" : "live",
    },
    updatedAt: toIso(doc.updatedAt),
  };
}

export async function savePayPalConfig(
  workspaceId: string,
  input: { clientId: string; clientSecret: string; webhookId?: string; mode?: "sandbox" | "live" }
): Promise<PayPalConfigRow> {
  const db = getDb();
  const existing = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  const prev = (existing?.config ?? {}) as Record<string, unknown>;
  const clientSecretMerged =
    input.clientSecret.trim() ||
    (typeof prev.clientSecret === "string" ? String(prev.clientSecret) : "");
  if (!clientSecretMerged) {
    throw new HttpError("clientSecret obbligatorio", 400);
  }
  const parsed = ConfigSchema.parse({
    clientId: input.clientId.trim(),
    clientSecret: clientSecretMerged,
    webhookId: input.webhookId?.trim() || undefined,
    mode: input.mode ?? (prev.mode === "sandbox" ? "sandbox" : "live"),
  });
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId: CONNECTOR_ID },
    {
      $set: {
        workspaceId,
        connectorId: CONNECTOR_ID,
        config: {
          clientId: parsed.clientId,
          clientSecret: parsed.clientSecret,
          ...(parsed.webhookId && { webhookId: parsed.webhookId }),
          mode: parsed.mode,
        },
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  const row = await getPayPalConfig(workspaceId);
  if (!row) throw new HttpError("Errore salvataggio PayPal", 500);
  return row;
}

export async function deletePayPalConfig(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: CONNECTOR_ID });
  return (result.deletedCount ?? 0) > 0;
}

export async function getPayPalSecrets(
  workspaceId: string
): Promise<{ clientId: string; clientSecret: string; webhookId?: string; mode: "sandbox" | "live" } | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const clientId = String(config?.clientId ?? "").trim();
  const clientSecret = String(config?.clientSecret ?? "").trim();
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    webhookId: config?.webhookId != null ? String(config.webhookId).trim() : undefined,
    mode: config?.mode === "sandbox" ? "sandbox" : "live",
  };
}

export function paypalApiBase(mode: "sandbox" | "live"): string {
  return mode === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}
