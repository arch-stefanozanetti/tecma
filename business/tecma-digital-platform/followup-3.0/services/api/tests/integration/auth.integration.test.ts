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
});
