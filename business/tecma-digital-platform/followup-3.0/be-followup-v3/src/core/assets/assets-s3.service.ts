/**
 * S3 operations for workspace assets: presigned PUT/GET, key builder, delete.
 * Key structure: workspaces/{id}/branding/ | projects/{id}/images/ | apartments/{id}/
 * No permanent public URLs; all access via signed URLs with expiry.
 */
import { GetObjectCommand, PutObjectCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";
import type { AssetType } from "../../types/models.js";

const DEFAULT_UPLOAD_EXPIRY_SEC = 15 * 60; // 15 min
const DEFAULT_DOWNLOAD_EXPIRY_SEC = 60 * 60; // 1 h

const ALLOWED_IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const ALLOWED_DOCUMENT_EXT: Record<string, string> = {
  "application/pdf": "pdf",
};

function getExtForMime(mimeType: string, type: AssetType): string {
  if (type === "branding" || type === "image") {
    return ALLOWED_IMAGE_EXT[mimeType] ?? "jpg";
  }
  if (type === "planimetry" || type === "document") {
    return ALLOWED_DOCUMENT_EXT[mimeType] ?? "pdf";
  }
  return ALLOWED_IMAGE_EXT[mimeType] ?? ALLOWED_DOCUMENT_EXT[mimeType] ?? "bin";
}

/** Sanitize file name to a safe suffix (no path, no special chars). */
function safeFileName(name: string, mimeType: string, type: AssetType): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "file";
  const ext = getExtForMime(mimeType, type);
  if (base.toLowerCase().endsWith(`.${ext}`)) return base;
  return `${base}.${ext}`;
}

export interface BuildKeyParams {
  workspaceId: string;
  type: AssetType;
  projectId?: string;
  apartmentId?: string;
  name: string;
  mimeType: string;
}

/**
 * Build S3 key following plan structure.
 * workspaces/{workspaceId}/branding/...
 * workspaces/{workspaceId}/projects/{projectId}/images/...
 * workspaces/{workspaceId}/projects/{projectId}/apartments/{apartmentId}/...
 */
export function buildAssetKey(params: BuildKeyParams): string {
  const { workspaceId, type, projectId, apartmentId, name, mimeType } = params;
  const base = `workspaces/${workspaceId}`;

  if (type === "branding") {
    const suffix = safeFileName(name, mimeType, type);
    return `${base}/branding/${Date.now()}-${randomBytes(4).toString("hex")}-${suffix}`;
  }

  if (type === "image" && projectId && !apartmentId) {
    const suffix = safeFileName(name, mimeType, type);
    return `${base}/projects/${projectId}/images/${Date.now()}-${randomBytes(4).toString("hex")}-${suffix}`;
  }

  if ((type === "planimetry" || type === "image") && projectId && apartmentId) {
    const suffix = safeFileName(name, mimeType, type);
    return `${base}/projects/${projectId}/apartments/${apartmentId}/${Date.now()}-${randomBytes(4).toString("hex")}-${suffix}`;
  }

  if (type === "document" && projectId && apartmentId) {
    const suffix = safeFileName(name, mimeType, type);
    return `${base}/projects/${projectId}/apartments/${apartmentId}/${suffix}`;
  }

  const suffix = safeFileName(name, mimeType, type);
  return `${base}/misc/${Date.now()}-${randomBytes(4).toString("hex")}-${suffix}`;
}

function getClient(): S3Client {
  const region = process.env.AWS_REGION?.trim() || "eu-west-1";
  return new S3Client({ region });
}

function getBucket(): string {
  const bucket = process.env.ASSETS_S3_BUCKET?.trim() || process.env.EMAIL_FLOW_S3_BUCKET?.trim();
  if (!bucket) {
    throw new Error("Storage non configurato: imposta ASSETS_S3_BUCKET (o EMAIL_FLOW_S3_BUCKET)");
  }
  return bucket;
}

export async function getPresignedPutUrl(
  key: string,
  mimeType: string,
  expiresInSec: number = DEFAULT_UPLOAD_EXPIRY_SEC
): Promise<{ uploadUrl: string; expiresAt: Date }> {
  const client = getClient();
  const bucket = getBucket();
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: mimeType,
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSec });
  return { uploadUrl, expiresAt };
}

export async function getPresignedGetUrl(
  key: string,
  expiresInSec: number = DEFAULT_DOWNLOAD_EXPIRY_SEC
): Promise<{ downloadUrl: string; expiresAt: Date }> {
  const client = getClient();
  const bucket = getBucket();
  const expiresAt = new Date(Date.now() + expiresInSec * 1000);
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const downloadUrl = await getSignedUrl(client, command, { expiresIn: expiresInSec });
  return { downloadUrl, expiresAt };
}

export async function deleteObject(key: string): Promise<void> {
  const client = getClient();
  const bucket = getBucket();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}
