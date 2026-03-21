/**
 * Audit di sicurezza / compliance in append-only (tz_security_audit).
 * Nessun update/delete via applicazione; export verso storage WORM è responsabilità ops/worker.
 */
import { createHash } from "node:crypto";
import { getDb } from "../../config/db.js";
import { logger } from "../../observability/logger.js";
import { getRequestContext } from "../../observability/request-context.js";
import { observeAsyncSideEffectFailure } from "../../observability/metrics.js";

const COLLECTION = "tz_security_audit";

const MAX_DIFF_JSON = 16_000;

function truncateJson(value: unknown): unknown {
  try {
    const s = JSON.stringify(value);
    if (s.length <= MAX_DIFF_JSON) return JSON.parse(s) as unknown;
    return { _truncated: true, preview: s.slice(0, 2000) };
  } catch {
    return { _error: "unserializable" };
  }
}

export interface SecurityAuditRecordInput {
  action: string;
  userId?: string;
  entityType: string;
  entityId: string;
  workspaceId?: string;
  projectId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  correlationId?: string;
  diff?: { before?: unknown; after?: unknown };
  metadata?: Record<string, unknown>;
}

export async function recordSecurityEvent(input: SecurityAuditRecordInput): Promise<void> {
  try {
    const ctx = getRequestContext();
    const doc: Record<string, unknown> = {
      at: new Date(),
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ...(input.userId && { userId: input.userId }),
      ...(input.workspaceId && { workspaceId: input.workspaceId }),
      ...(input.projectId && { projectId: input.projectId }),
      ...(input.ip && { ip: input.ip }),
      ...(input.userAgent && { userAgent: input.userAgent }),
      requestId: input.requestId ?? ctx?.requestId,
      correlationId: input.correlationId ?? ctx?.correlationId,
      ...(input.metadata && Object.keys(input.metadata).length > 0 && { metadata: input.metadata }),
    };
    if (input.diff) {
      doc.diff = {
        ...(input.diff.before !== undefined && { before: truncateJson(input.diff.before) }),
        ...(input.diff.after !== undefined && { after: truncateJson(input.diff.after) })
      };
    }
    await getDb().collection(COLLECTION).insertOne(doc);
  } catch (err) {
    observeAsyncSideEffectFailure({ operation: "security_audit.record", entityType: input.entityType });
    logger.error({ err, action: input.action }, "[securityAudit] insert failed");
  }
}

/** Hash opaco della chiave S3 (nessun path completo in chiaro nei log lunghi). */
export function hashStorageKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex").slice(0, 32);
}

export interface SecurityAuditQueryInput {
  workspaceId?: string;
  userId?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
}

export async function querySecurityAudit(input: SecurityAuditQueryInput): Promise<{
  data: Record<string, unknown>[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}> {
  const db = getDb();
  const coll = db.collection(COLLECTION);
  const match: Record<string, unknown> = {};
  if (input.workspaceId) match.workspaceId = input.workspaceId;
  if (input.userId) match.userId = input.userId;
  if (input.action) match.action = input.action;
  if (input.entityType) match.entityType = input.entityType;
  if (input.dateFrom || input.dateTo) {
    match.at = {};
    if (input.dateFrom) (match.at as Record<string, unknown>).$gte = new Date(input.dateFrom);
    if (input.dateTo) (match.at as Record<string, unknown>).$lte = new Date(input.dateTo);
  }
  const page = Math.max(1, input.page ?? 1);
  const perPage = Math.min(100, Math.max(1, input.perPage ?? 25));
  const skip = (page - 1) * perPage;
  const [docs, total] = await Promise.all([
    coll.find(match).sort({ at: -1 }).skip(skip).limit(perPage).toArray(),
    coll.countDocuments(match)
  ]);
  return {
    data: docs.map((d) => {
      const { _id, ...rest } = d as Record<string, unknown> & { _id: unknown };
      return { ...rest, _id: String(_id) };
    }),
    pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) }
  };
}

/**
 * Export JSON Lines (un evento per riga) per conservazione esterna / SIEM.
 * Limita il numero di documenti per chiamata (default 5000).
 */
export async function exportSecurityAuditJsonl(params: {
  workspaceId?: string;
  dateFrom?: string;
  dateTo?: string;
  maxDocs?: number;
  /** Default `asc` (compat API); `desc` = eventi più recenti prima (es. snapshot job). */
  sortOrder?: "asc" | "desc";
}): Promise<string> {
  const match: Record<string, unknown> = {};
  if (params.workspaceId) match.workspaceId = params.workspaceId;
  if (params.dateFrom || params.dateTo) {
    match.at = {};
    if (params.dateFrom) (match.at as Record<string, unknown>).$gte = new Date(params.dateFrom);
    if (params.dateTo) (match.at as Record<string, unknown>).$lte = new Date(params.dateTo);
  }
  const max = Math.min(params.maxDocs ?? 5000, 50_000);
  const atSort = params.sortOrder === "desc" ? -1 : 1;
  const docs = await getDb()
    .collection(COLLECTION)
    .find(match)
    .sort({ at: atSort })
    .limit(max)
    .toArray();
  return docs.map((d) => JSON.stringify({ ...d, _id: String(d._id) })).join("\n");
}
