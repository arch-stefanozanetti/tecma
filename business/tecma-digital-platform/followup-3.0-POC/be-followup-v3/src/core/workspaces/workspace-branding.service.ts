/**
 * Workspace branding: logo e email header (asset IDs + signed URLs on demand).
 */
import { getDb } from "../../config/db.js";
import { getDownloadUrl } from "../assets/assets.service.js";
import { HttpError } from "../../types/http.js";
import { z } from "zod";

const COLLECTION = "tz_workspace_branding";
const DOWNLOAD_URL_EXPIRY_SEC = 60 * 60; // 1h per visualizzazione

const BrandingPatchSchema = z.object({
  logoAssetId: z.string().optional(),
  emailHeaderAssetId: z.string().optional(),
});

export interface WorkspaceBrandingRow {
  workspaceId: string;
  logoAssetId?: string;
  emailHeaderAssetId?: string;
  logoDownloadUrl?: string;
  emailHeaderDownloadUrl?: string;
  updatedAt: string;
}

export async function getWorkspaceBranding(
  workspaceId: string
): Promise<WorkspaceBrandingRow> {
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ workspaceId });
  const now = new Date().toISOString();
  if (!doc) {
    return { workspaceId, updatedAt: now };
  }
  const row: WorkspaceBrandingRow = {
    workspaceId,
    logoAssetId: typeof doc.logo_asset_id === "string" ? doc.logo_asset_id : undefined,
    emailHeaderAssetId: typeof doc.email_header_asset_id === "string" ? doc.email_header_asset_id : undefined,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : String(doc.updatedAt ?? now),
  };
  if (row.logoAssetId) {
    try {
      const { downloadUrl } = await getDownloadUrl(workspaceId, row.logoAssetId, DOWNLOAD_URL_EXPIRY_SEC);
      row.logoDownloadUrl = downloadUrl;
    } catch {
      /* asset deleted or not found */
    }
  }
  if (row.emailHeaderAssetId) {
    try {
      const { downloadUrl } = await getDownloadUrl(workspaceId, row.emailHeaderAssetId, DOWNLOAD_URL_EXPIRY_SEC);
      row.emailHeaderDownloadUrl = downloadUrl;
    } catch {
      /* asset deleted or not found */
    }
  }
  return row;
}

export async function putWorkspaceBranding(
  workspaceId: string,
  rawInput: unknown
): Promise<WorkspaceBrandingRow> {
  const input = BrandingPatchSchema.parse(rawInput);
  const db = getDb();
  const now = new Date().toISOString();
  const update: Record<string, unknown> = {
    updatedAt: now,
  };
  if (input.logoAssetId !== undefined) update.logo_asset_id = input.logoAssetId || null;
  if (input.emailHeaderAssetId !== undefined) update.email_header_asset_id = input.emailHeaderAssetId || null;

  await db.collection(COLLECTION).updateOne(
    { workspaceId },
    { $set: update },
    { upsert: true }
  );
  return getWorkspaceBranding(workspaceId);
}
