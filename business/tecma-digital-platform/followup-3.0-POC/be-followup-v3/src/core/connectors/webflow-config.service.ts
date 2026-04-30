/**
 * Webflow Data API v2: token + site + collection per sync CMS.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_connector_configs";
const CONNECTOR_ID = "webflow";

const ConfigSchema = z.object({
  apiToken: z.string().min(1),
  siteId: z.string().min(1),
  /** Collection CMS «Appartamenti» (ID dalla UI Webflow) */
  apartmentsCollectionId: z.string().min(1),
});

export interface WebflowConfigRow {
  _id: string;
  workspaceId: string;
  connectorId: string;
  config: {
    apiTokenMasked?: string;
    siteId: string;
    apartmentsCollectionId: string;
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

function maskToken(t: string): string {
  if (!t || t.length <= 8) return "****";
  return t.slice(0, 4) + "*".repeat(12) + t.slice(-4);
}

export async function getWebflowConfig(workspaceId: string): Promise<WebflowConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId),
    connectorId: CONNECTOR_ID,
    config: {
      apiTokenMasked: config?.apiToken ? maskToken(String(config.apiToken)) : undefined,
      siteId: String(config?.siteId ?? ""),
      apartmentsCollectionId: String(config?.apartmentsCollectionId ?? ""),
    },
    updatedAt: toIso(doc.updatedAt),
  };
}

export async function saveWebflowConfig(
  workspaceId: string,
  input: { apiToken: string; siteId: string; apartmentsCollectionId: string }
): Promise<WebflowConfigRow> {
  const parsed = ConfigSchema.parse({
    apiToken: input.apiToken.trim(),
    siteId: input.siteId.trim(),
    apartmentsCollectionId: input.apartmentsCollectionId.trim(),
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
          apiToken: parsed.apiToken,
          siteId: parsed.siteId,
          apartmentsCollectionId: parsed.apartmentsCollectionId,
        },
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  const row = await getWebflowConfig(workspaceId);
  if (!row) throw new HttpError("Errore salvataggio Webflow", 500);
  return row;
}

export async function deleteWebflowConfig(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: CONNECTOR_ID });
  return (result.deletedCount ?? 0) > 0;
}

export async function getWebflowSecrets(
  workspaceId: string
): Promise<{ apiToken: string; siteId: string; apartmentsCollectionId: string } | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const apiToken = String(config?.apiToken ?? "").trim();
  const siteId = String(config?.siteId ?? "").trim();
  const apartmentsCollectionId = String(config?.apartmentsCollectionId ?? "").trim();
  if (!apiToken || !siteId || !apartmentsCollectionId) return null;
  return { apiToken, siteId, apartmentsCollectionId };
}
