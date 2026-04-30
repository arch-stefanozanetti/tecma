/**
 * Helper per registrare audit e dispatch evento in una sola chiamata.
 * Riduce duplicazione nelle route (clients, apartments, ecc.).
 */
import { record as auditRecord } from "../../core/audit/audit-log.service.js";
import { dispatchEvent } from "../../core/automations/automation-events.service.js";
import { safeAsync } from "../../core/shared/safeAsync.js";
import type { AuditActor } from "../../core/audit/audit-log.service.js";

export interface AuditAndDispatchOptions {
  action: string;
  workspaceId: string;
  projectId?: string;
  entityType: string;
  entityId: string;
  actor: AuditActor;
  payload?: Record<string, unknown>;
  userId?: string;
}

const defaultContext = (opts: AuditAndDispatchOptions) => ({
  operation: `audit.${opts.action}`,
  workspaceId: opts.workspaceId,
  projectId: opts.projectId,
  entityType: opts.entityType,
  entityId: opts.entityId,
  userId: opts.userId,
});

/**
 * Registra l'evento in audit log e lo invia al bus eventi (automazioni/webhook).
 * Entrambe le operazioni sono fire-and-forget (safeAsync); non blocca il flusso.
 */
export function auditAndDispatchEntityEvent(options: AuditAndDispatchOptions): void {
  const ctx = defaultContext(options);
  safeAsync(
    auditRecord({
      action: options.action,
      workspaceId: options.workspaceId,
      projectId: options.projectId,
      entityType: options.entityType,
      entityId: options.entityId,
      actor: options.actor,
      payload: options.payload,
    }),
    { ...ctx, operation: `audit.${options.action}` }
  );
  safeAsync(
    dispatchEvent(options.workspaceId, options.action, {
      workspaceId: options.workspaceId,
      projectId: options.projectId,
      entityType: options.entityType,
      entityId: options.entityId,
      ...options.payload,
    }),
    { ...ctx, operation: `event.${options.action}` }
  );
}
