import crypto from 'node:crypto';

import { AuditEventsRepository } from '@followup/db';
import type { AuditEvent } from '@followup/shared-types';

import type { FastifyInstance } from 'fastify';

type AuditEventInput = {
  eventType: string;
  actorUserId?: string;
  userId?: string;
  workspaceId?: string;
  projectId?: string;
  targetUserId?: string;
  severity?: AuditEvent['severity'];
  outcome?: AuditEvent['outcome'];
  ip?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  traceId?: string;
};

export type AuditEventFilters = {
  workspaceId?: string;
  userId?: string;
  eventType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export class AuditService {
  private authEventsRepo: AuditEventsRepository;

  constructor(app: FastifyInstance) {
    this.authEventsRepo = new AuditEventsRepository(app.mongoDb);
  }

  async authEvent(input: AuditEventInput): Promise<void> {
    const actorUserId = input.actorUserId ?? input.userId ?? 'system';
    const details = {
      ...(input.details ?? {}),
      ...(input.userId != null && input.actorUserId == null ? { legacyUserId: input.userId } : {}),
    };

    await this.authEventsRepo.create({
      _id: crypto.randomUUID(),
      eventType: input.eventType,
      actorUserId,
      userId: input.userId ?? actorUserId,
      ...(input.workspaceId != null ? { workspaceId: input.workspaceId } : {}),
      ...(input.projectId != null ? { projectId: input.projectId } : {}),
      ...(input.targetUserId != null ? { targetUserId: input.targetUserId } : {}),
      severity: input.severity ?? 'info',
      ...(input.outcome != null ? { outcome: input.outcome } : {}),
      ...(input.ip != null ? { ip: input.ip } : {}),
      ...(input.userAgent != null ? { userAgent: input.userAgent } : {}),
      ...(Object.keys(details).length > 0 ? { details } : {}),
      ...(input.traceId != null ? { traceId: input.traceId } : {}),
      createdAt: new Date().toISOString(),
    });
  }

  async listAuthEvents(filters: AuditEventFilters = {}): Promise<AuditEvent[]> {
    const query: Record<string, unknown> = {};
    if (filters.workspaceId != null) query.workspaceId = filters.workspaceId;
    if (filters.eventType != null) query.eventType = filters.eventType;
    if (filters.userId != null) {
      query.$or = [
        { actorUserId: filters.userId },
        { userId: filters.userId },
        { targetUserId: filters.userId },
        { 'details.targetUserId': filters.userId },
      ];
    }
    if (filters.dateFrom != null || filters.dateTo != null) {
      query.createdAt = {
        ...(filters.dateFrom != null ? { $gte: filters.dateFrom } : {}),
        ...(filters.dateTo != null ? { $lte: filters.dateTo } : {}),
      };
    }

    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
    return this.authEventsRepo.findLatest(query as any, limit);
  }
}
