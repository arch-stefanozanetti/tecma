import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;

describe('auth integration', () => {
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
    await users.insertOne({
      _id: new ObjectId(),
      email: 'demo@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });

    await users.insertOne({
      _id: new ObjectId(),
      email: 'legacy-admin@tecma.test',
      passwordHash,
      status: 'active',
      system_role: 'tecma_admin',
      isTecmaAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('returns 401 when x-api-key is missing on protected routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users',
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error?.code).toBe('Unauthorized');
  });

  it('explains that GET /auth/login is not the login endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/auth/login',
    });
    expect(response.statusCode).toBe(405);
    expect(response.headers.allow).toBe('POST');
    expect(response.json().error?.code).toBe('MethodNotAllowed');
  });

  it('returns 401 on invalid credentials', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'wrong-password' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 401 (not 400) for short invalid passwords', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'x' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('accepts login for active user with passwordHash and lowercased email in DB', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.user.email).toBe('demo@tecma.test');
  });

  it('normalizes legacy system_role=tecma_admin into canonical SuperAdmin JWT claims', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'legacy-admin@tecma.test', password: 'Password123!' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body.user.systemRole).toBe('tecma_admin');
    expect(body.user.isTecmaAdmin).toBe(true);
    expect(body.user.permissions).toEqual(['*']);

    const decoded = app.jwt.decode(body.accessToken) as {
      systemRole?: string;
      isTecmaAdmin?: boolean;
      permissions?: string[];
    };
    expect(decoded.systemRole).toBe('tecma_admin');
    expect(decoded.isTecmaAdmin).toBe(true);
    expect(decoded.permissions).toEqual(['*']);

    const me = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${body.accessToken}`,
      },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().data).toMatchObject({
      email: 'legacy-admin@tecma.test',
      systemRole: 'tecma_admin',
      isTecmaAdmin: true,
      permissions: ['*'],
    });
  });

  it('returns 401 for invited user', async () => {
    const users = app.mongoDb.collection('tz_users');
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await users.insertOne({
      _id: new ObjectId(),
      email: 'invited@tecma.test',
      passwordHash,
      status: 'invited',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'invited@tecma.test', password: 'Password123!' },
    });

    expect(response.statusCode).toBe(401);
  });

  it('invalidates refresh token after logout', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const refreshToken = login.json().data.refreshToken as string;

    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: { 'x-api-key': '1234567890123456', 'content-type': 'application/json' },
      payload: { refreshToken },
    });
    expect(logout.statusCode).toBe(200);

    const refreshAfterLogout = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: { 'x-api-key': '1234567890123456', 'content-type': 'application/json' },
      payload: { refreshToken },
    });
    expect(refreshAfterLogout.statusCode).toBe(401);
  });

  it('returns 503 for SSO exchange when JWKS is not configured', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso-exchange',
      headers: { 'x-api-key': '1234567890123456' },
      payload: { token: 'valid-length-token' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error?.code).toBe('SsoNotConfigured');
  });
});
