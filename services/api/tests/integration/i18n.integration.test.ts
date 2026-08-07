import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let demoUserId = '';
let accessToken = '';

describe('i18n integration', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();

    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = '1234567890123456';

    app = await buildServer();

    const users = app.mongoDb.collection('tz_users');
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const demoInsert = await users.insertOne({
      _id: new ObjectId(),
      email: 'i18n-demo@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });
    demoUserId = demoInsert.insertedId.toString();

    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: 'ws-i18n',
      name: 'I18n Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: crypto.randomUUID(),
      workspaceId: 'ws-i18n',
      userId: demoUserId,
      role: 'admin',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    await app.mongoDb.collection('tz_i18n_global_bundles').insertOne({
      locale: 'it',
      namespace: 'common',
      messages: { greeting: 'Ciao', nested: { a: '1', b: '2' } },
      version: 1,
      updatedAt: now,
    } as any);

    await app.mongoDb.collection('tz_i18n_workspace_bundles').insertOne({
      workspaceId: 'ws-i18n',
      locale: 'it',
      namespace: 'common',
      messages: { greeting: 'Benvenuto workspace', nested: { a: '99' } },
      version: 1,
      updatedAt: now,
    } as any);

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'x-api-key': '1234567890123456', 'content-type': 'application/json' },
      payload: JSON.stringify({ email: 'i18n-demo@tecma.test', password: 'Password123!' }),
    });
    expect(login.statusCode).toBe(200);
    const body = login.json() as { data?: { accessToken?: string } };
    accessToken = body.data?.accessToken ?? '';
    expect(accessToken.length).toBeGreaterThan(10);
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('returns merged namespaces for locale (global only)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/i18n/bundle?locale=it&namespaces=common',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as {
      data: {
        locale: string;
        namespaces: { common: Record<string, unknown> };
        namespaceMeta?: Record<string, { globalVersion?: number; workspaceVersion?: number }>;
      };
    };
    expect(json.data.locale).toBe('it');
    expect(json.data.namespaces.common).toEqual({
      greeting: 'Ciao',
      nested: { a: '1', b: '2' },
    });
    expect(json.data.namespaceMeta?.common?.globalVersion).toBe(1);
    expect(json.data.namespaceMeta?.common?.workspaceVersion).toBeUndefined();
  });

  it('merges workspace overrides when workspaceId is allowed', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/i18n/bundle?locale=it&namespaces=common&workspaceId=ws-i18n',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as {
      data: {
        namespaces: { common: Record<string, unknown> };
        namespaceMeta?: Record<string, { globalVersion?: number; workspaceVersion?: number }>;
      };
    };
    expect(json.data.namespaces.common).toEqual({
      greeting: 'Benvenuto workspace',
      nested: { a: '99', b: '2' },
    });
    expect(json.data.namespaceMeta?.common?.globalVersion).toBe(1);
    expect(json.data.namespaceMeta?.common?.workspaceVersion).toBe(1);
  });

  it('returns workspace-only messages when workspaceMessagesOnly=true', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/i18n/bundle?locale=it&namespaces=common&workspaceId=ws-i18n&workspaceMessagesOnly=true',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(200);
    const json = res.json() as { data: { namespaces: { common: Record<string, unknown> } } };
    expect(json.data.namespaces.common).toEqual({
      greeting: 'Benvenuto workspace',
      nested: { a: '99' },
    });
  });

  it('returns 403 for workspace override without membership', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/i18n/bundle?locale=it&namespaces=common&workspaceId=ws-other',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns 400 when workspaceMessagesOnly without workspaceId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/i18n/bundle?locale=it&namespaces=common&workspaceMessagesOnly=true',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 for unsupported locale', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/v1/i18n/bundle?locale=xx&namespaces=common',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${accessToken}`,
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
