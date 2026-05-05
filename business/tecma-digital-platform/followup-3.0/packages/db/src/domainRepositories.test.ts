import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ObjectId } from 'mongodb';

import { getAllowedWriteDbName } from './constants.js';
import { startInMemoryMongo, stopInMemoryMongo } from './testing/index.js';
import {
  AuditEventsRepository,
  RoleDefinitionsRepository,
  UsersRepository,
  WorkspaceUserProjectsRepository,
} from './domainRepositories.js';

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

  describe('WorkspaceUserProjectsRepository', () => {
    it('listForUser ritorna solo assignment non revoked', async () => {
      const repo = new WorkspaceUserProjectsRepository(
        mongoContext.client.db(getAllowedWriteDbName()),
      );
      await repo.create({
        _id: new ObjectId(),
        workspaceId: 'ws-1',
        userId: 'user-1',
        projectId: 'proj-1',
        status: 'active',
        createdAt: new Date().toISOString(),
      } as any);
      await repo.create({
        _id: new ObjectId(),
        workspaceId: 'ws-1',
        userId: 'user-1',
        projectId: 'proj-2',
        status: 'revoked',
        createdAt: new Date().toISOString(),
      } as any);

      const items = await repo.listForUser('ws-1', 'user-1');
      expect(items.map((i) => i.projectId)).toEqual(['proj-1']);
    });

    it('revoke aggiorna lo status su revoked', async () => {
      const repo = new WorkspaceUserProjectsRepository(
        mongoContext.client.db(getAllowedWriteDbName()),
      );
      await repo.create({
        _id: new ObjectId(),
        workspaceId: 'ws-2',
        userId: 'user-2',
        projectId: 'proj-3',
        status: 'active',
        createdAt: new Date().toISOString(),
      } as any);

      await repo.revoke('ws-2', 'user-2', 'proj-3');
      const after = await repo.listForUser('ws-2', 'user-2');
      expect(after).toHaveLength(0);
    });
  });

  describe('RoleDefinitionsRepository', () => {
    it('loadDefinitions normalizza chiave in lower-case e raccoglie permessi', async () => {
      const repo = new RoleDefinitionsRepository(mongoContext.client.db(getAllowedWriteDbName()));
      await repo.create({
        _id: new ObjectId(),
        roleKey: ' Admin ',
        permissions: ['users.read', 'projects.read'],
        label: 'Admin label',
      } as any);
      await repo.create({
        _id: new ObjectId(),
        roleKey: 'tecma_admin',
        permissions: ['*'],
      } as any);
      const map = await repo.loadDefinitions();
      expect(map.admin).toEqual(['users.read', 'projects.read']);
      expect(map.tecma_admin).toEqual(['*']);
    });

    it('loadDefinitions ignora documenti con roleKey vuoto', async () => {
      const repo = new RoleDefinitionsRepository(mongoContext.client.db(getAllowedWriteDbName()));
      await repo.create({
        _id: new ObjectId(),
        roleKey: '',
        permissions: ['users.read'],
      } as any);
      const map = await repo.loadDefinitions();
      expect(map['']).toBeUndefined();
    });
  });
});
