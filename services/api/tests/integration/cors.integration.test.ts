import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { FastifyInstance } from 'fastify';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

/** Preflight e richieste con `Origin` http://localhost:* verso API su altra porta (dev / test). */
describe('CORS (localhost dev)', () => {
  let app: FastifyInstance;
  let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;

  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();

    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = '1234567890123456';

    app = await buildServer();
  });

  afterAll(async () => {
    if (app) await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('OPTIONS preflight per /v1/auth/login riflette Origin localhost con porta arbitraria', async () => {
    const origin = 'http://localhost:5179';
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/auth/login',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('OPTIONS preflight consente x-api-key (browser :5177 → API :8080)', async () => {
    const origin = 'http://localhost:5177';
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/auth/me',
      headers: {
        origin,
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'authorization,x-api-key,content-type',
      },
    });

    expect(response.statusCode).toBe(204);
    const allowHeaders = String(
      response.headers['access-control-allow-headers'] ??
        response.headers['Access-Control-Allow-Headers'] ??
        '',
    ).toLowerCase();
    expect(allowHeaders).toContain('x-api-key');
  });

  it('GET health espone header sicurezza baseline (COOP / CORP)', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/health',
    });
    expect(response.statusCode).toBe(200);
    expect(String(response.headers['cross-origin-opener-policy'] ?? '')).toContain('same-origin');
    expect(String(response.headers['cross-origin-resource-policy'] ?? '')).toContain('same-site');
    const perms = String(response.headers['permissions-policy'] ?? '');
    expect(perms.length).toBeGreaterThan(0);
  });

  it('POST login riflette Origin localhost con credenziali invalide (401, non 5xx)', async () => {
    const origin = 'http://localhost:5179';
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: {
        origin,
        'content-type': 'application/json',
        'x-api-key': '1234567890123456',
      },
      payload: { email: 'nobody@example.com', password: 'wrong-password' },
    });

    expect(response.headers['access-control-allow-origin']).toBe(origin);
    expect(response.statusCode).toBe(401);
  });
});
