/**
 * Assets service: CRUD on tz_assets, presigned upload URL generation, download URL, delete (Mongo + S3).
 */
import { getDb } from "../../config/db.js";
import type { AssetType, TzAssetDoc } from "../../types/models.js";
import { buildAssetKey, getPresignedGetUrl, getPresignedPutUrl, deleteObject } from "./assets-s3.service.js";
import { HttpError } from "../../types/http.js";
import { ObjectId } from "mongodb";
import { z } from "zod";

const COLLECTION = "tz_assets";

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const UploadUrlBodySchema = z.object({
  type: z.enum(["image", "document", "planimetry", "branding"]),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().min(0),
  projectId: z.string().optional(),
  apartmentId: z.string().optional(),
});

const ConfirmAssetBodySchema = z.object({
  key: z.string().min(1).max(1024),
  type: z.enum(["image", "document", "planimetry", "branding"]),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().min(0),
  projectId: z.string().optional(),
  apartmentId: z.string().optional(),
});

export type UploadUrlInput = z.infer<typeof UploadUrlBodySchema>;
export type ConfirmAssetInput = z.infer<typeof ConfirmAssetBodySchema>;

function assertMaxSize(fileSize: number, type: AssetType): void {
  const max = type === "document" || type === "planimetry" ? MAX_DOCUMENT_SIZE_BYTES : MAX_IMAGE_SIZE_BYTES;
  if (fileSize > max) {
    throw new HttpError(`File size exceeds limit (max ${Math.round(max / 1024 / 1024)}MB)`, 400);
  }
}

export async function getUploadUrl(
  workspaceId: string,
  userId: string,
  rawInput: unknown
): Promise<{ uploadUrl: string; key: string; expiresAt: string }> {
  const input = UploadUrlBodySchema.parse(rawInput);
  assertMaxSize(input.fileSize, input.type as AssetType);

  const key = buildAssetKey({
    workspaceId,
    type: input.type as AssetType,
    projectId: input.projectId,
    apartmentId: input.apartmentId,
    name: input.name,
    mimeType: input.mimeType,
  });

  const { uploadUrl, expiresAt } = await getPresignedPutUrl(key, input.mimeType);
  return { uploadUrl, key, expiresAt: expiresAt.toISOString() };
}

export async function createAsset(
  workspaceId: string,
  userId: string,
  rawInput: unknown
): Promise<TzAssetDoc> {
  const input = ConfirmAssetBodySchema.parse(rawInput);
  assertMaxSize(input.fileSize, input.type as AssetType);

  const db = getDb();
  const now = new Date();
  const doc: Omit<TzAssetDoc, "_id"> = {
    workspace_id: workspaceId,
    project_id: input.projectId,
    apartment_id: input.apartmentId,
    type: input.type as AssetType,
    name: input.name,
    file_key: input.key,
    file_size: input.fileSize,
    mime_type: input.mimeType,
    uploaded_by: userId,
    created_at: now,
  };
  const result = await db.collection<TzAssetDoc>(COLLECTION).insertOne(doc as TzAssetDoc);
  return { ...doc, _id: result.insertedId } as TzAssetDoc;
}

export interface ListAssetsQuery {
  projectId?: string;
  apartmentId?: string;
  type?: AssetType;
}

export async function listAssets(
  workspaceId: string,
  query: ListAssetsQuery
): Promise<TzAssetDoc[]> {
  const db = getDb();
  const filter: Record<string, unknown> = { workspace_id: workspaceId };
  if (query.projectId) filter.project_id = query.projectId;
  if (query.apartmentId) filter.apartment_id = query.apartmentId;
  if (query.type) filter.type = query.type;

  const cursor = db
    .collection<TzAssetDoc>(COLLECTION)
    .find(filter)
    .sort({ created_at: -1 });
  return cursor.toArray();
}

export async function getAssetById(workspaceId: string, assetId: string): Promise<TzAssetDoc | null> {
  const db = getDb();
  if (!ObjectId.isValid(assetId)) return null;
  const doc = await db.collection<TzAssetDoc>(COLLECTION).findOne({
    _id: new ObjectId(assetId),
    workspace_id: workspaceId,
  });
  return doc;
}

export async function getDownloadUrl(
  workspaceId: string,
  assetId: string,
  expiresInSec?: number
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const asset = await getAssetById(workspaceId, assetId);
  if (!asset) throw new HttpError("Asset not found", 404);
  const { downloadUrl, expiresAt } = await getPresignedGetUrl(asset.file_key, expiresInSec);
  return { downloadUrl, expiresAt: expiresAt.toISOString() };
}

export async function deleteAsset(workspaceId: string, assetId: string): Promise<void> {
  const asset = await getAssetById(workspaceId, assetId);
  if (!asset) throw new HttpError("Asset not found", 404);
  await deleteObject(asset.file_key);
  const db = getDb();
  await db.collection(COLLECTION).deleteOne({ _id: asset._id, workspace_id: workspaceId });
}
