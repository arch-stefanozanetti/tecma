/**
 * Identificativi marketing non sensibili per progetto (customer Ads, property GA4, ad account Meta).
 * Collezione tz_project_marketing_settings.
 */
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ensureProjectInWorkspace, toIsoDate } from "./project-access.js";

const COLLECTION = "tz_project_marketing_settings";

const PutSchema = z.object({
  googleAdsCustomerId: z.string().max(32).optional().nullable(),
  googleAdsLoginCustomerId: z.string().max(32).optional().nullable(),
  ga4PropertyId: z.string().max(32).optional().nullable(),
  metaAdAccountId: z.string().max(64).optional().nullable(),
  siteHostname: z.string().max(300).optional().nullable(),
});

export interface ProjectMarketingSettingsRow {
  projectId: string;
  googleAdsCustomerId?: string;
  googleAdsLoginCustomerId?: string;
  ga4PropertyId?: string;
  metaAdAccountId?: string;
  siteHostname?: string;
  updatedAt: string;
}

function normalizeId(s: string | null | undefined): string | undefined {
  if (s == null) return undefined;
  const t = String(s).trim();
  return t.length > 0 ? t : undefined;
}

/** Lettura solo DB — usare dopo aver verificato accesso al progetto (es. Big Data). */
export async function getProjectMarketingSettingsRaw(projectId: string): Promise<ProjectMarketingSettingsRow | null> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ projectId });
  if (!doc) return null;
  return {
    projectId,
    googleAdsCustomerId: normalizeId(doc.googleAdsCustomerId as string),
    googleAdsLoginCustomerId: normalizeId(doc.googleAdsLoginCustomerId as string),
    ga4PropertyId: normalizeId(doc.ga4PropertyId as string),
    metaAdAccountId: normalizeId(doc.metaAdAccountId as string),
    siteHostname: normalizeId(doc.siteHostname as string),
    updatedAt: toIsoDate(doc.updatedAt),
  };
}

export async function getProjectMarketingSettings(
  projectId: string,
  workspaceId: string,
  isAdmin: boolean
): Promise<ProjectMarketingSettingsRow> {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const raw = await getProjectMarketingSettingsRaw(projectId);
  if (!raw) {
    return { projectId, updatedAt: new Date(0).toISOString() };
  }
  return raw;
}

export async function putProjectMarketingSettings(
  projectId: string,
  workspaceId: string,
  isAdmin: boolean,
  rawInput: unknown
): Promise<ProjectMarketingSettingsRow> {
  await ensureProjectInWorkspace(projectId, workspaceId, isAdmin);
  const input = PutSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();
  const doc: Record<string, unknown> = {
    projectId,
    updatedAt: now,
  };
  if (input.googleAdsCustomerId !== undefined) {
    doc.googleAdsCustomerId = normalizeId(input.googleAdsCustomerId ?? undefined) ?? null;
  }
  if (input.googleAdsLoginCustomerId !== undefined) {
    doc.googleAdsLoginCustomerId = normalizeId(input.googleAdsLoginCustomerId ?? undefined) ?? null;
  }
  if (input.ga4PropertyId !== undefined) {
    doc.ga4PropertyId = normalizeId(input.ga4PropertyId ?? undefined) ?? null;
  }
  if (input.metaAdAccountId !== undefined) {
    doc.metaAdAccountId = normalizeId(input.metaAdAccountId ?? undefined) ?? null;
  }
  if (input.siteHostname !== undefined) {
    doc.siteHostname = normalizeId(input.siteHostname ?? undefined) ?? null;
  }
  await db.collection(COLLECTION).updateOne({ projectId }, { $set: doc }, { upsert: true });
  return getProjectMarketingSettings(projectId, workspaceId, isAdmin);
}
