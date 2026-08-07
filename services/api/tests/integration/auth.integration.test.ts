import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';
import { generateTotpCode } from '../../src/modules/auth/totp.js';

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let demoUserId = '';

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

describe('auth integration', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();

    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = '1234567890123456';
    process.env.AUTH_LOGIN_MAX_ATTEMPTS = '3';
    process.env.AUTH_LOGIN_LOCK_MINUTES = '1';

    app = await buildServer();

    const users = app.mongoDb.collection('tz_users');
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const demoInsert = await users.insertOne({
      _id: new ObjectId(),
      email: 'demo@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });
    demoUserId = demoInsert.insertedId.toString();
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: 'ws-auth-rbac',
      name: 'Auth RBAC Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: crypto.randomUUID(),
      workspaceId: 'ws-auth-rbac',
      userId: demoUserId,
      role: 'admin',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

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

  it('authenticates the matching workspace-scoped identity when duplicate emails have different passwords', async () => {
    const users = app.mongoDb.collection('tz_users');
    const now = new Date().toISOString();
    const firstId = new ObjectId();
    const secondId = new ObjectId();
    await users.insertMany([
      {
        _id: firstId,
        email: 'duplicate-login@tecma.test',
        passwordHash: await bcrypt.hash('PasswordOne123!', 10),
        status: 'active',
        systemRole: 'user',
        homeWorkspaceId: 'ws-auth-rbac',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: secondId,
        email: 'duplicate-login@tecma.test',
        passwordHash: await bcrypt.hash('PasswordTwo123!', 10),
        status: 'active',
        systemRole: 'user',
        homeWorkspaceId: 'ws-auth-rbac-secondary',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'duplicate-login@tecma.test', password: 'PasswordTwo123!' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.user.id).toBe(secondId.toString());
  });

  it('blocks login when duplicate workspace-scoped identities match the same password', async () => {
    const users = app.mongoDb.collection('tz_users');
    const now = new Date().toISOString();
    const sharedHash = await bcrypt.hash('SamePassword123!', 10);
    await users.insertMany([
      {
        _id: new ObjectId(),
        email: 'ambiguous-login@tecma.test',
        passwordHash: sharedHash,
        status: 'active',
        systemRole: 'user',
        homeWorkspaceId: 'ws-auth-rbac',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId(),
        email: 'ambiguous-login@tecma.test',
        passwordHash: sharedHash,
        status: 'active',
        systemRole: 'user',
        homeWorkspaceId: 'ws-auth-rbac-secondary',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ambiguous-login@tecma.test', password: 'SamePassword123!' },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error?.code).toBe('AmbiguousLoginIdentity');
  });

  it('computes JWT permissions from workspace memberships', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });

    expect(response.statusCode).toBe(200);
    const permissions = response.json().data.user.permissions as string[];
    expect(permissions).toContain('users.invite');
    expect(permissions).toContain('workspaces.write');
    expect(permissions).toContain('projects.write');
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

  it('returns 403 when workspace requires MFA and user has not enabled MFA', async () => {
    const users = app.mongoDb.collection('tz_users');
    const workspaces = app.mongoDb.collection('tz_workspaces');
    const memberships = app.mongoDb.collection('tz_user_workspaces');
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const inserted = await users.insertOne({
      _id: new ObjectId(),
      email: 'mfa-required@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      mfaEnabled: false,
      createdAt: now,
      updatedAt: now,
    } as any);
    await workspaces.insertOne({
      _id: 'ws-mfa-required',
      name: 'Workspace MFA',
      mfaRequired: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await memberships.insertOne({
      _id: crypto.randomUUID(),
      workspaceId: 'ws-mfa-required',
      userId: inserted.insertedId.toString(),
      role: 'viewer',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'mfa-required@tecma.test', password: 'Password123!' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error?.code).toBe('MfaRequired');
  });

  it('supports MFA setup, verifies TOTP at login and disables MFA with password + code', async () => {
    const initialLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });
    expect(initialLogin.statusCode).toBe(200);
    const initialAccessToken = initialLogin.json().data.accessToken as string;

    const setup = await app.inject({
      method: 'POST',
      url: '/v1/auth/mfa/setup',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${initialAccessToken}`,
      },
    });
    expect(setup.statusCode).toBe(200);
    const secret = setup.json().data.secret as string;
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.json().data.otpauthUrl).toContain('otpauth://totp/');

    const code = generateTotpCode(secret);
    const verify = await app.inject({
      method: 'POST',
      url: '/v1/auth/mfa/verify',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${initialAccessToken}`,
      },
      payload: { code },
    });
    expect(verify.statusCode).toBe(200);
    expect(verify.json().data.enabled).toBe(true);

    const missingCode = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });
    expect(missingCode.statusCode).toBe(401);
    expect(missingCode.json().error?.code).toBe('MfaCodeRequired');

    const invalidCode = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!', mfaCode: '000000' },
    });
    expect(invalidCode.statusCode).toBe(401);
    expect(invalidCode.json().error?.code).toBe('InvalidMfaCode');

    const loginWithMfa = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!', mfaCode: code },
    });
    expect(loginWithMfa.statusCode).toBe(200);

    const disable = await app.inject({
      method: 'DELETE',
      url: '/v1/auth/mfa',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${initialAccessToken}`,
      },
      payload: { currentPassword: 'Password123!', code },
    });
    expect(disable.statusCode).toBe(200);
    expect(disable.json().data.enabled).toBe(false);

    const loginAfterDisable = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });
    expect(loginAfterDisable.statusCode).toBe(200);
  });

  it('invalidates refresh token after logout', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const refreshToken = extractRefreshTokenFromSetCookie(login.headers['set-cookie']);
    expect(refreshToken).toBeTypeOf('string');
    const loginSetCookie = String(
      Array.isArray(login.headers['set-cookie'])
        ? login.headers['set-cookie'][0]
        : login.headers['set-cookie'],
    );
    expect(loginSetCookie).toContain('followup_refresh_token=');
    expect(loginSetCookie.toLowerCase()).toContain('httponly');

    const logout = await app.inject({
      method: 'POST',
      url: '/v1/auth/logout',
      headers: {
        'x-api-key': '1234567890123456',
        cookie: refreshCookieHeader(refreshToken!),
      },
    });
    expect(logout.statusCode).toBe(200);
    const logoutSetCookie = String(
      Array.isArray(logout.headers['set-cookie'])
        ? logout.headers['set-cookie'][0]
        : logout.headers['set-cookie'],
    );
    expect(logoutSetCookie).toContain('followup_refresh_token=');
    expect(/max-age=0|expires=/i.test(logoutSetCookie)).toBe(true);

    const refreshAfterLogout = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        'x-api-key': '1234567890123456',
        cookie: refreshCookieHeader(refreshToken!),
      },
    });
    expect(refreshAfterLogout.statusCode).toBe(401);
  });

  it('rotates refresh token and invalidates reused previous token', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const refreshToken1 = extractRefreshTokenFromSetCookie(login.headers['set-cookie']);
    expect(refreshToken1).toBeTypeOf('string');

    const refresh1 = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        'x-api-key': '1234567890123456',
        cookie: refreshCookieHeader(refreshToken1!),
      },
    });
    expect(refresh1.statusCode).toBe(200);
    const refreshToken2 = extractRefreshTokenFromSetCookie(refresh1.headers['set-cookie']);
    expect(refreshToken2).toBeTypeOf('string');
    expect(refreshToken2).not.toBe(refreshToken1);

    const replayOld = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        'x-api-key': '1234567890123456',
        cookie: refreshCookieHeader(refreshToken1!),
      },
    });
    expect(replayOld.statusCode).toBe(401);

    const refresh2 = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        'x-api-key': '1234567890123456',
        cookie: refreshCookieHeader(refreshToken2!),
      },
    });
    expect(refresh2.statusCode).toBe(401);
  });

  it('locks login after repeated invalid attempts', async () => {
    for (let i = 0; i < 3; i += 1) {
      const invalid = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'demo@tecma.test', password: 'wrong-password' },
      });
      expect(invalid.statusCode).toBe(401);
    }

    const locked = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });
    expect(locked.statusCode).toBe(429);
    expect(locked.json().error?.code).toBe('TooManyRequests');
    await app.mongoDb.collection('tz_auth_login_guards').deleteMany({});
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

  it('forgot-password returns neutral accepted response for unknown account', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/forgot-password',
      headers: { 'x-api-key': '1234567890123456', 'content-type': 'application/json' },
      payload: { email: 'missing@tecma.test' },
    });
    expect(response.statusCode).toBe(202);
    expect(response.json().data?.accepted).toBe(true);
  });

  it('reset-password consumes token, changes password and revokes existing sessions', async () => {
    await app.mongoDb.collection('tz_auth_login_guards').deleteMany({});
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const oldRefreshToken = extractRefreshTokenFromSetCookie(login.headers['set-cookie']);
    expect(oldRefreshToken).toBeTypeOf('string');

    const rawResetToken = 'reset-token-demo-1234567890abcdefghijklmnopqrstuvwxyz';
    await app.mongoDb.collection('tz_authPasswordResets').insertOne({
      resetId: crypto.randomUUID(),
      userId: demoUserId,
      tokenHash: crypto.createHash('sha256').update(rawResetToken).digest('hex'),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    const reset = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      headers: { 'x-api-key': '1234567890123456', 'content-type': 'application/json' },
      payload: { token: rawResetToken, newPassword: 'NewPassword123!' },
    });
    expect(reset.statusCode).toBe(200);
    expect(reset.json().data?.reset).toBe(true);

    const oldPasswordLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'Password123!' },
    });
    expect(oldPasswordLogin.statusCode).toBe(401);

    const newPasswordLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'NewPassword123!' },
    });
    expect(newPasswordLogin.statusCode).toBe(200);

    const refreshAfterReset = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        'x-api-key': '1234567890123456',
        cookie: refreshCookieHeader(oldRefreshToken!),
      },
    });
    expect(refreshAfterReset.statusCode).toBe(401);

    const tokenReuse = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      headers: { 'x-api-key': '1234567890123456', 'content-type': 'application/json' },
      payload: { token: rawResetToken, newPassword: 'AnotherPassword123!' },
    });
    expect(tokenReuse.statusCode).toBe(401);
  });

  it('change-password updates credentials and invalidates old session', async () => {
    await app.mongoDb.collection('tz_auth_login_guards').deleteMany({});
    const firstLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'NewPassword123!' },
    });
    expect(firstLogin.statusCode).toBe(200);
    const accessToken = firstLogin.json().data.accessToken as string;
    const refreshToken = extractRefreshTokenFromSetCookie(firstLogin.headers['set-cookie']);
    expect(refreshToken).toBeTypeOf('string');

    const change = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-password',
      headers: {
        'x-api-key': '1234567890123456',
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      payload: { currentPassword: 'NewPassword123!', newPassword: 'FinalPassword123!' },
    });
    expect(change.statusCode).toBe(200);
    expect(change.json().data?.changed).toBe(true);

    const staleRefresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        'x-api-key': '1234567890123456',
        cookie: refreshCookieHeader(refreshToken!),
      },
    });
    expect(staleRefresh.statusCode).toBe(401);

    const oldLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'NewPassword123!' },
    });
    expect(oldLogin.statusCode).toBe(401);

    const finalLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'FinalPassword123!' },
    });
    expect(finalLogin.statusCode).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Regression test per i security fix di 2026-05-05.
  // -------------------------------------------------------------------------

  it('SSO exchange torna 503 quando JWKS non configurato (no auto-provisioning)', async () => {
    // Senza SSO_JWKS_URI il sistema deve rifiutare lo scambio.
    const response = await app.inject({
      method: 'POST',
      url: '/v1/auth/sso-exchange',
      headers: { 'x-api-key': process.env.INTERNAL_API_KEY! },
      payload: { token: 'arbitrary.jwt.token' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json().error?.code).toBe('SsoNotConfigured');
  });

  it('reset-password rifiuta password debole anche con token valido', async () => {
    const users = app.mongoDb.collection('tz_users');
    const passwordResets = app.mongoDb.collection('tz_authPasswordResets');

    const passwordHash = await bcrypt.hash('OriginalPassword123!', 10);
    const inserted = await users.insertOne({
      _id: new ObjectId(),
      email: 'weak-pwd-test@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const userId = inserted.insertedId.toString();

    const rawToken = crypto.randomBytes(48).toString('base64url').slice(0, 72);
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    await passwordResets.insertOne({
      _id: new ObjectId(),
      resetId: crypto.randomUUID(),
      userId,
      tokenHash,
      createdAt: new Date().toISOString(),
      expiresAt,
    });

    // Password >= 12 chars (passa Fastify schema) ma senza upper/symbol → blocked da isStrongPassword
    const weak = await app.inject({
      method: 'POST',
      url: '/v1/auth/reset-password',
      payload: { token: rawToken, newPassword: 'lowercase123' },
    });
    expect(weak.statusCode).toBe(400);
    expect(weak.json().error?.code).toBe('WeakPassword');
  });

  it('invite-accept consuma token, imposta password e attiva membership', async () => {
    const rawToken = crypto.randomBytes(48).toString('base64url');
    const invitedId = new ObjectId();
    await app.mongoDb.collection('tz_users').insertOne({
      _id: invitedId,
      email: 'accept-invite@tecma.test',
      passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString('base64url'), 10),
      status: 'invited',
      systemRole: 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: 'accept-membership',
      workspaceId: 'ws-accept-invite',
      userId: invitedId.toString(),
      role: 'viewer',
      status: 'invited',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await app.mongoDb.collection('tz_inviteTokens').insertOne({
      _id: crypto.randomUUID(),
      tokenHash: crypto.createHash('sha256').update(rawToken).digest('hex'),
      userId: invitedId.toString(),
      workspaceId: 'ws-accept-invite',
      role: 'collaborator',
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    });

    const accept = await app.inject({
      method: 'POST',
      url: '/v1/auth/invite-accept',
      payload: { token: rawToken, newPassword: 'AcceptedPassword123!' },
    });
    expect(accept.statusCode).toBe(200);
    expect(accept.json().data?.accepted).toBe(true);

    const tokenDoc = await app.mongoDb.collection('tz_inviteTokens').findOne({
      userId: invitedId.toString(),
      workspaceId: 'ws-accept-invite',
    });
    expect(tokenDoc?.status).toBe('used');
    expect(tokenDoc?.consumedAt).toBeTypeOf('string');

    const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
      workspaceId: 'ws-accept-invite',
      userId: invitedId.toString(),
    });
    expect(membership).toMatchObject({ status: 'active', role: 'collaborator' });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'accept-invite@tecma.test', password: 'AcceptedPassword123!' },
    });
    expect(login.statusCode).toBe(200);

    const replay = await app.inject({
      method: 'POST',
      url: '/v1/auth/invite-accept',
      payload: { token: rawToken, newPassword: 'AcceptedPassword456!' },
    });
    expect(replay.statusCode).toBe(401);
  });

  it('change-password richiede password diversa da quella corrente', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'FinalPassword123!' },
    });
    expect(login.statusCode).toBe(200);
    const accessToken = login.json().data.accessToken as string;

    const reuse = await app.inject({
      method: 'POST',
      url: '/v1/auth/change-password',
      headers: {
        'x-api-key': process.env.INTERNAL_API_KEY!,
        authorization: `Bearer ${accessToken}`,
      },
      payload: { currentPassword: 'FinalPassword123!', newPassword: 'FinalPassword123!' },
    });
    expect(reuse.statusCode).toBe(400);
    expect(reuse.json().error?.code).toBe('PasswordReuse');
  });

  it('refresh con token random non valido restituisce 401', async () => {
    // Token non esistente nel DB delle sessioni → 401 (non 500, non leak info).
    const fakeToken = 'a'.repeat(64);
    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        'x-api-key': process.env.INTERNAL_API_KEY!,
        cookie: refreshCookieHeader(fakeToken),
      },
    });
    expect(refresh.statusCode).toBe(401);
    expect(refresh.json().error?.code).toBe('InvalidRefreshToken');
  });

  it('refresh ignora body legacy: solo cookie HttpOnly', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'demo@tecma.test', password: 'FinalPassword123!' },
    });
    expect(login.statusCode).toBe(200);
    const refreshToken = extractRefreshTokenFromSetCookie(login.headers['set-cookie']);
    expect(refreshToken).toBeTypeOf('string');

    const bodyOnly = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: { 'x-api-key': '1234567890123456' },
      payload: { refreshToken: refreshToken! },
    });
    expect(bodyOnly.statusCode).toBe(401);

    const cookieOk = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: {
        'x-api-key': '1234567890123456',
        cookie: refreshCookieHeader(refreshToken!),
      },
    });
    expect(cookieOk.statusCode).toBe(200);
    expect(typeof cookieOk.json().data?.accessToken).toBe('string');
  });
});
