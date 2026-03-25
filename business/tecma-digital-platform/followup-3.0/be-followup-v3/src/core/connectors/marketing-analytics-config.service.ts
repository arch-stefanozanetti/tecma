/**
 * Segreti marketing (Meta Ads, GA4, Google Ads OAuth) per workspace.
 * Collezione tz_connector_configs — stesso schema di Meta WhatsApp.
 */
import { z } from "zod";
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_connector_configs";

export const MARKETING_META_ADS_CONNECTOR_ID = "marketing_meta_ads";
export const MARKETING_GA4_CONNECTOR_ID = "marketing_ga4";
export const MARKETING_GOOGLE_ADS_CONNECTOR_ID = "marketing_google_ads";

const MetaSchema = z.object({
  accessToken: z.string().min(1),
});

const Ga4Schema = z.object({
  serviceAccountJson: z.string().min(1),
});

const GoogleAdsSchema = z.object({
  refreshToken: z.string().min(1),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
});

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
  return "*".repeat(Math.min(token.length - 4, 32)) + token.slice(-4);
}

function maskJson(_j: string): string {
  return "[service account — mascherato]";
}

export interface MarketingMetaAdsConfigRow {
  workspaceId: string;
  connectorId: string;
  accessTokenMasked?: string;
  updatedAt: string;
}

export interface MarketingGa4ConfigRow {
  workspaceId: string;
  connectorId: string;
  serviceAccountJsonMasked?: string;
  updatedAt: string;
}

export interface MarketingGoogleAdsConfigRow {
  workspaceId: string;
  connectorId: string;
  refreshTokenMasked?: string;
  hasClientId: boolean;
  hasClientSecret: boolean;
  updatedAt: string;
}

export async function getMarketingMetaAdsConfig(workspaceId: string): Promise<MarketingMetaAdsConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: MARKETING_META_ADS_CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const token = String(config?.accessToken ?? "");
  return {
    workspaceId,
    connectorId: MARKETING_META_ADS_CONNECTOR_ID,
    accessTokenMasked: token ? maskToken(token) : undefined,
    updatedAt: toIso(doc.updatedAt),
  };
}

export async function getMarketingMetaAdsAccessToken(workspaceId: string): Promise<string | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: MARKETING_META_ADS_CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const t = String(config?.accessToken ?? "").trim();
  return t || null;
}

export async function saveMarketingMetaAdsConfig(
  workspaceId: string,
  input: { accessToken: string }
): Promise<MarketingMetaAdsConfigRow> {
  const parsed = MetaSchema.parse({ accessToken: input.accessToken.trim() });
  const db = getDb();
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId: MARKETING_META_ADS_CONNECTOR_ID },
    {
      $set: {
        workspaceId,
        connectorId: MARKETING_META_ADS_CONNECTOR_ID,
        config: { accessToken: parsed.accessToken },
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  const row = await getMarketingMetaAdsConfig(workspaceId);
  if (!row) throw new Error("Failed to read Meta Ads marketing config");
  return row;
}

export async function deleteMarketingMetaAdsConfig(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const r = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: MARKETING_META_ADS_CONNECTOR_ID });
  return (r.deletedCount ?? 0) > 0;
}

export async function getMarketingGa4Config(workspaceId: string): Promise<MarketingGa4ConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: MARKETING_GA4_CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const j = String(config?.serviceAccountJson ?? "");
  return {
    workspaceId,
    connectorId: MARKETING_GA4_CONNECTOR_ID,
    serviceAccountJsonMasked: j ? maskJson(j) : undefined,
    updatedAt: toIso(doc.updatedAt),
  };
}

export async function getMarketingGa4ServiceAccountJson(workspaceId: string): Promise<string | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: MARKETING_GA4_CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const j = String(config?.serviceAccountJson ?? "").trim();
  return j || null;
}

export async function saveMarketingGa4Config(
  workspaceId: string,
  input: { serviceAccountJson: string }
): Promise<MarketingGa4ConfigRow> {
  const parsed = Ga4Schema.parse({ serviceAccountJson: input.serviceAccountJson.trim() });
  const db = getDb();
  const now = new Date();
  await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId: MARKETING_GA4_CONNECTOR_ID },
    {
      $set: {
        workspaceId,
        connectorId: MARKETING_GA4_CONNECTOR_ID,
        config: { serviceAccountJson: parsed.serviceAccountJson },
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  const row = await getMarketingGa4Config(workspaceId);
  if (!row) throw new Error("Failed to read GA4 marketing config");
  return row;
}

export async function deleteMarketingGa4Config(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const r = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: MARKETING_GA4_CONNECTOR_ID });
  return (r.deletedCount ?? 0) > 0;
}

export async function getMarketingGoogleAdsConfig(workspaceId: string): Promise<MarketingGoogleAdsConfigRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: MARKETING_GOOGLE_ADS_CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const rt = String(config?.refreshToken ?? "");
  const cid = String(config?.clientId ?? "").trim();
  const cs = String(config?.clientSecret ?? "").trim();
  return {
    workspaceId,
    connectorId: MARKETING_GOOGLE_ADS_CONNECTOR_ID,
    refreshTokenMasked: rt ? maskToken(rt) : undefined,
    hasClientId: cid.length > 0,
    hasClientSecret: cs.length > 0,
    updatedAt: toIso(doc.updatedAt),
  };
}

export async function getMarketingGoogleAdsOAuthSecrets(workspaceId: string): Promise<{
  refreshToken: string;
  clientId?: string;
  clientSecret?: string;
} | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId, connectorId: MARKETING_GOOGLE_ADS_CONNECTOR_ID });
  if (!doc) return null;
  const config = doc.config as Record<string, unknown>;
  const refreshToken = String(config?.refreshToken ?? "").trim();
  if (!refreshToken) return null;
  const clientId = String(config?.clientId ?? "").trim();
  const clientSecret = String(config?.clientSecret ?? "").trim();
  return {
    refreshToken,
    ...(clientId ? { clientId } : {}),
    ...(clientSecret ? { clientSecret } : {}),
  };
}

export async function saveMarketingGoogleAdsConfig(
  workspaceId: string,
  input: { refreshToken: string; clientId?: string; clientSecret?: string }
): Promise<MarketingGoogleAdsConfigRow> {
  const parsed = GoogleAdsSchema.parse({
    refreshToken: input.refreshToken.trim(),
    clientId: input.clientId?.trim(),
    clientSecret: input.clientSecret?.trim(),
  });
  const db = getDb();
  const now = new Date();
  const cfg: Record<string, string> = { refreshToken: parsed.refreshToken };
  if (parsed.clientId) cfg.clientId = parsed.clientId;
  if (parsed.clientSecret) cfg.clientSecret = parsed.clientSecret;
  await db.collection(COLLECTION).updateOne(
    { workspaceId, connectorId: MARKETING_GOOGLE_ADS_CONNECTOR_ID },
    {
      $set: {
        workspaceId,
        connectorId: MARKETING_GOOGLE_ADS_CONNECTOR_ID,
        config: cfg,
        updatedAt: now,
      },
    },
    { upsert: true }
  );
  const row = await getMarketingGoogleAdsConfig(workspaceId);
  if (!row) throw new Error("Failed to read Google Ads marketing config");
  return row;
}

export async function deleteMarketingGoogleAdsConfig(workspaceId: string): Promise<boolean> {
  const db = getDb();
  const r = await db.collection(COLLECTION).deleteOne({ workspaceId, connectorId: MARKETING_GOOGLE_ADS_CONNECTOR_ID });
  return (r.deletedCount ?? 0) > 0;
}

