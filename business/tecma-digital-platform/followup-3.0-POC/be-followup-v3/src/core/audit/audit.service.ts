/**
 * Audit unificato: scrive su tz_audit_log tramite audit-log.service.
 * workspace_id obbligatorio (multi-tenant). UPDATE e DELETE vanno sempre loggati.
 */
import { record } from "./audit-log.service.js";

export interface AuditLogDoc {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: { before?: unknown; after?: unknown } | null;
  projectId?: string | null;
  workspaceId: string;
}

export async function writeAuditLog(params: {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  changes?: { before?: unknown; after?: unknown } | null;
  projectId?: string | null;
  workspaceId?: string;
}): Promise<void> {
  const workspaceId = (params.workspaceId || "").trim();
  if (!workspaceId) {
    return;
  }
  await record({
    action: params.action,
    workspaceId,
    projectId: params.projectId ?? undefined,
    entityType: params.entityType,
    entityId: params.entityId,
    actor: { type: "user", userId: params.userId },
    payload: params.changes && (params.changes.before !== undefined || params.changes.after !== undefined)
      ? { before: params.changes.before, after: params.changes.after }
      : undefined,
  });
}
