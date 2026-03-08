/**
 * Audit log CRM: traccia CRUD su clienti, appartamenti, richieste, associazioni, calendario.
 * Collection tz_audit_log (main DB). Non blocca il flusso principale se l'audit fallisce.
 */
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_audit_log";

export interface AuditActor {
  type: "user" | "system";
  userId?: string;
  email?: string;
}

export interface AuditRecordInput {
  action: string;
  workspaceId: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  actor: AuditActor;
  payload?: Record<string, unknown>;
  ip?: string;
}

export interface AuditRecordRow {
  _id: string;
  at: string;
  action: string;
  workspaceId: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  actor: AuditActor;
  payload?: Record<string, unknown>;
  ip?: string;
}

/**
 * Registra un evento in tz_audit_log. Non lancia eccezioni.
 */
export const record = async (input: AuditRecordInput): Promise<void> => {
  try {
    const db = getDb();
    const doc = {
      at: new Date(),
      action: input.action,
      workspaceId: input.workspaceId,
      ...(input.projectId && { projectId: input.projectId }),
      entityType: input.entityType,
      entityId: input.entityId,
      actor: input.actor,
      ...(input.payload && Object.keys(input.payload).length > 0 && { payload: input.payload }),
      ...(input.ip && { ip: input.ip }),
    };
    await db.collection(COLLECTION).insertOne(doc);
  } catch (err) {
    console.error("[auditLog] Failed to record:", input.action, input.entityType, input.entityId, err);
  }
};

export interface AuditQueryInput {
  workspaceId: string;
  projectId?: string;
  entityType?: string;
  entityId?: string;
  actorUserId?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  perPage?: number;
}

export interface AuditQueryResult {
  data: AuditRecordRow[];
  pagination: { page: number; perPage: number; total: number; totalPages: number };
}

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

export const queryAuditLog = async (input: AuditQueryInput): Promise<AuditQueryResult> => {
  const db = getDb();
  const coll = db.collection(COLLECTION);

  const match: Record<string, unknown> = { workspaceId: input.workspaceId };
  if (input.projectId) match.projectId = input.projectId;
  if (input.entityType) match.entityType = input.entityType;
  if (input.entityId) match.entityId = input.entityId;
  if (input.action) match.action = input.action;
  if (input.actorUserId) match["actor.userId"] = input.actorUserId;

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
    coll.countDocuments(match),
  ]);

  const data: AuditRecordRow[] = docs.map((d: Record<string, unknown>) => ({
    _id: String(d._id ?? ""),
    at: toIsoDate(d.at),
    action: String(d.action ?? ""),
    workspaceId: String(d.workspaceId ?? ""),
    projectId: typeof d.projectId === "string" ? d.projectId : undefined,
    entityType: String(d.entityType ?? ""),
    entityId: String(d.entityId ?? ""),
    actor: (d.actor as AuditActor) ?? { type: "system" },
    payload: typeof d.payload === "object" && d.payload !== null ? (d.payload as Record<string, unknown>) : undefined,
    ip: typeof d.ip === "string" ? d.ip : undefined,
  }));

  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
};
