import crypto from 'node:crypto';

import { MongoRepository } from '@followup/db';

import type { FastifyInstance } from 'fastify';

interface AuthAuditEvent {
  _id: string;
  eventType: string;
  userId: string;
  details?: Record<string, unknown>;
  traceId?: string;
  createdAt: string;
}

export class AuditService {
  private authEventsRepo: MongoRepository<AuthAuditEvent>;

  constructor(app: FastifyInstance) {
    this.authEventsRepo = new MongoRepository<AuthAuditEvent>(
      app.mongoDb.collection('tz_authEvents'),
    );
  }

  async authEvent(input: {
    eventType: string;
    userId: string;
    details?: Record<string, unknown>;
    traceId?: string;
  }): Promise<void> {
    await this.authEventsRepo.create({
      _id: crypto.randomUUID(),
      eventType: input.eventType,
      userId: input.userId,
      ...(input.details != null ? { details: input.details } : {}),
      ...(input.traceId != null ? { traceId: input.traceId } : {}),
      createdAt: new Date().toISOString(),
    });
  }
}
