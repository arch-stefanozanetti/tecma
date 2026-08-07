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
let memberId: ObjectId;
let outsiderId: ObjectId;
const workspaceId = 'ws-assets-int';

describe('Assets integration', () => {
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
    memberId = new ObjectId();
    outsiderId = new ObjectId();

    await users.insertMany([
      {
        _id: adminId,
        email: 'assets-admin@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'tecma_admin',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: memberId,
        email: 'assets-member@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: outsiderId,
        email: 'assets-outsider@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await workspaces.insertOne({
      _id: workspaceId,
      name: 'Assets Workspace',
      createdAt: now,
      updatedAt: now,
    } as any);
    await memberships.insertMany([
      {
        _id: 'm-admin',
        workspaceId,
        userId: adminId.toString(),
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'm-member',
        workspaceId,
        userId: memberId.toString(),
        role: 'viewer',
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

  it('POST upload-url ritorna inline-fallback quando feature flag off', async () => {
    process.env.ENABLE_ASSET_UPLOADS = 'false';
    const token = await loginAs('assets-admin@tecma.test');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/assets/upload-url`,
      headers: authHeaders(token),
      payload: { fileName: 'logo.png', contentType: 'image/png' },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.mode).toBe('inline-fallback');
    expect(data.uploadUrl).toBeNull();
    expect(typeof data.storageKey).toBe('string');
  });

  it('POST upload-url sanitizza fileName prima di costruire storageKey', async () => {
    process.env.ENABLE_ASSET_UPLOADS = 'false';
    const token = await loginAs('assets-admin@tecma.test');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/assets/upload-url`,
      headers: authHeaders(token),
      payload: { fileName: '..%2F..%2Flogo cattivo.png', contentType: 'image/png' },
    });
    expect(res.statusCode).toBe(200);
    const storageKey = res.json().data.storageKey as string;
    expect(storageKey).toContain('-logo_cattivo.png');
    expect(storageKey).not.toContain('..');
    expect(storageKey).not.toContain('%2F');
  });

  it('POST upload-url ritorna signed-url quando feature flag on', async () => {
    process.env.ENABLE_ASSET_UPLOADS = 'true';
    const token = await loginAs('assets-admin@tecma.test');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/assets/upload-url`,
      headers: authHeaders(token),
      payload: { fileName: 'logo.png', contentType: 'image/png', kind: 'workspace.logo' },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.mode).toBe('signed-url');
    expect(typeof data.uploadUrl).toBe('string');
    expect(data.expiresIn).toBeGreaterThan(0);
    process.env.ENABLE_ASSET_UPLOADS = 'false';
  });

  it('POST upload-url 400 se contentType non consentito', async () => {
    const token = await loginAs('assets-admin@tecma.test');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/assets/upload-url`,
      headers: authHeaders(token),
      payload: { fileName: 'evil.exe', contentType: 'application/x-msdownload' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('AssetContentTypeNotAllowed');
  });

  it('POST assets crea asset inline + GET list ritorna inline data troncato', async () => {
    const token = await loginAs('assets-admin@tecma.test');
    // PNG magic bytes (iVBORw0KGgo...) padding a 200 chars — necessario per il magic-bytes check
    const inline =
      'iVBORw0KGgoAAAANSUhEUgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
    const create = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/assets`,
      headers: authHeaders(token),
      payload: {
        fileName: 'logo.png',
        contentType: 'image/png',
        kind: 'workspace.logo',
        inlineData: inline,
      },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}/assets`,
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    const data = list.json().data as Array<Record<string, unknown>>;
    expect(data.length).toBeGreaterThanOrEqual(1);
    const created = data.find((entry) => entry.fileName === 'logo.png');
    expect(created).toBeTruthy();
    expect(typeof created?.inlineData).toBe('string');
    expect((created?.inlineData as string).length).toBeLessThan(inline.length);
  });

  it('POST assets rifiuta inlineData che non combacia con il contentType', async () => {
    const token = await loginAs('assets-admin@tecma.test');
    const htmlAsBase64 = Buffer.from('<html><script>alert(1)</script></html>').toString('base64');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/assets`,
      headers: authHeaders(token),
      payload: {
        fileName: 'logo.png',
        contentType: 'image/png',
        kind: 'workspace.logo',
        inlineData: htmlAsBase64,
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('AssetContentMismatch');
  });

  it('POST assets 400 se manca storageKey e inlineData', async () => {
    const token = await loginAs('assets-admin@tecma.test');
    const res = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/assets`,
      headers: authHeaders(token),
      payload: { fileName: 'a.png', contentType: 'image/png' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('AssetMissingPayload');
  });

  it('GET asset download-url torna inline data quando feature flag off', async () => {
    const token = await loginAs('assets-admin@tecma.test');
    const create = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/assets`,
      headers: authHeaders(token),
      payload: {
        fileName: 'note.png',
        contentType: 'image/png',
        kind: 'generic',
        // PNG magic bytes validi per superare il magic-bytes check
        inlineData: 'iVBORw0KGgoAAAANSUhEUg==',
      },
    });
    const id = create.json().data._id as string;
    const dl = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}/assets/${id}/download-url`,
      headers: authHeaders(token),
    });
    expect(dl.statusCode).toBe(200);
    expect(dl.json().data.mode).toBe('inline-fallback');
    expect(dl.json().data.inlineData).toBe('iVBORw0KGgoAAAANSUhEUg==');
  });

  it('GET asset download-url 404 per asset inesistente', async () => {
    const token = await loginAs('assets-admin@tecma.test');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}/assets/${new ObjectId().toString()}/download-url`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(404);
  });

  it('GET asset download-url 400 per assetId non valido', async () => {
    const token = await loginAs('assets-admin@tecma.test');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}/assets/not-objectid/download-url`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(400);
  });

  it('DELETE asset esegue soft-delete e nasconde dalla list', async () => {
    const token = await loginAs('assets-admin@tecma.test');
    const create = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/assets`,
      headers: authHeaders(token),
      payload: {
        fileName: 'todelete.png',
        contentType: 'image/png',
        kind: 'generic',
        inlineData: 'iVBORw0KGgoAAAANSUhEUg==',
      },
    });
    const id = create.json().data._id as string;
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}/assets/${id}`,
      headers: authHeadersNoBody(token),
    });
    expect(del.statusCode).toBe(200);
    const list = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}/assets`,
      headers: authHeaders(token),
    });
    const data = list.json().data as Array<Record<string, unknown>>;
    expect(data.find((entry) => entry._id === id)).toBeUndefined();
  });

  it('outsider 403 sulla list assets workspace', async () => {
    const token = await loginAs('assets-outsider@tecma.test');
    const res = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}/assets`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(403);
  });
});
