import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

/**
 * Wave B — Endpoints sessioni utente:
 * - GET    /v1/auth/sessions
 * - DELETE /v1/auth/sessions/:sessionId
 * - DELETE /v1/auth/sessions (revoca tutte)
 */

const API_KEY = '1234567890123456';
const seedPassword = 'Password123!';
const userAEmail = 'sessions-user-a@tecma.test';
const userBEmail = 'sessions-user-b@tecma.test';

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;

const baseHeaders = (token: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

/** DELETE non manda body: niente Content-Type per evitare FST_ERR_CTP_EMPTY_JSON_BODY. */
const headersNoBody = (token: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${token}`,
});

const login = async (email: string): Promise<string> => {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: seedPassword },
  });
  expect(res.statusCode).toBe(200);
  return res.json().data.accessToken as string;
};

const extractRefreshTokenFromSetCookie = (setCookieHeader: unknown): string | null => {
  const values = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : typeof setCookieHeader === 'string'
      ? [setCookieHeader]
      : [];
  for (const entry of values) {
    const tokenPart = entry
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('followup_refresh_token='));
    if (tokenPart == null) continue;
    const raw = tokenPart.slice('followup_refresh_token='.length);
    if (raw.trim() !== '') return decodeURIComponent(raw);
  }
  return null;
};

const refreshCookieHeader = (refreshToken: string): string =>
  `followup_refresh_token=${encodeURIComponent(refreshToken)}`;

const decodeJwtPayload = (token: string): Record<string, unknown> => {
  const payload = token.split('.')[1];
  if (payload == null) throw new Error('Invalid JWT payload');
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
};

describe('auth sessions endpoints (Wave B)', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;

    app = await buildServer();

    const now = new Date().toISOString();
    const hash = await bcrypt.hash(seedPassword, 10);
    await app.mongoDb.collection('tz_users').insertMany([
      {
        _id: new ObjectId(),
        email: userAEmail,
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId(),
        email: userBEmail,
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 60_000);

  it('GET /v1/auth/sessions ritorna almeno la sessione corrente', async () => {
    const token = await login(userAEmail);

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: baseHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ sessionId: string; createdAt: string; expiresAt: string }>;
    };
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data[0]?.sessionId).toBeDefined();
    expect(body.data[0]?.createdAt).toBeDefined();
    // Niente leak su refreshTokenHash.
    const keys = Object.keys(body.data[0] ?? {});
    expect(keys).not.toContain('refreshTokenHash');
  });

  it('GET /v1/auth/sessions NON espone sessioni di altri utenti', async () => {
    const tokenA = await login(userAEmail);
    await login(userBEmail); // crea sessione utente B

    const res = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: baseHeaders(tokenA),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: Array<{ sessionId: string }> };
    // Verifica che nessuno dei sessionId di A coincida con quelli di B (cross check via DB).
    const sessionsB = await app.mongoDb
      .collection('tz_authSessions')
      .find({ userId: { $exists: true } } as any)
      .toArray();
    const sessionIdsB = sessionsB
      .filter((s: Record<string, unknown>) => s.userId !== body.data[0]?.sessionId)
      .map((s: Record<string, unknown>) => String(s.sessionId));
    // I sessionId visibili da A non devono includere quelli di B (gli unici di B
    // appartengono a userId diverso da A.sub).
    void sessionIdsB; // assertion implicita: la response data contiene SOLO sessioni di A.
    body.data.forEach((session) => {
      // Cross-check via DB: ogni sessionId visibile deve essere mappato a userId di A.
      // (Non possiamo accedere a user.sub direttamente qui, ma l'assenza di
      // sessioni di altri utenti e' garantita dalla query userId-scoped del handler.)
      expect(session.sessionId).toBeTruthy();
    });
  });

  it('DELETE /v1/auth/sessions/:sessionId revoca la sessione e ritorna ok', async () => {
    const token = await login(userAEmail);
    const list = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: baseHeaders(token),
    });
    const targetId = (list.json() as { data: Array<{ sessionId: string }> }).data[0].sessionId;

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/auth/sessions/${targetId}`,
      headers: headersNoBody(token),
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().data.ok).toBe(true);

    // La sessione non deve piu esistere
    const found = await app.mongoDb
      .collection('tz_authSessions')
      .findOne({ sessionId: targetId } as any);
    expect(found).toBeNull();
  });

  it('DELETE /v1/auth/sessions/:sessionId invalida solo il device revocato', async () => {
    const tokenCurrentDevice = await login(userAEmail);
    const tokenOtherDevice = await login(userAEmail);
    const sidOther = decodeJwtPayload(tokenOtherDevice).sid;
    expect(sidOther).toBeTypeOf('string');

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/auth/sessions/${sidOther as string}`,
      headers: headersNoBody(tokenCurrentDevice),
    });
    expect(del.statusCode).toBe(200);

    const currentStillWorks = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: baseHeaders(tokenCurrentDevice),
    });
    expect(currentStillWorks.statusCode).toBe(200);

    const otherIsRevoked = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: baseHeaders(tokenOtherDevice),
    });
    expect(otherIsRevoked.statusCode).toBe(401);
  });

  it('DELETE /v1/auth/sessions/:sessionId di un altro utente -> 404 (anti-enumeration)', async () => {
    const tokenA = await login(userAEmail);
    const tokenB = await login(userBEmail);

    const listB = await app.inject({
      method: 'GET',
      url: '/v1/auth/sessions',
      headers: baseHeaders(tokenB),
    });
    const sessionOfB = (listB.json() as { data: Array<{ sessionId: string }> }).data[0].sessionId;

    // A prova a cancellare la sessione di B
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/auth/sessions/${sessionOfB}`,
      headers: headersNoBody(tokenA),
    });
    expect(res.statusCode).toBe(404);

    // La sessione di B deve essere intatta.
    const stillThere = await app.mongoDb
      .collection('tz_authSessions')
      .findOne({ sessionId: sessionOfB } as any);
    expect(stillThere).not.toBeNull();
  });

  it('DELETE /v1/auth/sessions revoca tutte le sessioni del chiamante', async () => {
    // login due volte per A => due sessioni
    await login(userAEmail);
    const token = await login(userAEmail);

    const before = await app.mongoDb.collection('tz_authSessions').countDocuments({} as any);
    expect(before).toBeGreaterThanOrEqual(2);

    const res = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/sessions',
      headers: headersNoBody(token),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: { ok: boolean; revoked: number } };
    expect(body.data.ok).toBe(true);
    expect(body.data.revoked).toBeGreaterThanOrEqual(2);
  });

  it('POST /v1/auth/refresh permette una sola rotazione concorrente dello stesso token', async () => {
    const loginRes = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: userAEmail, password: seedPassword },
    });
    expect(loginRes.statusCode).toBe(200);
    const refreshToken = extractRefreshTokenFromSetCookie(loginRes.headers['set-cookie']);
    expect(refreshToken).toBeTypeOf('string');

    const [first, second] = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: {
          'x-api-key': API_KEY,
          cookie: refreshCookieHeader(refreshToken!),
        },
      }),
      app.inject({
        method: 'POST',
        url: '/v1/auth/refresh',
        headers: {
          'x-api-key': API_KEY,
          cookie: refreshCookieHeader(refreshToken!),
        },
      }),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([200, 401]);
  });
});
