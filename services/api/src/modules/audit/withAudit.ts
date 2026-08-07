import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AuditEvent } from '@followup/shared-types';

type AuditMeta = {
  actorUserId?: string;
  workspaceId?: string;
  projectId?: string;
  targetUserId?: string;
  severity?: AuditEvent['severity'];
  outcome?: AuditEvent['outcome'];
  details?: Record<string, unknown>;
};

type AuditExtractor = (
  request: FastifyRequest,
  reply: FastifyReply,
) => AuditMeta | Promise<AuditMeta>;

const AUDIT_META_KEY = '__followupAuditMeta';

/**
 * preHandler che cattura il contesto dell'audit (actor/target/workspace/project/...).
 * L'audit event viene poi emesso da `onResponse` con outcome calcolato dallo statusCode
 * effettivo della risposta. Questo permette di registrare correttamente sia i success
 * sia i failure (4xx/5xx).
 */
export const withAudit =
  (eventType: string, extractor: AuditExtractor) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const meta = await extractor(request, reply);
    const user = request.user as { sub?: string } | undefined;

    // Salva il contesto sulla request — l'hook `onResponse` lo userà.
    (request as unknown as Record<string, unknown>)[AUDIT_META_KEY] = {
      eventType,
      actorUserId: meta.actorUserId ?? user?.sub ?? 'system',
      workspaceId: meta.workspaceId,
      projectId: meta.projectId,
      targetUserId: meta.targetUserId,
      severity: meta.severity,
      explicitOutcome: meta.outcome,
      details: meta.details,
    };
  };

/**
 * Hook globale `onResponse`: emette l'audit event preparato da `withAudit`
 * con outcome derivato dallo statusCode (success se < 400, failure altrimenti).
 * Severity viene auto-bumpata a 'error' su 5xx se non specificata.
 */
export const installAuditResponseHook = (app: FastifyInstance): void => {
  app.addHook('onResponse', async (request, reply) => {
    const ctx = (request as unknown as Record<string, unknown>)[AUDIT_META_KEY] as
      | {
          eventType: string;
          actorUserId: string;
          workspaceId?: string;
          projectId?: string;
          targetUserId?: string;
          severity?: AuditEvent['severity'];
          explicitOutcome?: AuditEvent['outcome'];
          details?: Record<string, unknown>;
        }
      | undefined;
    if (ctx == null) return;

    const status = reply.statusCode;
    const outcome: AuditEvent['outcome'] =
      ctx.explicitOutcome ?? (status >= 200 && status < 400 ? 'success' : 'failure');

    const severity: AuditEvent['severity'] =
      ctx.severity ?? (status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info');

    await request.server.auditService.authEvent({
      eventType: ctx.eventType,
      actorUserId: ctx.actorUserId,
      workspaceId: ctx.workspaceId,
      projectId: ctx.projectId,
      targetUserId: ctx.targetUserId,
      severity,
      outcome,
      ip: request.ip,
      userAgent:
        typeof request.headers['user-agent'] === 'string'
          ? request.headers['user-agent']
          : undefined,
      traceId:
        typeof request.headers['x-request-id'] === 'string'
          ? request.headers['x-request-id']
          : undefined,
      details: { ...(ctx.details ?? {}), httpStatus: status },
    });
  });
};
