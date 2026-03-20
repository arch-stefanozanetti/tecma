/**
 * Configurazione WhatsApp Cloud API (Meta) per workspace.
 * Collection tz_connector_configs (connectorId: 'meta_whatsapp').
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_connector_configs";
export const META_WHATSAPP_CONNECTOR_ID = "meta_whatsapp";

const ConfigSchema = z.object({
  phoneNumberId: z.string().min(1),
  accessToken: z.string().min(1),
});

export interface MetaWhatsAppConfigRow {
  _id: string;
  workspaceId: string;
  connectorId: string;
  config: {
    phoneNumberId: string;
    accessTokenMasked?: string;
  };
  updatedAt: string;
}

export interface MetaWhatsAppConfigInput {
  phoneNumberId: string;
  accessToken: string;
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return new Date(0).toISOString();
}

function maskToken(token: string): string {
  if (!token || token.length <= 4) return "****";
  return "*".repeat(token.length - 4) + token.slice(-4);
}

export async function getMetaWhatsAppConfig(workspaceId: string): Promise<MetaWhatsAppConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: META_WHATSAPP_CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId),
    connectorId: String(doc.connectorId),
    config: {
      phoneNumberId: String(config?.phoneNumberId ?? ""),
      accessTokenMasked: config?.accessToken ? maskToken(String(config.accessToken)) : undefined,
    },
    updatedAt: toIso(doc.updatedAt),
  };
}

/** Credenziali complete per invio (solo uso server-side). */
export async function getMetaWhatsAppCredentialsForSend(
  workspaceId: string
): Promise<{ phoneNumberId: string; accessToken: string } | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: META_WHATSAPP_CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const phoneNumberId = String(config?.phoneNumberId ?? "").trim();
  const accessToken = String(config?.accessToken ?? "").trim();
  if (!phoneNumberId || !accessToken) return null;
  return { phoneNumberId, accessToken };
}

export async function saveMetaWhatsAppConfig(
  workspaceId: string,
  input: MetaWhatsAppConfigInput
): Promise<MetaWhatsAppConfigRow> {
  const parsed = ConfigSchema.parse({
    phoneNumberId: input.phoneNumberId.trim(),
    accessToken: input.accessToken.trim(),
  });
  const db = getDb();
  const now = new Date();
  const doc = {
    workspaceId,
    connectorId: META_WHATSAPP_CONNECTOR_ID,
    config: {
      phoneNumberId: parsed.phoneNumberId,
      accessToken: parsed.accessToken,
    },
    updatedAt: now,
  };
  await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId: META_WHATSAPP_CONNECTOR_ID },
    { $set: doc },
    { upsert: true }
  );
  const row = await getMetaWhatsAppConfig(workspaceId);
  if (!row) throw new Error("Failed to read saved Meta WhatsApp config");
  return row;
}

export async function deleteMetaWhatsAppConfig(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: META_WHATSAPP_CONNECTOR_ID });
  return (result.deletedCount ?? 0) > 0;
}

export async function hasMetaWhatsAppConfig(workspaceId: string): Promise<boolean> {
  const c = await getMetaWhatsAppCredentialsForSend(workspaceId);
  return c !== null;
}
