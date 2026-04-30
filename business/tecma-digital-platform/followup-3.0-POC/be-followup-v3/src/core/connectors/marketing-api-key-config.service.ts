/**
 * API key per connettori marketing (Mailchimp, ActiveCampaign). Collection tz_connector_configs.
 */
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { isWorkspaceEntitledToFeature } from "../workspaces/workspace-entitlements.service.js";

const COLLECTION = "tz_connector_configs";

export type MarketingConnectorKind = "mailchimp" | "activecampaign";

const CONNECTOR_ID: Record<MarketingConnectorKind, string> = {
  mailchimp: "mailchimp",
  activecampaign: "activecampaign",
};

const ConfigSchema = z.object({
  apiKey: z.string().min(1),
});

export interface MarketingApiKeyConfigRow {
  _id: string;
  workspaceId: string;
  connectorId: string;
  config: {
    apiKeyMasked?: string;
    /** Solo ActiveCampaign: base URL account (es. https://nome.api-us1.com). */
    apiBaseUrl?: string;
  };
  updatedAt: string;
}

/** Input salvataggio: stringa = solo API key (Mailchimp o rotazione AC); oggetto = key + opzionale base URL AC. */
export type MarketingConfigSaveInput = string | { apiKey: string; apiBaseUrl?: string };

/** Segreti lato server (mai esposti in HTTP). */
export interface MarketingConnectorSecrets {
  apiKey: string;
  apiBaseUrl?: string;
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
  if (!key || key.length <= 4) return "****";
  return "*".repeat(key.length - 4) + key.slice(-4);
}

async function assertMarketingEntitled(workspaceId: string, kind: MarketingConnectorKind): Promise<void> {
  if (!(await isWorkspaceEntitledToFeature(workspaceId, "integrations"))) {
    throw new HttpError("Integrazioni non abilitate per questo workspace. Contatta Tecma.", 403);
  }
  const feature = kind === "mailchimp" ? "mailchimp" : "activecampaign";
  if (!(await isWorkspaceEntitledToFeature(workspaceId, feature))) {
    throw new HttpError("Modulo marketing non abilitato per questo workspace. Contatta Tecma.", 403);
  }
}

export async function getMarketingApiKeyConfig(
  workspaceId: string,
  kind: MarketingConnectorKind
): Promise<MarketingApiKeyConfigRow | null> {
  const connectorId = CONNECTOR_ID[kind];
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const apiBaseRaw = typeof config?.apiBaseUrl === "string" ? config.apiBaseUrl.trim().replace(/\/$/, "") : "";
  return {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id),
    workspaceId: String(doc.workspaceId),
    connectorId: String(doc.connectorId),
    config: {
      apiKeyMasked: config?.apiKey ? maskKey(String(config.apiKey)) : undefined,
      ...(apiBaseRaw ? { apiBaseUrl: apiBaseRaw } : {}),
    },
    updatedAt: toIso(doc.updatedAt),
  };
}

/**
 * Legge apiKey (e apiBaseUrl per AC) dal DB — solo per chiamate server-to-provider.
 */
export async function getMarketingConnectorSecrets(
  workspaceId: string,
  kind: MarketingConnectorKind
): Promise<MarketingConnectorSecrets | null> {
  const connectorId = CONNECTOR_ID[kind];
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId });
  if (!doc) return null;
  const c = doc.config as Record<string, unknown>;
  const apiKey = typeof c.apiKey === "string" && c.apiKey.trim() ? c.apiKey.trim() : null;
  if (!apiKey) return null;
  const apiBaseUrl =
    typeof c.apiBaseUrl === "string" && c.apiBaseUrl.trim() ? c.apiBaseUrl.trim().replace(/\/$/, "") : undefined;
  return { apiKey, apiBaseUrl };
}

export async function saveMarketingApiKeyConfig(
  workspaceId: string,
  kind: MarketingConnectorKind,
  input: MarketingConfigSaveInput
): Promise<MarketingApiKeyConfigRow> {
  await assertMarketingEntitled(workspaceId, kind);
  const raw = typeof input === "string" ? { apiKey: input } : input;
  const parsed = ConfigSchema.parse({ apiKey: raw.apiKey.trim() });
  const connectorId = CONNECTOR_ID[kind];
  const db = getDb();
  const existing = await db.collection(COLLECTION).findOne({ workspaceId, connectorId });
  const prev = (existing?.config as Record<string, unknown>) ?? {};
  const now = new Date();

  const nextConfig: Record<string, unknown> = { apiKey: parsed.apiKey };
  if (kind === "activecampaign") {
    const incomingUrl = typeof raw.apiBaseUrl === "string" ? raw.apiBaseUrl.trim().replace(/\/$/, "") : "";
    const keptUrl =
      typeof prev.apiBaseUrl === "string" && prev.apiBaseUrl.trim() ? prev.apiBaseUrl.trim().replace(/\/$/, "") : "";
    const apiBaseUrl = incomingUrl || keptUrl;
    if (!apiBaseUrl) {
      throw new HttpError(
        "Per ActiveCampaign è obbligatorio l'URL API (es. https://tuaccount.api-us1.com) al primo salvataggio.",
        400
      );
    }
    nextConfig.apiBaseUrl = apiBaseUrl;
  }

  await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId },
    { $set: { workspaceId, connectorId, config: nextConfig, updatedAt: now } },
    { upsert: true }
  );
  const row = await getMarketingApiKeyConfig(workspaceId, kind);
  if (!row) throw new Error("Failed to read saved marketing connector config");
  return row;
}

export async function deleteMarketingApiKeyConfig(workspaceId: string, kind: MarketingConnectorKind): Promise<boolean> {
  const connectorId = CONNECTOR_ID[kind];
  const db = getDb();
  const result = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId });
  return (result.deletedCount ?? 0) > 0;
}
