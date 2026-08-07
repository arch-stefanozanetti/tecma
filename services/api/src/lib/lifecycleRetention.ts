import crypto from 'node:crypto';

import type { FastifyInstance } from 'fastify';

export const SOFT_DELETE_RETENTION_DAYS = 90;

export type LifecycleEntityType = 'workspace' | 'project' | 'user' | 'workspace_membership';

export type DeletionNoticeRecipient = {
  kind: 'tecma' | 'user' | 'workspace_admin';
  userId?: string;
  email?: string;
};

export function buildPurgeEligibleAt(deletedAtIso: string): string {
  const date = new Date(deletedAtIso);
  date.setUTCDate(date.getUTCDate() + SOFT_DELETE_RETENTION_DAYS);
  return date.toISOString();
}

export function buildSoftDeleteFields(args: {
  actorId: string;
  now: string;
  reason: string;
}): Record<string, unknown> {
  return {
    status: 'deleted',
    deletedAt: args.now,
    deletedBy: args.actorId,
    deletedReason: args.reason,
    deleteReason: args.reason,
    purgeEligibleAt: buildPurgeEligibleAt(args.now),
    updatedAt: args.now,
  };
}

export async function enqueueLifecycleNotice(
  app: FastifyInstance,
  args: {
    entityType: LifecycleEntityType;
    entityId: string;
    eventType: string;
    actorId: string;
    reason: string;
    purgeEligibleAt?: string;
    recipients?: DeletionNoticeRecipient[];
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const now = new Date().toISOString();
  await app.mongoDb.collection<Record<string, unknown>>('tz_lifecycle_notices').insertOne({
    noticeId: crypto.randomUUID(),
    entityType: args.entityType,
    entityId: args.entityId,
    eventType: args.eventType,
    actorId: args.actorId,
    reason: args.reason,
    purgeEligibleAt: args.purgeEligibleAt ?? null,
    recipients: args.recipients ?? [{ kind: 'tecma' }],
    metadata: args.metadata ?? {},
    status: process.env.TECMA_DELETION_NOTICE_EMAIL ? 'pending' : 'pending_config',
    createdAt: now,
    updatedAt: now,
  });
}
