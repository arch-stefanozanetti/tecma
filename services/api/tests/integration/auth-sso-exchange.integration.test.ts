import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

vi.mock('../../src/modules/auth/ssoVerify.js', () => ({
  verifySsoAccessToken: vi.fn(),
}));

import { buildServer } from '../../src/server.js';
import { verifySsoAccessToken } from '../../src/modules/auth/ssoVerify.js';

const mockedVerify = vi.mocked(verifySsoAccessToken);

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;

describe('auth sso-exchange integration', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-sso-exchange';
    process.env.ALLOWED_WRITE_DB = 'test-sso-exchange';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = '1234567890123456';
    process.env.SSO_JWKS_URI = 'https://idp.example/.well-known/jwks.json';

    app = await buildServer();

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await app.mongoDb.collection('tz_users').insertMany([
      {
        _id: new ObjectId(),
        email: 'sso-active@tecma.test',
        passwordHash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId(),
        email: 'sso-inactive@tecma.test',
        passwordHash,
        status: 'invited',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  beforeEach(() => {
    mockedVerify.mockReset();
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('returns 401 when OIDC token verification fails', async () => {
    mockedVerify.mockRejectedValue(new Error('invalid signature'));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso-exchange',
      headers: { 'content-type': 'application/json' },
      payload: { token: 'oidc.access.token.here' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error?.code).toBe('InvalidSsoToken');
  });

  it('returns 403 SsoUserNotProvisioned when email is unknown', async () => {
    mockedVerify.mockResolvedValue({ sub: 'ext-sub-1', email: 'unknown@tecma.test' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso-exchange',
      headers: { 'content-type': 'application/json' },
      payload: { token: 'oidc.access.token.here' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error?.code).toBe('SsoUserNotProvisioned');
  });

  it('returns 403 SsoUserNotActive when user is not active', async () => {
    mockedVerify.mockResolvedValue({ sub: 'ext-sub-2', email: 'sso-inactive@tecma.test' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso-exchange',
      headers: { 'content-type': 'application/json' },
      payload: { token: 'oidc.access.token.here' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error?.code).toBe('SsoUserNotActive');
  });

  it('returns 200 with accessToken when user is active', async () => {
    mockedVerify.mockResolvedValue({ sub: 'ext-sub-3', email: 'sso-active@tecma.test' });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso-exchange',
      headers: { 'content-type': 'application/json' },
      payload: { token: 'oidc.access.token.here' },
    });

    expect(response.statusCode).toBe(200);
    const token = response.json().data?.accessToken as string;
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
    expect(mockedVerify).toHaveBeenCalledWith(
      'oidc.access.token.here',
      expect.objectContaining({ SSO_JWKS_URI: expect.stringContaining('jwks') }),
    );

    const audit = await app.mongoDb.collection('tz_authEvents').findOne({
      eventType: 'auth.sso.exchange',
      userId: 'ext-sub-3',
    });
    expect(audit).not.toBeNull();
    expect((audit as { details?: { email?: string; provider?: string } }).details?.email).toBe(
      'sso-active@tecma.test',
    );
    expect((audit as { details?: { provider?: string } }).details?.provider).toBe('keycloak');
  });
});
