/**
 * Configurazione WhatsApp (Twilio) per workspace. Collection tz_connector_configs (connectorId: 'whatsapp').
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { isWorkspaceEntitledToFeature } from "../workspaces/workspace-entitlements.service.js";

const COLLECTION = "tz_connector_configs";
const CONNECTOR_ID = "whatsapp";

const ConfigSchema = z.object({
  accountSid: z.string().min(1),
  authToken: z.string().min(1),
  fromNumber: z.string().min(1),
});

export interface WhatsAppConfigRow {
  _id: string;
  workspaceId: string;
  connectorId: string;
  config: {
    accountSid: string;
    authTokenMasked?: string;
    fromNumber: string;
  };
  updatedAt: string;
}

export interface WhatsAppConfigInput {
  accountSid: string;
  authToken: string;
  fromNumber: string;
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

export async function getWhatsAppConfig(workspaceId: string): Promise<WhatsAppConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId),
    connectorId: String(doc.connectorId),
    config: {
      accountSid: String(config?.accountSid ?? ""),
      authTokenMasked: config?.authToken ? maskToken(String(config.authToken)) : undefined,
      fromNumber: String(config?.fromNumber ?? ""),
    },
    updatedAt: toIso(doc.updatedAt),
  };
}

export async function saveWhatsAppConfig(workspaceId: string, input: WhatsAppConfigInput): Promise<WhatsAppConfigRow> {
  if (!(await isWorkspaceEntitledToFeature(workspaceId, "twilio"))) {
    throw new HttpError("Modulo Twilio non abilitato per questo workspace. Contatta Tecma.", 403);
  }
  const parsed = ConfigSchema.parse({
    accountSid: input.accountSid.trim(),
    authToken: input.authToken.trim(),
    fromNumber: input.fromNumber.trim().replace(/\s/g, ""),
  });
  const db = getDb();
  const now = new Date();
  const doc = {
    workspaceId,
    connectorId: CONNECTOR_ID,
    config: {
      accountSid: parsed.accountSid,
      authToken: parsed.authToken,
      fromNumber: parsed.fromNumber,
    },
    updatedAt: now,
  };
  await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId: CONNECTOR_ID },
    { $set: doc },
    { upsert: true }
  );
  const row = await getWhatsAppConfig(workspaceId);
  if (!row) throw new Error("Failed to read saved WhatsApp config");
  return row;
}

export async function deleteWhatsAppConfig(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: CONNECTOR_ID });
  return (result.deletedCount ?? 0) > 0;
}
