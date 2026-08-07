import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let tecmaAdminToken = '';
let wsAdminToken = '';
let wsViewerToken = '';
const workspaceId = 'ws-i18n-cms';
const apiKey = '1234567890123456';

describe('i18n CMS write integration', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = apiKey;

    app = await buildServer();
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);

    await app.mongoDb.collection('tz_users').insertOne({
      _id: new ObjectId(),
      email: 'tecma-i18n-cms@tecma.test',
      passwordHash,
      status: 'active',
      system_role: 'tecma_admin',
      isTecmaAdmin: true,
      createdAt: now,
      updatedAt: now,
    } as any);

    const adminInsert = await app.mongoDb.collection('tz_users').insertOne({
      _id: new ObjectId(),
      email: 'ws-admin-i18n@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);
    const adminId = adminInsert.insertedId.toString();

    const viewerInsert = await app.mongoDb.collection('tz_users').insertOne({
      _id: new ObjectId(),
      email: 'ws-viewer-i18n@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);
    const viewerId = viewerInsert.insertedId.toString();

    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'I18n CMS Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    await app.mongoDb.collection('tz_user_workspaces').insertMany([
      {
        _id: crypto.randomUUID(),
        workspaceId,
        userId: adminId,
        role: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      } as any,
      {
        _id: crypto.randomUUID(),
        workspaceId,
        userId: viewerId,
        role: 'viewer',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      } as any,
    ]);

    const loginTecma = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'tecma-i18n-cms@tecma.test', password: 'Password123!' }),
    });
    expect(loginTecma.statusCode).toBe(200);
    tecmaAdminToken =
      (loginTecma.json() as { data?: { accessToken?: string } }).data?.accessToken ?? '';

    const loginAdmin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'ws-admin-i18n@tecma.test', password: 'Password123!' }),
    });
    expect(loginAdmin.statusCode).toBe(200);
    wsAdminToken =
      (loginAdmin.json() as { data?: { accessToken?: string } }).data?.accessToken ?? '';

    const loginViewer = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'x-api-key': apiKey, 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'ws-viewer-i18n@tecma.test', password: 'Password123!' }),
    });
    expect(loginViewer.statusCode).toBe(200);
    wsViewerToken =
      (loginViewer.json() as { data?: { accessToken?: string } }).data?.accessToken ?? '';
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('Tecma admin can PUT global bundle and read it via GET', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/v1/admin/i18n/bundles/it/common',
      headers: {
        'x-api-key': apiKey,
        authorization: `Bearer ${tecmaAdminToken}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ messages: { cmsGlobal: 'G1' } }),
    });
    expect(put.statusCode).toBe(200);
    const putJson = put.json() as { data: { version: number } };
    expect(putJson.data.version).toBe(1);

    const get = await app.inject({
      method: 'GET',
      url: '/v1/i18n/bundle?locale=it&namespaces=common',
      headers: { 'x-api-key': apiKey, authorization: `Bearer ${wsAdminToken}` },
    });
    expect(get.statusCode).toBe(200);
    const getJson = get.json() as { data: { namespaces: { common: { cmsGlobal?: string } } } };
    expect(getJson.data.namespaces.common.cmsGlobal).toBe('G1');
  });

  it('returns 409 on version mismatch for global bundle', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/v1/admin/i18n/bundles/it/common',
      headers: {
        'x-api-key': apiKey,
        authorization: `Bearer ${tecmaAdminToken}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ messages: { cmsGlobal: 'G2' }, version: 0 }),
    });
    expect(put.statusCode).toBe(409);
  });

  it('Tecma admin PATCH merges into global bundle without dropping existing keys', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/i18n/bundles/it/common',
      headers: {
        'x-api-key': apiKey,
        authorization: `Bearer ${tecmaAdminToken}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ patch: { tree: { leaf: 'v' } } }),
    });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { data: { version: number } }).data.version).toBe(2);

    const get = await app.inject({
      method: 'GET',
      url: '/v1/i18n/bundle?locale=it&namespaces=common',
      headers: { 'x-api-key': apiKey, authorization: `Bearer ${wsAdminToken}` },
    });
    expect(get.statusCode).toBe(200);
    const getJson = get.json() as { data: { namespaces: { common: Record<string, unknown> } } };
    expect(getJson.data.namespaces.common.cmsGlobal).toBe('G1');
    expect((getJson.data.namespaces.common.tree as { leaf?: string } | undefined)?.leaf).toBe('v');
  });

  it('returns 409 on PATCH version mismatch for global bundle', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/v1/admin/i18n/bundles/it/common',
      headers: {
        'x-api-key': apiKey,
        authorization: `Bearer ${tecmaAdminToken}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ patch: { x: 1 }, version: 0 }),
    });
    expect(patch.statusCode).toBe(409);
  });

  it('workspace admin can PUT workspace override; viewer gets 403', async () => {
    const putOk = await app.inject({
      method: 'PUT',
      url: `/v1/workspaces/${workspaceId}/i18n/bundles/it/common`,
      headers: {
        'x-api-key': apiKey,
        authorization: `Bearer ${wsAdminToken}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ messages: { cmsGlobal: 'WS', extra: 'x' } }),
    });
    expect(putOk.statusCode).toBe(200);

    const putDenied = await app.inject({
      method: 'PUT',
      url: `/v1/workspaces/${workspaceId}/i18n/bundles/it/common`,
      headers: {
        'x-api-key': apiKey,
        authorization: `Bearer ${wsViewerToken}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ messages: { cmsGlobal: 'nope' } }),
    });
    expect(putDenied.statusCode).toBe(403);

    const get = await app.inject({
      method: 'GET',
      url: `/v1/i18n/bundle?locale=it&namespaces=common&workspaceId=${workspaceId}`,
      headers: { 'x-api-key': apiKey, authorization: `Bearer ${wsAdminToken}` },
    });
    expect(get.statusCode).toBe(200);
    const getJson = get.json() as { data: { namespaces: { common: Record<string, string> } } };
    expect(getJson.data.namespaces.common.cmsGlobal).toBe('WS');
    expect(getJson.data.namespaces.common.extra).toBe('x');
  });

  it('workspace admin can PATCH partial merge on workspace bundle', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${workspaceId}/i18n/bundles/it/common`,
      headers: {
        'x-api-key': apiKey,
        authorization: `Bearer ${wsAdminToken}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ patch: { onlyPatch: { a: 1 } } }),
    });
    expect(patch.statusCode).toBe(200);
    expect((patch.json() as { data: { version: number } }).data.version).toBe(2);

    const get = await app.inject({
      method: 'GET',
      url: `/v1/i18n/bundle?locale=it&namespaces=common&workspaceId=${workspaceId}`,
      headers: { 'x-api-key': apiKey, authorization: `Bearer ${wsAdminToken}` },
    });
    expect(get.statusCode).toBe(200);
    const getJson = get.json() as { data: { namespaces: { common: Record<string, unknown> } } };
    expect(getJson.data.namespaces.common.cmsGlobal).toBe('WS');
    expect(getJson.data.namespaces.common.extra).toBe('x');
    expect((getJson.data.namespaces.common.onlyPatch as { a?: number } | undefined)?.a).toBe(1);
  });

  it('non-admin cannot call admin i18n routes', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/v1/admin/i18n/bundles/it/common',
      headers: {
        'x-api-key': apiKey,
        authorization: `Bearer ${wsAdminToken}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify({ messages: { hack: true } }),
    });
    expect(put.statusCode).toBe(403);
  });

  it('DELETE workspace bundle then GET falls back to global; second DELETE returns 404', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}/i18n/bundles/it/common`,
      headers: { 'x-api-key': apiKey, authorization: `Bearer ${wsAdminToken}` },
    });
    expect(del.statusCode).toBe(200);

    const delAgain = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}/i18n/bundles/it/common`,
      headers: { 'x-api-key': apiKey, authorization: `Bearer ${wsAdminToken}` },
    });
    expect(delAgain.statusCode).toBe(404);

    const get = await app.inject({
      method: 'GET',
      url: `/v1/i18n/bundle?locale=it&namespaces=common&workspaceId=${workspaceId}`,
      headers: { 'x-api-key': apiKey, authorization: `Bearer ${wsAdminToken}` },
    });
    expect(get.statusCode).toBe(200);
    const getJson = get.json() as { data: { namespaces: { common: { cmsGlobal?: string } } } };
    expect(getJson.data.namespaces.common.cmsGlobal).toBe('G1');
  });

  it('DELETE admin bundle returns 404 when absent', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: '/v1/admin/i18n/bundles/it/auth',
      headers: { 'x-api-key': apiKey, authorization: `Bearer ${tecmaAdminToken}` },
    });
    expect(del.statusCode).toBe(404);
  });
});
