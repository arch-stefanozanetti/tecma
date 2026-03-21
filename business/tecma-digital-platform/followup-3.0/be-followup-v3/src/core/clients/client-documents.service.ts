/**
 * Documenti cliente (sensibili): proposta, contratto. Collection tz_client_documents.
 * Upload via signed URL; visibility internal | client; audit su upload/access.
 */
import { getDb } from "../../config/db.js";
import {
  getPresignedGetUrl,
  getPresignedPutUrl,
  deleteObject,
  type PresignedGetAuditContext
} from "../assets/assets-s3.service.js";
import { HttpError } from "../../types/http.js";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import type { ClientDocumentType, ClientDocumentVisibility, TzClientDocumentDoc } from "../../types/models.js";
import { writeAuditLog } from "../audit/audit.service.js";

const COLLECTION = "tz_client_documents";
const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const DEFAULT_DOWNLOAD_EXPIRY_SEC = 60 * 60; // 1h
const CLIENT_LINK_EXPIRY_SEC = 7 * 24 * 60 * 60; // 7 days

const UploadUrlBodySchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().min(0),
  type: z.enum(["proposta", "contratto", "altro"]),
  projectId: z.string().optional(),
});

const ConfirmDocumentBodySchema = z.object({
  key: z.string().min(1).max(1024),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(100),
  fileSize: z.number().int().min(0),
  type: z.enum(["proposta", "contratto", "altro"]),
  visibility: z.enum(["internal", "client"]),
  projectId: z.string().optional(),
});

function safeFileName(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "document";
  const ext = name.toLowerCase().endsWith(".pdf") ? "pdf" : "pdf";
  return base.toLowerCase().endsWith(`.${ext}`) ? base : `${base}.${ext}`;
}

function buildClientDocumentKey(workspaceId: string, clientId: string, name: string, mimeType: string): string {
  const suffix = safeFileName(name);
  return `workspaces/${workspaceId}/clients/${clientId}/documents/${Date.now()}-${randomBytes(4).toString("hex")}-${suffix}`;
}

export async function getClientDocumentUploadUrl(
  workspaceId: string,
  clientId: string,
  userId: string,
  rawInput: unknown
): Promise<{ uploadUrl: string; key: string; expiresAt: string }> {
  const input = UploadUrlBodySchema.parse(rawInput);
  if (input.fileSize > MAX_DOCUMENT_SIZE_BYTES) {
    throw new HttpError(`File troppo grande (max ${Math.round(MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024)}MB)`, 400);
  }
  const key = buildClientDocumentKey(workspaceId, clientId, input.name, input.mimeType);
  const { uploadUrl, expiresAt } = await getPresignedPutUrl(key, input.mimeType);
  return { uploadUrl, key, expiresAt: expiresAt.toISOString() };
}

export async function createClientDocument(
  workspaceId: string,
  clientId: string,
  userId: string,
  rawInput: unknown
): Promise<TzClientDocumentDoc> {
  const input = ConfirmDocumentBodySchema.parse(rawInput);
  if (input.fileSize > MAX_DOCUMENT_SIZE_BYTES) {
    throw new HttpError(`File troppo grande (max ${Math.round(MAX_DOCUMENT_SIZE_BYTES / 1024 / 1024)}MB)`, 400);
  }
  const db = getDb();
  const now = new Date();
  const doc: Omit<TzClientDocumentDoc, "_id"> = {
    workspace_id: workspaceId,
    client_id: clientId,
    project_id: input.projectId,
    name: input.name,
    file_key: input.key,
    file_size: input.fileSize,
    type: input.type as ClientDocumentType,
    visibility: input.visibility as ClientDocumentVisibility,
    uploaded_by: userId,
    created_at: now,
  };
  const result = await db.collection<TzClientDocumentDoc>(COLLECTION).insertOne(doc as TzClientDocumentDoc);
  await writeAuditLog({
    userId,
    action: "client_document.upload",
    entityType: "client_document",
    entityId: result.insertedId.toHexString(),
    workspaceId,
    changes: { after: { clientId, name: input.name, type: input.type, visibility: input.visibility } },
  });
  return { ...doc, _id: result.insertedId } as TzClientDocumentDoc;
}

export async function listClientDocuments(
  workspaceId: string,
  clientId: string,
  _forClient?: boolean
): Promise<TzClientDocumentDoc[]> {
  const db = getDb();
  const filter: Record<string, unknown> = { workspace_id: workspaceId, client_id: clientId };
  if (_forClient) filter.visibility = "client";
  const cursor = db.collection<TzClientDocumentDoc>(COLLECTION).find(filter).sort({ created_at: -1 });
  return cursor.toArray();
}

export async function getClientDocumentById(
  workspaceId: string,
  clientId: string,
  docId: string
): Promise<TzClientDocumentDoc | null> {
  const db = getDb();
  if (!ObjectId.isValid(docId)) return null;
  const doc = await db.collection<TzClientDocumentDoc>(COLLECTION).findOne({
    _id: new ObjectId(docId),
    workspace_id: workspaceId,
    client_id: clientId,
  });
  return doc;
}

export async function getClientDocumentDownloadUrl(
  workspaceId: string,
  clientId: string,
  docId: string,
  expiresInSec: number = DEFAULT_DOWNLOAD_EXPIRY_SEC,
  audit?: Omit<PresignedGetAuditContext, "entityType" | "entityId" | "workspaceId">
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const doc = await getClientDocumentById(workspaceId, clientId, docId);
  if (!doc) throw new HttpError("Documento non trovato", 404);
  const { downloadUrl, expiresAt } = await getPresignedGetUrl(doc.file_key, expiresInSec, {
    ...audit,
    workspaceId,
    entityType: "client_document",
    entityId: docId
  });
  return { downloadUrl, expiresAt: expiresAt.toISOString() };
}

/** Signed URL a lunga scadenza (7 giorni) per condivisione con cliente. */
export async function getClientDocumentShareLink(
  workspaceId: string,
  clientId: string,
  docId: string
): Promise<{ downloadUrl: string; expiresAt: string }> {
  const doc = await getClientDocumentById(workspaceId, clientId, docId);
  if (!doc) throw new HttpError("Documento non trovato", 404);
  if (doc.visibility !== "client") {
    throw new HttpError("Il documento non è visibile al cliente", 400);
  }
  return getClientDocumentDownloadUrl(workspaceId, clientId, docId, CLIENT_LINK_EXPIRY_SEC);
}

export async function deleteClientDocument(
  workspaceId: string,
  clientId: string,
  docId: string,
  userId: string
): Promise<void> {
  const doc = await getClientDocumentById(workspaceId, clientId, docId);
  if (!doc) throw new HttpError("Documento non trovato", 404);
  await deleteObject(doc.file_key);
  await getDb().collection(COLLECTION).deleteOne({ _id: doc._id, workspace_id: workspaceId, client_id: clientId });
  await writeAuditLog({
    userId,
    action: "client_document.delete",
    entityType: "client_document",
    entityId: docId,
    workspaceId,
    changes: { before: { name: doc.name, type: doc.type } },
  });
}
