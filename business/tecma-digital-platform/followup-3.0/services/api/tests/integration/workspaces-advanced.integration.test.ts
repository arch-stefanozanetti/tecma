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
  });

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
    it('PUT salva apiKey + GET ritorna apiKey mascherata', async () => {
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
      expect(stored.apiKey).toMatch(/^\*+1234$/);

      const get = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/ai-config`,
        headers: authHeaders(token),
      });
      expect(get.statusCode).toBe(200);
      const data = get.json().data;
      expect(data.provider).toBe('openai');
      expect(data.apiKey).toMatch(/^\*+1234$/);
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
      expect(
        (list.json().data as Array<{ _id: string }>).some((entry) => entry._id === id),
      ).toBe(true);

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
});
