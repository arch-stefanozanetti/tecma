import type { FastifyReply, FastifyRequest } from 'fastify';

import type { AuditEvent } from '@followup/shared-types';

type AuditExtractor = (
  request: FastifyRequest,
  reply: FastifyReply,
) =>
  | {
      actorUserId?: string;
      workspaceId?: string;
      projectId?: string;
      targetUserId?: string;
      severity?: AuditEvent['severity'];
      outcome?: AuditEvent['outcome'];
      details?: Record<string, unknown>;
    }
  | Promise<{
      actorUserId?: string;
      workspaceId?: string;
      projectId?: string;
      targetUserId?: string;
      severity?: AuditEvent['severity'];
      outcome?: AuditEvent['outcome'];
      details?: Record<string, unknown>;
    }>;

export const withAudit =
  (eventType: string, extractor: AuditExtractor) =>
  async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const audit = await extractor(request, reply);
    const user = request.user as { sub?: string } | undefined;
    await request.server.auditService.authEvent({
      eventType,
      actorUserId: audit.actorUserId ?? user?.sub ?? 'system',
      workspaceId: audit.workspaceId,
      projectId: audit.projectId,
      targetUserId: audit.targetUserId,
      severity: audit.severity,
      outcome: audit.outcome ?? 'success',
      ip: request.ip,
      userAgent:
        typeof request.headers['user-agent'] === 'string'
          ? request.headers['user-agent']
          : undefined,
      traceId:
        typeof request.headers['x-request-id'] === 'string'
          ? request.headers['x-request-id']
          : undefined,
      details: audit.details,
    });
  };
