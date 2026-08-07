import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ObjectId } from 'mongodb';

import { getAllowedWriteDbName } from './constants.js';
import { startInMemoryMongo, stopInMemoryMongo } from './testing/index.js';
import {
  AssetsRepository,
  AuditEventsRepository,
  I18nGlobalBundlesRepository,
  I18nWorkspaceBundlesRepository,
  InviteTokensRepository,
  ProjectsRepository,
  RoleDefinitionsRepository,
  UsersRepository,
  WorkspaceMembersRepository,
  WorkspacesRepository,
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

    const paginated = await repo.findPaginated({ actorUserId: 'user-1' } as any, {
      skip: 0,
      limit: 1,
      sort: { createdAt: 1 },
    });
    expect(paginated.totalDocs).toBe(2);
    expect(paginated.data).toHaveLength(1);
    expect(paginated.data[0]?.eventType).toBe('test.old');
  });

  it('repository soft-delete tipizzati espongono findActive sulle collection di dominio', async () => {
    const db = mongoContext.client.db(getAllowedWriteDbName());
    const workspacesRepo = new WorkspacesRepository(db);
    const projectsRepo = new ProjectsRepository(db);
    const membersRepo = new WorkspaceMembersRepository(db);
    const inviteTokensRepo = new InviteTokensRepository(db);

    await workspacesRepo.create({ _id: 'ws-active', name: 'Workspace', status: 'active' } as any);
    await projectsRepo.create({
      _id: 'project-active',
      workspaceId: 'ws-active',
      name: 'Project',
      status: 'active',
    } as any);
    await membersRepo.create({
      _id: 'member-active',
      workspaceId: 'ws-active',
      userId: 'user-active',
      role: 'admin',
      status: 'active',
    } as any);
    await inviteTokensRepo.create({
      _id: 'invite-active',
      tokenHash: 'token-hash',
      email: 'invite@example.com',
      status: 'active',
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    } as any);

    expect(await workspacesRepo.findActive({ _id: 'ws-active' } as any)).toMatchObject({
      name: 'Workspace',
    });
    expect(await projectsRepo.findActive({ _id: 'project-active' } as any)).toMatchObject({
      name: 'Project',
    });
    expect(await membersRepo.findActive({ _id: 'member-active' } as any)).toMatchObject({
      role: 'admin',
    });
    expect(await inviteTokensRepo.findActive({ _id: 'invite-active' } as any)).toMatchObject({
      email: 'invite@example.com',
    });
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

  describe('AssetsRepository', () => {
    it('listForWorkspace ritorna asset non deleted ordinati per createdAt desc', async () => {
      const repo = new AssetsRepository(mongoContext.client.db(getAllowedWriteDbName()));
      await repo.create({
        _id: new ObjectId(),
        workspaceId: 'ws-assets',
        kind: 'workspace.logo',
        fileName: 'old.png',
        contentType: 'image/png',
        status: 'active',
        createdAt: '2026-05-01T08:00:00.000Z',
      } as any);
      await repo.create({
        _id: new ObjectId(),
        workspaceId: 'ws-assets',
        kind: 'workspace.email-header',
        fileName: 'header.png',
        contentType: 'image/png',
        status: 'deleted',
        createdAt: '2026-05-02T08:00:00.000Z',
        deletedAt: '2026-05-02T09:00:00.000Z',
      } as any);
      await repo.create({
        _id: new ObjectId(),
        workspaceId: 'ws-assets',
        kind: 'workspace.logo',
        fileName: 'new.png',
        contentType: 'image/png',
        status: 'active',
        createdAt: '2026-05-03T08:00:00.000Z',
      } as any);

      const list = await repo.listForWorkspace('ws-assets');
      expect(list.map((entry) => entry.fileName)).toEqual(['new.png', 'old.png']);
    });

    it('findForWorkspaceAsset trova asset ObjectId e string nello stesso workspace', async () => {
      const repo = new AssetsRepository(mongoContext.client.db(getAllowedWriteDbName()));
      const objectId = new ObjectId();
      await repo.create({
        _id: objectId,
        workspaceId: 'ws-find-assets',
        kind: 'generic',
        fileName: 'object.png',
        contentType: 'image/png',
        status: 'active',
        createdAt: new Date().toISOString(),
      } as any);
      await repo.create({
        _id: 'string-asset-id',
        workspaceId: 'ws-find-assets',
        kind: 'generic',
        fileName: 'string.png',
        contentType: 'image/png',
        status: 'active',
        createdAt: new Date().toISOString(),
      } as any);

      await expect(
        repo.findForWorkspaceAsset('ws-find-assets', objectId.toString()),
      ).resolves.toMatchObject({ fileName: 'object.png' });
      await expect(
        repo.findForWorkspaceAsset('ws-find-assets', 'string-asset-id'),
      ).resolves.toMatchObject({ fileName: 'string.png' });
      await expect(
        repo.findForWorkspaceAsset('other-workspace', objectId.toString()),
      ).resolves.toBeNull();
    });

    it('softDelete marca asset come deleted e ritorna true', async () => {
      const repo = new AssetsRepository(mongoContext.client.db(getAllowedWriteDbName()));
      const id = 'asset-soft-delete';
      await repo.create({
        _id: id,
        workspaceId: 'ws-soft',
        kind: 'generic',
        fileName: 'sample.bin',
        contentType: 'application/octet-stream',
        status: 'active',
        createdAt: new Date().toISOString(),
      } as any);

      const ok = await repo.softDelete('ws-soft', id);
      expect(ok).toBe(true);
      const list = await repo.listForWorkspace('ws-soft');
      expect(list).toHaveLength(0);
    });

    it('softDelete ritorna false se asset non trovato', async () => {
      const repo = new AssetsRepository(mongoContext.client.db(getAllowedWriteDbName()));
      const ok = await repo.softDelete('ws-missing', 'asset-not-exist');
      expect(ok).toBe(false);
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

  describe('i18n bundle repositories', () => {
    it('upsert/find/deleteNamespace gestisce bundle globali', async () => {
      const repo = new I18nGlobalBundlesRepository(mongoContext.client.db(getAllowedWriteDbName()));

      await repo.upsertNamespace('it', 'shell', { title: 'Ciao' }, 1);
      await repo.upsertNamespace('it', 'shell', { title: 'Ciao aggiornato' }, 2);

      const doc = await repo.findNamespace('it', 'shell');
      expect(doc).toMatchObject({
        locale: 'it',
        namespace: 'shell',
        version: 2,
        messages: { title: 'Ciao aggiornato' },
      });

      expect(await repo.deleteNamespace('it', 'shell')).toBe(1);
      expect(await repo.findNamespace('it', 'shell')).toBeNull();
    });

    it('upsert/find/deleteNamespace gestisce override workspace', async () => {
      const repo = new I18nWorkspaceBundlesRepository(
        mongoContext.client.db(getAllowedWriteDbName()),
      );

      await repo.upsertNamespace('ws-i18n', 'en', 'projects', { empty: 'No projects' }, 1);

      const doc = await repo.findNamespace('ws-i18n', 'en', 'projects');
      expect(doc).toMatchObject({
        workspaceId: 'ws-i18n',
        locale: 'en',
        namespace: 'projects',
        messages: { empty: 'No projects' },
      });

      expect(await repo.deleteNamespace('ws-i18n', 'en', 'projects')).toBe(1);
      expect(await repo.findNamespace('ws-i18n', 'en', 'projects')).toBeNull();
    });
  });
});
