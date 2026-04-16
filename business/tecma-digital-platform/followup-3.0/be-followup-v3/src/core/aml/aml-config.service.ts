/**
 * Configurazione Sumsub per workspace (collection tz_connector_configs, connectorId sumsub).
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_connector_configs";
const CONNECTOR_ID = "sumsub";

const ConfigSchema = z.object({
  appToken: z.string().min(1),
  secretKey: z.string().min(1),
  levelName: z.string().min(1),
  webhookSecret: z.string().min(1),
});

export interface SumsubConfigRow {
  _id: string;
  workspaceId: string;
  connectorId: string;
  config: {
    levelName: string;
    appTokenMasked?: string;
    secretKeyMasked?: string;
    webhookSecretMasked?: string;
  };
  updatedAt: string;
}

function maskKey(key: string): string {
  if (!key || key.length <= 4) return "****";
  return "*".repeat(key.length - 4) + key.slice(-4);
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

export async function getSumsubConfig(workspaceId: string): Promise<SumsubConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId),
    connectorId: String(doc.connectorId),
    config: {
      levelName: String(config?.levelName ?? ""),
      appTokenMasked: config?.appToken ? maskKey(String(config.appToken)) : undefined,
      secretKeyMasked: config?.secretKey ? maskKey(String(config.secretKey)) : undefined,
      webhookSecretMasked: config?.webhookSecret ? maskKey(String(config.webhookSecret)) : undefined,
    },
    updatedAt: toIso(doc.updatedAt),
  };
}

export interface SumsubConfigInput {
  appToken: string;
  secretKey: string;
  levelName: string;
  webhookSecret: string;
}

export async function saveSumsubConfig(workspaceId: string, input: SumsubConfigInput): Promise<SumsubConfigRow> {
  const parsed = ConfigSchema.parse({
    appToken: input.appToken.trim(),
    secretKey: input.secretKey.trim(),
    levelName: input.levelName.trim(),
    webhookSecret: input.webhookSecret.trim(),
  });
  const db = getDb();
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId: CONNECTOR_ID },
    {
      $set: {
        workspaceId,
        connectorId: CONNECTOR_ID,
        config: {
          appToken: parsed.appToken,
          secretKey: parsed.secretKey,
          levelName: parsed.levelName,
          webhookSecret: parsed.webhookSecret,
        },
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  const row = await getSumsubConfig(workspaceId);
  if (!row) throw new Error("saveSumsubConfig: readback failed");
  return row;
}

export async function deleteSumsubConfig(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const r = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: CONNECTOR_ID });
  return r.deletedCount > 0;
}

/** Config in chiaro per adapter (solo interno). */
export async function getSumsubConfigSecrets(workspaceId: string): Promise<SumsubConfigInput | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const appToken = typeof config.appToken === "string" ? config.appToken : "";
  const secretKey = typeof config.secretKey === "string" ? config.secretKey : "";
  const levelName = typeof config.levelName === "string" ? config.levelName : "";
  const webhookSecret = typeof config.webhookSecret === "string" ? config.webhookSecret : "";
  if (!appToken || !secretKey || !levelName || !webhookSecret) return null;
  return { appToken, secretKey, levelName, webhookSecret };
}
