import {
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomBytes } from "node:crypto";
import { HttpError } from "../../types/http.js";
import { buildStandardProjectFolders, resolveStorageScope } from "./storage-policy.service.js";
import { hashStorageKey, recordSecurityEvent } from "../compliance/security-audit.service.js";
import { logger } from "../../observability/logger.js";

const MAX_UPLOAD_SIZE_MB = Number(process.env.OCI_MAX_UPLOAD_MB ?? 10);
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);

interface StorageAuditContext {
  actorUserId?: string;
  workspaceId: string;
  projectId?: string;
  ip?: string | null;
  userAgent?: string | null;
}

function auditStorage(
  action: string,
  context: StorageAuditContext,
  metadata: Record<string, unknown>
): void {
  logger.info(
    {
      action,
      actorUserId: context.actorUserId,
      workspaceId: context.workspaceId,
      projectId: context.projectId,
      ...metadata,
    },
    "[storage] operation"
  );
  void recordSecurityEvent({
    action,
    userId: context.actorUserId,
    entityType: "storage",
    entityId: String(metadata.key ?? metadata.prefix ?? metadata.bucket ?? "storage"),
    workspaceId: context.workspaceId,
    projectId: context.projectId,
    ip: context.ip ?? undefined,
    userAgent: context.userAgent ?? undefined,
    metadata,
  });
}

function getClient(): S3Client {
  const endpoint = process.env.OCI_S3_ENDPOINT?.trim();
  const region = process.env.OCI_S3_REGION?.trim() || process.env.AWS_REGION?.trim() || "eu-frankfurt-1";
  if (!endpoint) throw new HttpError("OCI_S3_ENDPOINT non configurato", 500);
  const accessKeyId = process.env.OCI_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.OCI_S3_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) throw new HttpError("Credenziali OCI S3 mancanti", 500);
  return new S3Client({
    region,
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function safeFileName(fileName: string, mimeType: string): string {
  const base = fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80) || "asset";
  const ext = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : mimeType.includes("gif")
        ? "gif"
        : mimeType.includes("svg")
          ? "svg"
          : "jpg";
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

function joinPrefix(prefix: string, fileName: string): string {
  const p = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return `${p}${fileName}`;
}

export async function listStorageObjects(input: {
  workspaceId: string;
  projectId?: string;
  requestedBucket?: string;
  requestedPrefix?: string;
  isTecmaAdmin?: boolean;
  audit?: StorageAuditContext;
}) {
  const scope = await resolveStorageScope(input);
  const client = getClient();
  const cmd = new ListObjectsV2Command({
    Bucket: scope.bucket,
    Prefix: scope.prefix,
    Delimiter: "/",
    MaxKeys: 200,
  });
  const out = await client.send(cmd);
  const payload = {
    bucket: scope.bucket,
    prefix: scope.prefix,
    folders: (out.CommonPrefixes ?? []).map((p) => p.Prefix ?? "").filter(Boolean),
    files: (out.Contents ?? [])
      .map((obj) => ({
        key: obj.Key ?? "",
        size: Number(obj.Size ?? 0),
        lastModified: obj.LastModified?.toISOString(),
      }))
      .filter((f) => f.key && !f.key.endsWith("/")),
  };
  if (input.audit) {
    auditStorage("storage.list", input.audit, {
      bucket: scope.bucket,
      prefix: scope.prefix,
      foldersCount: payload.folders.length,
      filesCount: payload.files.length,
    });
  }
  return payload;
}

export async function createStorageFolder(input: {
  workspaceId: string;
  projectId?: string;
  requestedBucket?: string;
  requestedPrefix: string;
  isTecmaAdmin?: boolean;
  audit?: StorageAuditContext;
}) {
  const scope = await resolveStorageScope(input);
  const client = getClient();
  const folderKey = scope.prefix.endsWith("/") ? scope.prefix : `${scope.prefix}/`;
  await client.send(
    new PutObjectCommand({
      Bucket: scope.bucket,
      Key: folderKey,
      Body: "",
      ContentType: "application/x-directory",
    })
  );
  if (input.audit) {
    auditStorage("storage.create_folder", input.audit, {
      bucket: scope.bucket,
      prefix: scope.prefix,
      key: folderKey,
    });
  }
  return { bucket: scope.bucket, folderKey };
}

export async function createStorageUploadUrl(input: {
  workspaceId: string;
  projectId?: string;
  requestedBucket?: string;
  requestedPrefix?: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  isTecmaAdmin?: boolean;
  audit?: StorageAuditContext;
}) {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    throw new HttpError("Tipo file non consentito", 400);
  }
  if ((input.sizeBytes ?? 0) > MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
    throw new HttpError(`File troppo grande (max ${MAX_UPLOAD_SIZE_MB}MB)`, 400);
  }
  const scope = await resolveStorageScope(input);
  const safeName = safeFileName(input.fileName, input.mimeType);
  const finalName = `${Date.now()}-${randomBytes(3).toString("hex")}-${safeName}`;
  const key = joinPrefix(scope.prefix, finalName);
  const client = getClient();
  const expiresInSec = 15 * 60;
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: scope.bucket,
      Key: key,
      ContentType: input.mimeType,
    }),
    { expiresIn: expiresInSec }
  );
  const base = process.env.OCI_OBJECT_PUBLIC_BASE_URL?.trim();
  const publicUrl = base
    ? `${base.replace(/\/$/, "")}/${scope.bucket}/${encodeURI(key)}`
    : null;
  const payload = {
    bucket: scope.bucket,
    key,
    uploadUrl,
    expiresAt: new Date(Date.now() + expiresInSec * 1000).toISOString(),
    publicUrl,
  };
  if (input.audit) {
    auditStorage("storage.upload_url", input.audit, {
      bucket: scope.bucket,
      prefix: scope.prefix,
      keyHash: hashStorageKey(key),
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes ?? null,
    });
  }
  return payload;
}

export async function bootstrapProjectFolders(input: {
  workspaceId: string;
  projectId: string;
  requestedBucket?: string;
  isTecmaAdmin?: boolean;
  audit?: StorageAuditContext;
}) {
  const scope = await resolveStorageScope({
    ...input,
    requestedPrefix: undefined,
  });
  if (!scope.projectDisplayName) throw new HttpError("Project display name non trovato", 404);
  const folders = buildStandardProjectFolders(scope.projectDisplayName);
  const client = getClient();
  for (const key of folders) {
    await client.send(
      new PutObjectCommand({
        Bucket: scope.bucket,
        Key: key,
        Body: "",
        ContentType: "application/x-directory",
      })
    );
  }
  if (input.audit) {
    auditStorage("storage.bootstrap_folders", input.audit, {
      bucket: scope.bucket,
      projectId: input.projectId,
      foldersCount: folders.length,
    });
  }
  return { bucket: scope.bucket, folders };
}

