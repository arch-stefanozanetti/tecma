import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ObjectId } from 'mongodb';

import { getAllowedWriteDbName } from './constants.js';
import { startInMemoryMongo, stopInMemoryMongo } from './testing/index.js';
import { AuditEventsRepository, UsersRepository } from './domainRepositories.js';

let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;

describe('domain repositories', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
  });

  afterAll(async () => {
    await stopInMemoryMongo(mongoContext);
  });

  it('SoftDeleteRepository findActive/deactivate/reactivate/softDelete applica lifecycle canonico', async () => {
    const repo = new UsersRepository(mongoContext.client.db(getAllowedWriteDbName()));
    const userId = new ObjectId();
    await repo.create({
      _id: userId,
      email: 'soft-delete@example.com',
      status: 'active',
    } as any);

    expect(await repo.findActive({ _id: userId } as any)).not.toBeNull();

    await repo.deactivate({ _id: userId } as any);
    expect(await repo.findActive({ _id: userId } as any)).toBeNull();

    await repo.reactivate({ _id: userId } as any);
    expect(await repo.findActive({ _id: userId } as any)).toMatchObject({ status: 'active' });

    await repo.softDelete({ _id: userId } as any);
    expect(await repo.findActive({ _id: userId } as any)).toBeNull();
  });

  it('AuditEventsRepository findLatest ordina gli eventi più recenti', async () => {
    const repo = new AuditEventsRepository(mongoContext.client.db(getAllowedWriteDbName()));
    await repo.create({
      _id: 'audit-old',
      eventType: 'test.old',
      actorUserId: 'user-1',
      severity: 'info',
      createdAt: '2026-05-04T10:00:00.000Z',
    });
    await repo.create({
      _id: 'audit-new',
      eventType: 'test.new',
      actorUserId: 'user-1',
      severity: 'info',
      createdAt: '2026-05-04T11:00:00.000Z',
    });

    const events = await repo.findLatest({ actorUserId: 'user-1' } as any, 1);
    expect(events).toHaveLength(1);
    expect(events[0]?.eventType).toBe('test.new');
  });
});
