import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

const API_KEY = '1234567890123456';

const authHeaders = (accessToken: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${accessToken}`,
  'content-type': 'application/json',
});

const authHeadersNoBody = (accessToken: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${accessToken}`,
});

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let adminId: ObjectId;
let collaboratorId: ObjectId;
let outsiderId: ObjectId;
const workspaceId = 'ws-adv-int';

describe('Workspaces advanced integration (entitlements, ai-config, branding, additional-infos)', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;

    app = await buildServer();
    const users = app.mongoDb.collection('tz_users');
    const workspaces = app.mongoDb.collection('tz_workspaces');
    const memberships = app.mongoDb.collection('tz_user_workspaces');
    const now = new Date().toISOString();
    const hash = await bcrypt.hash('Password123!', 10);

    adminId = new ObjectId();
    collaboratorId = new ObjectId();
    outsiderId = new ObjectId();

    await users.insertMany([
      {
        _id: adminId,
        email: 'adv-admin@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'tecma_admin',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: collaboratorId,
        email: 'adv-collab@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: outsiderId,
        email: 'adv-outsider@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await workspaces.insertOne({
      _id: workspaceId,
      name: 'Advanced WS',
      createdAt: now,
      updatedAt: now,
    } as any);
    await memberships.insertMany([
      {
        _id: 'm-adv-admin',
        workspaceId,
        userId: adminId.toString(),
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'm-adv-collab',
        workspaceId,
        userId: collaboratorId.toString(),
        role: 'collaborator',
        createdAt: now,
        updatedAt: now,
      },
    ] as any);
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 120_000);

  const loginAs = async (email: string): Promise<string> => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    expect(res.statusCode).toBe(200);
    return res.json().data.accessToken as string;
  };

  describe('Entitlements', () => {
    it('GET ritorna 5 feature builtin (default disabled)', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/entitlements`,
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data as Array<{ feature: string; status: string }>;
      const features = data.map((row) => row.feature).sort();
      expect(features).toEqual(
        ['ai', 'analytics', 'connectors-marketing', 'email-templates', 'pdf-templates'].sort(),
      );
      for (const row of data) expect(row.status).toBe('disabled');
    });

    it('PATCH abilita una feature e GET la riflette', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/workspaces/${workspaceId}/entitlements/ai`,
        headers: authHeaders(token),
        payload: { status: 'enabled', metadata: { plan: 'pro' } },
      });
      expect(res.statusCode).toBe(200);
      const list = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/entitlements`,
        headers: authHeaders(token),
      });
      const ai = (list.json().data as any[]).find((r) => r.feature === 'ai');
      expect(ai.status).toBe('enabled');
      expect(ai.metadata).toMatchObject({ plan: 'pro' });
    });

    it('PATCH 400 per feature sconosciuta', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/workspaces/${workspaceId}/entitlements/unknown-feature`,
        headers: authHeaders(token),
        payload: { status: 'enabled' },
      });
      expect([400, 500]).toContain(res.statusCode);
    });

    it('PATCH 403 per non-admin/owner', async () => {
      const token = await loginAs('adv-collab@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/workspaces/${workspaceId}/entitlements/ai`,
        headers: authHeaders(token),
        payload: { status: 'disabled' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('AI config', () => {
    it('PUT salva apiKey cifrata + GET ritorna apiKey mascherata', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const put = await app.inject({
        method: 'PUT',
        url: `/v1/workspaces/${workspaceId}/ai-config`,
        headers: authHeaders(token),
        payload: {
          provider: 'openai',
          apiKey: 'sk-supersecretkey-xyz1234',
          model: 'gpt-4o',
          temperature: 0.4,
          enabled: true,
        },
      });
      expect(put.statusCode).toBe(200);
      const stored = put.json().data;
      expect(stored.apiKey).toMatch(/^\*+$/);

      const get = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/ai-config`,
        headers: authHeaders(token),
      });
      expect(get.statusCode).toBe(200);
      const data = get.json().data;
      expect(data.provider).toBe('openai');
      expect(data.apiKey).toMatch(/^\*+$/);
      expect(data.apiKey).not.toContain('supersecretkey');
    });

    it('PUT 400 con provider sconosciuto', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'PUT',
        url: `/v1/workspaces/${workspaceId}/ai-config`,
        headers: authHeaders(token),
        payload: { provider: 'gemini-pro-max' },
      });
      expect([400, 500]).toContain(res.statusCode);
    });
  });

  describe('Additional infos CRUD', () => {
    it('flusso completo create/list/patch/delete', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const created = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${workspaceId}/additional-infos`,
        headers: authHeaders(token),
        payload: { label: 'Codice ATECO', value: '62.01.00', sortOrder: 1 },
      });
      expect(created.statusCode).toBe(201);
      const id = created.json().data._id as string;

      const list = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/additional-infos`,
        headers: authHeaders(token),
      });
      expect(list.statusCode).toBe(200);
      expect((list.json().data as Array<{ _id: string }>).some((entry) => entry._id === id)).toBe(
        true,
      );

      const patch = await app.inject({
        method: 'PATCH',
        url: `/v1/workspaces/${workspaceId}/additional-infos/${id}`,
        headers: authHeaders(token),
        payload: { value: 'updated' },
      });
      expect(patch.statusCode).toBe(200);
      expect(patch.json().data.value).toBe('updated');

      const del = await app.inject({
        method: 'DELETE',
        url: `/v1/workspaces/${workspaceId}/additional-infos/${id}`,
        headers: authHeadersNoBody(token),
      });
      expect(del.statusCode).toBe(200);
      const softDeleted = await app.mongoDb
        .collection('tz_additional_infos')
        .findOne({ _id: id, workspaceId });
      expect(softDeleted).toMatchObject({ status: 'deleted' });

      const listAfterDelete = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/additional-infos`,
        headers: authHeaders(token),
      });
      expect(
        (listAfterDelete.json().data as Array<{ _id: string }>).some((entry) => entry._id === id),
      ).toBe(false);
    });

    it('PATCH 404 su id inesistente', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/workspaces/${workspaceId}/additional-infos/missing-id`,
        headers: authHeaders(token),
        payload: { value: 'x' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('POST 400 con label oltre maxLength', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${workspaceId}/additional-infos`,
        headers: authHeaders(token),
        payload: { label: 'x'.repeat(121) },
      });
      expect(res.statusCode).toBe(400);
    });

    it('DELETE 404 su id inesistente senza leak', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/workspaces/${workspaceId}/additional-infos/not-found-id`,
        headers: authHeadersNoBody(token),
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error?.code).toBe('AdditionalInfoNotFound');
    });
  });

  describe('Branding', () => {
    it('PATCH applica logoUrl + primaryColor + GET ritorna i valori', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const put = await app.inject({
        method: 'PATCH',
        url: `/v1/workspaces/${workspaceId}/branding`,
        headers: authHeaders(token),
        payload: {
          logoUrl: 'https://cdn.tecma.test/logo.png',
          primaryColor: '#1A2B3C',
          footerText: 'Powered by Tecma',
        },
      });
      expect(put.statusCode).toBe(200);
      expect(put.json().data.primaryColor).toBe('#1A2B3C');

      const get = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/branding`,
        headers: authHeaders(token),
      });
      expect(get.statusCode).toBe(200);
      expect(get.json().data.logoUrl).toBe('https://cdn.tecma.test/logo.png');
    });

    it('PATCH 400 con primaryColor invalido', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/workspaces/${workspaceId}/branding`,
        headers: authHeaders(token),
        payload: { primaryColor: 'red' },
      });
      expect([400, 500]).toContain(res.statusCode);
    });

    it('PATCH 403 per outsider', async () => {
      const token = await loginAs('adv-outsider@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/workspaces/${workspaceId}/branding`,
        headers: authHeaders(token),
        payload: { primaryColor: '#000000' },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Member advanced PATCH', () => {
    it('PATCH applica accessScope=assigned + calendarDisplayColor', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/workspaces/${workspaceId}/members/${collaboratorId.toString()}`,
        headers: authHeaders(token),
        payload: {
          accessScope: 'assigned',
          calendarDisplayColor: '#ABCDEF',
        },
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.accessScope).toBe('assigned');
      expect(data.calendarDisplayColor).toBe('#ABCDEF');
    });

    it('PATCH 400 con calendarDisplayColor invalido', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/workspaces/${workspaceId}/members/${collaboratorId.toString()}`,
        headers: authHeaders(token),
        payload: { calendarDisplayColor: 'rgb(0,0,0)' },
      });
      expect([400, 500]).toContain(res.statusCode);
    });
  });

  describe('Entity assignments (POC parity v1)', () => {
    it('create/list/delete assignment for entity and list by user', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const encodedEntityId = encodeURIComponent('client:legacy-id/001');
      const create = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${workspaceId}/entities/client/${encodedEntityId}/assignments`,
        headers: authHeaders(token),
        payload: { userId: collaboratorId.toString() },
      });
      expect(create.statusCode).toBe(201);
      expect(create.json().data.userId).toBe(collaboratorId.toString());

      const listEntity = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/entities/client/${encodedEntityId}/assignments`,
        headers: authHeaders(token),
      });
      expect(listEntity.statusCode).toBe(200);
      expect(listEntity.json().data).toHaveLength(1);

      const listUser = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/users/${collaboratorId.toString()}/assignments`,
        headers: authHeaders(token),
      });
      expect(listUser.statusCode).toBe(200);
      expect((listUser.json().data as Array<{ entityType: string }>)?.[0]?.entityType).toBe(
        'client',
      );

      const del = await app.inject({
        method: 'DELETE',
        url: `/v1/workspaces/${workspaceId}/entities/client/${encodedEntityId}/assignments/${collaboratorId.toString()}`,
        headers: authHeadersNoBody(token),
      });
      expect(del.statusCode).toBe(200);
    });

    it('returns 404 when assigning non-member user', async () => {
      const token = await loginAs('adv-admin@tecma.test');
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${workspaceId}/entities/client/client-x/assignments`,
        headers: authHeaders(token),
        payload: { userId: outsiderId.toString() },
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error?.code).toBe('WorkspaceMemberNotFound');
    });
  });

  describe('Workspace platform API keys (POC parity v1)', () => {
    it('create/list/rotate/revoke and usage summary', async () => {
      const token = await loginAs('adv-admin@tecma.test');

      const created = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${workspaceId}/platform-api-keys`,
        headers: authHeaders(token),
        payload: { label: 'CRM Sync', scopes: ['clients.read'], projectIds: ['proj-001'] },
      });
      expect(created.statusCode).toBe(201);
      const keyId = created.json().data.key._id as string;
      expect(created.json().data.apiKey).toBeUndefined();
      expect(created.json().data.apiKeyMasked).toMatch(/^\*+.{4}$/);

      const list = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/platform-api-keys`,
        headers: authHeaders(token),
      });
      expect(list.statusCode).toBe(200);
      expect((list.json().data as Array<{ _id: string }>).some((row) => row._id === keyId)).toBe(
        true,
      );
      expect(JSON.stringify(list.json())).not.toContain('tokenHash');

      const rotate = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${workspaceId}/platform-api-keys/${keyId}/rotate`,
        headers: authHeadersNoBody(token),
      });
      expect(rotate.statusCode).toBe(200);
      expect(rotate.json().data.apiKey).toBeUndefined();
      expect(rotate.json().data.apiKeyMasked).toMatch(/^\*+.{4}$/);
      expect(JSON.stringify(rotate.json())).not.toContain('tokenHash');

      await app.mongoDb.collection('tz_workspace_platform_api_key_usage').insertMany([
        { _id: 'u1', workspaceId, day: '2026-01-01', requests: 10, errors: 1 },
        { _id: 'u2', workspaceId, day: '2026-01-02', requests: 5, errors: 0 },
      ] as any[]);
      const usage = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/platform-api-keys/usage`,
        headers: authHeadersNoBody(token),
      });
      expect(usage.statusCode).toBe(200);
      expect(usage.json().data.totalRequests).toBe(15);
      expect(usage.json().data.totalErrors).toBe(1);

      const revoked = await app.inject({
        method: 'DELETE',
        url: `/v1/workspaces/${workspaceId}/platform-api-keys/${keyId}`,
        headers: authHeadersNoBody(token),
      });
      expect(revoked.statusCode).toBe(200);
      expect(revoked.json().data.deleted).toBe(true);
    });

    it('verify endpoint accepts platform key without JWT and rejects invalid key', async () => {
      const apiKey = 'wk_verify_workspace_token_for_test_only_1234567890';
      const apiKeyDoc = {
        _id: 'verify-key-id',
        workspaceId,
        label: 'Verify key',
        projectIds: [],
        scopes: ['clients.read'],
        tokenHash: crypto.createHash('sha256').update(apiKey).digest('hex'),
        tokenPreview: 'wk_***7890',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'test',
      };
      await app.mongoDb.collection('tz_workspace_platform_api_keys').insertOne(apiKeyDoc as any);

      const ok = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/platform-api-keys/verify`,
        headers: {
          'x-api-key': API_KEY,
          'x-workspace-platform-key': apiKey,
        },
      });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().data.workspaceId).toBe(workspaceId);
      expect(ok.json().data.scopes).toContain('clients.read');

      const badWs = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/other-ws/platform-api-keys/verify`,
        headers: {
          'x-api-key': API_KEY,
          'x-workspace-platform-key': apiKey,
        },
      });
      expect(badWs.statusCode).toBe(401);

      const badToken = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/platform-api-keys/verify`,
        headers: {
          'x-api-key': API_KEY,
          'x-workspace-platform-key': 'wk_invalidxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
        },
      });
      expect(badToken.statusCode).toBe(401);
    });
  });

  describe('Cross-workspace isolation', () => {
    it('outsider 403 su entitlements/ai-config/additional-infos/branding', async () => {
      const token = await loginAs('adv-outsider@tecma.test');
      const paths = [
        `/v1/workspaces/${workspaceId}/entitlements`,
        `/v1/workspaces/${workspaceId}/ai-config`,
        `/v1/workspaces/${workspaceId}/additional-infos`,
        `/v1/workspaces/${workspaceId}/branding`,
      ];
      for (const url of paths) {
        const res = await app.inject({ method: 'GET', url, headers: authHeaders(token) });
        expect([403, 404]).toContain(res.statusCode);
      }
    });
  });

  describe('workspace lifecycle: archive / restore / transfer-ownership', () => {
    const archiveWsId = 'ws-lifecycle-int';
    let ownerToken: string;
    let collaboratorToken: string;

    beforeAll(async () => {
      const now = new Date().toISOString();
      await app.mongoDb.collection('tz_workspaces').insertOne({
        _id: archiveWsId,
        name: 'Lifecycle Workspace',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      } as any);
      // owner = adv-admin (tecma_admin — bypass), collaborator = adv-collab (role owner in ws)
      await app.mongoDb.collection('tz_user_workspaces').insertMany([
        {
          _id: 'lf-member-owner',
          workspaceId: archiveWsId,
          userId: adminId.toString(),
          role: 'owner',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
        {
          _id: 'lf-member-collab',
          workspaceId: archiveWsId,
          userId: collaboratorId.toString(),
          role: 'owner',
          status: 'active',
          createdAt: now,
          updatedAt: now,
        },
      ] as any[]);
      ownerToken = await loginAs('adv-admin@tecma.test');
      collaboratorToken = await loginAs('adv-collab@tecma.test');
    });

    it('POST /archive archivia il workspace', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${archiveWsId}/archive`,
        headers: authHeadersNoBody(ownerToken),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data?.archived).toBe(true);

      const ws = await app.mongoDb.collection('tz_workspaces').findOne({ _id: archiveWsId });
      expect((ws as { status?: string })?.status).toBe('archived');

      const audit = await app.mongoDb.collection('tz_authEvents').findOne({
        eventType: 'workspaces.archive',
        'details.workspaceId': archiveWsId,
      });
      expect(audit).not.toBeNull();
    });

    it('POST /archive restituisce 409 se gia archiviato', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${archiveWsId}/archive`,
        headers: authHeadersNoBody(ownerToken),
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error?.code).toBe('AlreadyArchived');
    });

    it('POST /restore ripristina il workspace archiviato', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${archiveWsId}/restore`,
        headers: authHeadersNoBody(ownerToken),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data?.restored).toBe(true);

      const ws = await app.mongoDb.collection('tz_workspaces').findOne({ _id: archiveWsId });
      expect((ws as { status?: string })?.status).toBe('active');

      const audit = await app.mongoDb.collection('tz_authEvents').findOne({
        eventType: 'workspaces.restore',
        'details.workspaceId': archiveWsId,
      });
      expect(audit).not.toBeNull();
    });

    it('POST /restore restituisce 409 se non archiviato', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${archiveWsId}/restore`,
        headers: authHeadersNoBody(ownerToken),
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error?.code).toBe('NotArchived');
    });

    it('POST /transfer-ownership restituisce 409 se il target non e admin/owner', async () => {
      await app.mongoDb
        .collection('tz_user_workspaces')
        .updateOne(
          { workspaceId: archiveWsId, userId: collaboratorId.toString() },
          { $set: { role: 'collaborator' } },
        );

      const res = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${archiveWsId}/transfer-ownership`,
        headers: authHeaders(ownerToken),
        payload: { newOwnerId: collaboratorId.toString() },
      });

      expect(res.statusCode).toBe(409);
      expect(res.json().error?.code).toBe('InvalidNewOwnerRole');

      await app.mongoDb
        .collection('tz_user_workspaces')
        .updateOne(
          { workspaceId: archiveWsId, userId: collaboratorId.toString() },
          { $set: { role: 'admin' } },
        );
    });

    it('POST /transfer-ownership ignora target non attivi', async () => {
      await app.mongoDb
        .collection('tz_user_workspaces')
        .updateOne(
          { workspaceId: archiveWsId, userId: collaboratorId.toString() },
          { $set: { role: 'admin', status: 'deactivated' } },
        );

      const res = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${archiveWsId}/transfer-ownership`,
        headers: authHeaders(ownerToken),
        payload: { newOwnerId: collaboratorId.toString() },
      });

      expect(res.statusCode).toBe(404);
      expect(res.json().error?.code).toBe('MemberNotFound');

      await app.mongoDb
        .collection('tz_user_workspaces')
        .updateOne(
          { workspaceId: archiveWsId, userId: collaboratorId.toString() },
          { $set: { role: 'admin', status: 'active' } },
        );
    });

    it('POST /transfer-ownership trasferisce la proprieta al nuovo owner', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${archiveWsId}/transfer-ownership`,
        headers: authHeaders(ownerToken),
        payload: { newOwnerId: collaboratorId.toString() },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data?.transferred).toBe(true);
      expect(res.json().data?.newOwnerId).toBe(collaboratorId.toString());

      // New owner membership must be owner.
      const newOwner = await app.mongoDb.collection('tz_user_workspaces').findOne({
        workspaceId: archiveWsId,
        userId: collaboratorId.toString(),
      });
      expect((newOwner as { role?: string })?.role).toBe('owner');

      // Previous owner demoted to admin.
      const prevOwner = await app.mongoDb.collection('tz_user_workspaces').findOne({
        workspaceId: archiveWsId,
        userId: adminId.toString(),
      });
      expect((prevOwner as { role?: string })?.role).toBe('admin');

      const audit = await app.mongoDb.collection('tz_authEvents').findOne({
        eventType: 'workspaces.transfer_ownership',
        'details.workspaceId': archiveWsId,
      });
      expect(audit).not.toBeNull();
    });

    it('POST /transfer-ownership restituisce 409 con stesso owner', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/v1/workspaces/${archiveWsId}/transfer-ownership`,
        headers: authHeaders(collaboratorToken),
        payload: { newOwnerId: collaboratorId.toString() },
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error?.code).toBe('SameOwner');
    });
  });
});
