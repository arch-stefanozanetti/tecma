import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { Long, ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';
import { PERMISSIONS } from '@followup/shared-rbac';

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

const seedPassword = 'Password123!';

const loginToken = async (email: string): Promise<string> => {
  const login = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: seedPassword },
  });
  expect(login.statusCode).toBe(200);
  return login.json().data.accessToken as string;
};

describe('users hardening integration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;

    app = await buildServer();

    const users = app.mongoDb.collection('tz_users');
    const now = new Date().toISOString();
    const hash = await bcrypt.hash(seedPassword, 10);

    await users.insertMany([
      {
        _id: new ObjectId('65f000000000000000000001'),
        email: 'admin-hardening@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'tecma_admin',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId('65f000000000000000000002'),
        email: 'scoped-viewer@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        permissionsOverride: [PERMISSIONS.USERS_READ],
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId('65f000000000000000000003'),
        email: 'shared-member@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId('65f000000000000000000004'),
        email: 'outsider-member@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId('65f000000000000000000005'),
        email: 'delete-target@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId('65f000000000000000000006'),
        email: 'solo-superadmin@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'tecma_admin',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await app.mongoDb.collection('tz_workspaces').insertMany([
      {
        _id: 'ws-alpha',
        name: 'Workspace Alpha',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'ws-beta',
        name: 'Workspace Beta',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ] as any);

    await app.mongoDb.collection('tz_user_workspaces').insertMany([
      {
        _id: randomUUID(),
        workspaceId: 'ws-alpha',
        userId: '65f000000000000000000002',
        role: 'admin',
        createdAt: now,
      },
      {
        _id: randomUUID(),
        workspaceId: 'ws-alpha',
        userId: '65f000000000000000000003',
        role: 'viewer',
        createdAt: now,
      },
      {
        _id: randomUUID(),
        workspaceId: 'ws-beta',
        userId: '65f000000000000000000004',
        role: 'viewer',
        createdAt: now,
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 120_000);

  it('workspace viewer cannot create platform API keys (requireWorkspaceAdminOrOwner)', async () => {
    const viewerToken = await loginToken('shared-member@tecma.test');
    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/ws-alpha/platform-api-keys',
      headers: authHeaders(viewerToken),
      payload: { label: 'Denied by RBAC' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('JWT base permissions non includono users.read per utente standard', async () => {
    const token = await loginToken('delete-target@tecma.test');
    const me = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: {
        'x-api-key': API_KEY,
        authorization: `Bearer ${token}`,
      },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().data.permissions).not.toContain(PERMISSIONS.USERS_READ);
  });

  it('GET /v1/users è isolato al tenant quando users.read è in override', async () => {
    const scopedToken = await loginToken('scoped-viewer@tecma.test');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: authHeaders(scopedToken),
    });

    expect(response.statusCode).toBe(200);
    const emails = (response.json().data as Array<{ email: string }>)
      .map((entry) => entry.email)
      .sort();
    expect(emails).toEqual(['scoped-viewer@tecma.test', 'shared-member@tecma.test']);
  });

  it('GET /v1/users include workspaces con ruolo membership e nome (tenant scope)', async () => {
    const scopedToken = await loginToken('scoped-viewer@tecma.test');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: authHeaders(scopedToken),
    });
    expect(response.statusCode).toBe(200);
    const rows = response.json().data as Array<{
      email: string;
      workspaces: Array<{ workspaceId: string; workspaceName: string; role: string }>;
    }>;
    const shared = rows.find((u) => u.email === 'shared-member@tecma.test');
    expect(shared?.workspaces).toEqual([
      {
        workspaceId: 'ws-alpha',
        workspaceName: 'Workspace Alpha',
        role: 'viewer',
      },
    ]);
    const scoped = rows.find((u) => u.email === 'scoped-viewer@tecma.test');
    expect(scoped?.workspaces).toEqual([
      {
        workspaceId: 'ws-alpha',
        workspaceName: 'Workspace Alpha',
        role: 'admin',
      },
    ]);
  });

  it('GET /v1/users non va in 500 se il documento utente contiene tipi BSON non JSON-native (es. Long)', async () => {
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { email: 'shared-member@tecma.test' },
        { $set: { legacyLongField: Long.fromBigInt(9007199254740993n) } },
      );
    const scopedToken = await loginToken('scoped-viewer@tecma.test');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: authHeaders(scopedToken),
    });
    expect(response.statusCode).toBe(200);
    const rows = response.json().data as Array<{ email: string; legacyLongField?: string }>;
    const shared = rows.find((u) => u.email === 'shared-member@tecma.test');
    expect(shared?.legacyLongField).toBe('9007199254740993');

    await app.mongoDb
      .collection('tz_users')
      .updateOne({ email: 'shared-member@tecma.test' }, { $unset: { legacyLongField: '' } });
  });

  it('GET /v1/users Tecma admin include tutte le membership visibili cross-workspace', async () => {
    const adminToken = await loginToken('admin-hardening@tecma.test');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users',
      headers: authHeaders(adminToken),
    });
    expect(response.statusCode).toBe(200);
    const outsider = (
      response.json().data as Array<{
        email: string;
        workspaces: Array<{ workspaceId: string; role: string }>;
      }>
    ).find((u) => u.email === 'outsider-member@tecma.test');
    expect(outsider?.workspaces).toEqual([
      {
        workspaceId: 'ws-beta',
        workspaceName: 'Workspace Beta',
        role: 'viewer',
      },
    ]);
  });

  it('GET /v1/users arricchisce anche membership legacy keyed by email', async () => {
    const legacyEmail = 'legacy-email-member@tecma.test';
    const legacyUserId = new ObjectId('65f000000000000000000007');
    const membershipId = randomUUID();
    const hash = await bcrypt.hash(seedPassword, 10);
    await app.mongoDb.collection('tz_users').insertOne({
      _id: legacyUserId,
      email: legacyEmail,
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: membershipId,
      workspaceId: 'ws-alpha',
      userId: legacyEmail,
      role: 'viewer',
      createdAt: new Date(),
    });

    const adminToken = await loginToken('admin-hardening@tecma.test');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users?perPage=100',
      headers: authHeaders(adminToken),
    });
    expect(response.statusCode).toBe(200);
    const legacy = (
      response.json().data as Array<{
        email: string;
        workspaces: Array<{ workspaceId: string; workspaceName: string; role: string }>;
      }>
    ).find((u) => u.email === legacyEmail);
    expect(legacy?.workspaces).toEqual([
      {
        workspaceId: 'ws-alpha',
        workspaceName: 'Workspace Alpha',
        role: 'viewer',
      },
    ]);

    await app.mongoDb.collection('tz_user_workspaces').deleteOne({ _id: membershipId });
    await app.mongoDb.collection('tz_users').deleteOne({ _id: legacyUserId });
  });

  it('GET /v1/users/:userId arricchisce workspaces come GET /v1/users (Tecma admin)', async () => {
    const adminToken = await loginToken('admin-hardening@tecma.test');
    const res = await app.inject({
      method: 'GET',
      url: '/v1/users/65f000000000000000000003',
      headers: authHeadersNoBody(adminToken),
    });
    expect(res.statusCode).toBe(200);
    const row = res.json().data as {
      email?: string;
      workspaces?: Array<{ workspaceId: string; workspaceName: string; role: string }>;
    };
    expect(row.email).toBe('shared-member@tecma.test');
    expect(row.workspaces).toEqual([
      {
        workspaceId: 'ws-alpha',
        workspaceName: 'Workspace Alpha',
        role: 'viewer',
      },
    ]);
  });

  it('GET /v1/users/:userId blocca accesso by-id a utenti fuori tenant', async () => {
    const scopedToken = await loginToken('scoped-viewer@tecma.test');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users/65f000000000000000000004',
      headers: authHeadersNoBody(scopedToken),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('Forbidden');
  });

  it('DELETE /v1/users/:userId è riservato a Tecma SuperAdmin anche con users.write', async () => {
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { _id: new ObjectId('65f000000000000000000002') },
        { $set: { permissionsOverride: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_WRITE] } },
      );
    const scopedToken = await loginToken('scoped-viewer@tecma.test');
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/users/65f000000000000000000003',
      headers: authHeadersNoBody(scopedToken),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toContain('Tecma SuperAdmin');
  });

  it('DELETE /v1/users/:userId applica soft-delete, revoca sessioni e scrive audit', async () => {
    const targetLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'delete-target@tecma.test', password: seedPassword },
    });
    expect(targetLogin.statusCode).toBe(200);
    const targetUserId = targetLogin.json().data.user.id as string;

    const sessionsBefore = await app.mongoDb
      .collection('tz_authSessions')
      .countDocuments({ userId: targetUserId });
    expect(sessionsBefore).toBeGreaterThan(0);

    const adminToken = await loginToken('admin-hardening@tecma.test');
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/users/${targetUserId}`,
      headers: authHeadersNoBody(adminToken),
    });
    expect(del.statusCode).toBe(200);

    const target = await app.mongoDb
      .collection('tz_users')
      .findOne({ _id: new ObjectId(targetUserId) });
    expect(target).toMatchObject({
      status: 'deleted',
      deletedBy: '65f000000000000000000001',
    });
    expect(typeof (target as { deletedAt?: unknown }).deletedAt).toBe('string');

    const sessionsAfter = await app.mongoDb
      .collection('tz_authSessions')
      .countDocuments({ userId: targetUserId });
    expect(sessionsAfter).toBe(0);

    const audit = await app.mongoDb.collection('tz_authEvents').findOne({
      eventType: 'users.delete',
      'details.targetUserId': targetUserId,
    });
    expect(audit).not.toBeNull();

    const loginAgain = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'delete-target@tecma.test', password: seedPassword },
    });
    expect(loginAgain.statusCode).toBe(401);
  });

  it("blocca delete dell'ultimo Tecma SuperAdmin attivo", async () => {
    await app.mongoDb.collection('tz_users').updateMany(
      {
        _id: { $ne: new ObjectId('65f000000000000000000006') },
        $or: [{ systemRole: 'tecma_admin' }, { system_role: 'tecma_admin' }],
      },
      { $set: { status: 'disabled' } },
    );

    const soloAdminToken = await loginToken('solo-superadmin@tecma.test');
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/users/65f000000000000000000006',
      headers: authHeadersNoBody(soloAdminToken),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('LastTecmaAdmin');
  });

  it('DELETE /v1/me applica self soft-delete, revoca sessioni, membership, grant e notifica retention', async () => {
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { _id: new ObjectId('65f000000000000000000001') },
        { $set: { status: 'active', systemRole: 'tecma_admin' } },
      );

    const now = new Date().toISOString();
    const hash = await bcrypt.hash(seedPassword, 10);
    const selfId = new ObjectId();
    const workspaceId = `ws-self-delete-${randomUUID()}`;
    await app.mongoDb.collection('tz_users').insertOne({
      _id: selfId,
      email: 'self-delete@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Self Delete Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: selfId.toString(),
      role: 'viewer',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_workspace_user_projects').insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: selfId.toString(),
      projectId: `project-${randomUUID()}`,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_inviteTokens').insertOne({
      _id: randomUUID(),
      userId: selfId.toString(),
      workspaceId,
      tokenHash: 'x'.repeat(64),
      status: 'active',
      createdAt: now,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    } as any);

    const token = await loginToken('self-delete@tecma.test');
    expect(
      await app.mongoDb.collection('tz_authSessions').countDocuments({ userId: selfId.toString() }),
    ).toBeGreaterThan(0);

    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: authHeadersNoBody(token),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.deleted).toBe(true);

    const user = await app.mongoDb.collection('tz_users').findOne({ _id: selfId });
    expect(user).toMatchObject({
      status: 'deleted',
      deletedBy: selfId.toString(),
      deleteReason: 'user_self_delete',
    });
    expect(typeof (user as { purgeEligibleAt?: unknown })?.purgeEligibleAt).toBe('string');
    expect(
      await app.mongoDb.collection('tz_authSessions').countDocuments({ userId: selfId.toString() }),
    ).toBe(0);

    const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
      workspaceId,
      userId: selfId.toString(),
    });
    expect(membership?.status).toBe('deleted');

    const grant = await app.mongoDb.collection('tz_workspace_user_projects').findOne({
      workspaceId,
      userId: selfId.toString(),
    });
    expect(grant?.status).toBe('revoked');

    const notice = await app.mongoDb.collection('tz_lifecycle_notices').findOne({
      entityType: 'user',
      entityId: selfId.toString(),
      eventType: 'user.self_deleted',
    });
    expect(notice).not.toBeNull();
  });

  it("DELETE /v1/me blocca l'ultimo owner/admin attivo di un workspace", async () => {
    const now = new Date().toISOString();
    const hash = await bcrypt.hash(seedPassword, 10);
    const ownerId = new ObjectId();
    const workspaceId = `ws-last-self-delete-${randomUUID()}`;
    await app.mongoDb.collection('tz_users').insertOne({
      _id: ownerId,
      email: 'last-owner-self-delete@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Last Owner Self Delete Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: ownerId.toString(),
      role: 'owner',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const token = await loginToken('last-owner-self-delete@tecma.test');
    const response = await app.inject({
      method: 'DELETE',
      url: '/v1/me',
      headers: authHeadersNoBody(token),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('LastWorkspaceAdmin');
  });

  it('DELETE /v1/me/workspaces/:workspaceId rimuove solo il collegamento workspace', async () => {
    const now = new Date().toISOString();
    const hash = await bcrypt.hash(seedPassword, 10);
    const userId = new ObjectId();
    const workspaceId = `ws-self-leave-${randomUUID()}`;
    await app.mongoDb.collection('tz_users').insertOne({
      _id: userId,
      email: 'self-leave@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Self Leave Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: userId.toString(),
      role: 'viewer',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_workspace_user_projects').insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: userId.toString(),
      projectId: `project-${randomUUID()}`,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const token = await loginToken('self-leave@tecma.test');
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/me/workspaces/${workspaceId}`,
      headers: authHeadersNoBody(token),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.deleted).toBe(true);

    const user = await app.mongoDb.collection('tz_users').findOne({ _id: userId });
    expect(user?.status).toBe('active');
    const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
      workspaceId,
      userId: userId.toString(),
    });
    expect(membership?.status).toBe('deleted');
    const assignment = await app.mongoDb.collection('tz_workspace_user_projects').findOne({
      workspaceId,
      userId: userId.toString(),
    });
    expect(assignment?.status).toBe('revoked');
  });

  it("DELETE /v1/me/workspaces/:workspaceId blocca l'uscita dell'ultimo owner/admin", async () => {
    const now = new Date().toISOString();
    const hash = await bcrypt.hash(seedPassword, 10);
    const ownerId = new ObjectId();
    const workspaceId = `ws-last-self-leave-${randomUUID()}`;
    await app.mongoDb.collection('tz_users').insertOne({
      _id: ownerId,
      email: 'last-owner-self-leave@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Last Owner Self Leave Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: ownerId.toString(),
      role: 'owner',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const token = await loginToken('last-owner-self-leave@tecma.test');
    const response = await app.inject({
      method: 'DELETE',
      url: `/v1/me/workspaces/${workspaceId}`,
      headers: authHeadersNoBody(token),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('LastWorkspaceAdmin');
  });

  // ---------------------------------------------------------------------------
  // Deactivate / Reactivate / User audit log
  // ---------------------------------------------------------------------------

  it('deactivate revoca sessioni e blocca login, reactivate ripristina accesso', async () => {
    // Restore admin-hardening that was set to disabled in the previous last-admin test.
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { _id: new ObjectId('65f000000000000000000001') },
        { $set: { status: 'active', systemRole: 'tecma_admin' } },
      );
    // Seed a fresh deactivatable user.
    const now = new Date().toISOString();
    const hash = await bcrypt.hash(seedPassword, 10);
    const inserted = await app.mongoDb.collection('tz_users').insertOne({
      _id: new ObjectId(),
      email: 'deactivatable@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });
    const deactivatableId = inserted.insertedId.toString();

    // Pre-create a session so we can verify it gets wiped.
    await app.mongoDb.collection('tz_authSessions').insertOne({
      _id: randomUUID(),
      userId: deactivatableId,
      tokenHash: 'dummy-hash',
      createdAt: now,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    } as any);

    const adminToken = await loginToken('admin-hardening@tecma.test');

    // Deactivate.
    const deactivate = await app.inject({
      method: 'POST',
      url: `/v1/users/${deactivatableId}/deactivate`,
      headers: authHeadersNoBody(adminToken),
    });
    expect(deactivate.statusCode).toBe(200);
    expect(deactivate.json().data?.deactivated).toBe(true);
    expect(deactivate.json().data?.sessionsRevoked).toBeGreaterThanOrEqual(1);

    // User record must be deactivated.
    const userDoc = await app.mongoDb.collection('tz_users').findOne({ _id: inserted.insertedId });
    expect((userDoc as { status?: string })?.status).toBe('deactivated');

    // Sessions wiped.
    const sessions = await app.mongoDb
      .collection('tz_authSessions')
      .countDocuments({ userId: deactivatableId });
    expect(sessions).toBe(0);

    // Login must fail.
    const loginAttempt = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'deactivatable@tecma.test', password: seedPassword },
    });
    expect(loginAttempt.statusCode).toBe(401);

    // Double-deactivate must return 409.
    const doubleDeactivate = await app.inject({
      method: 'POST',
      url: `/v1/users/${deactivatableId}/deactivate`,
      headers: authHeadersNoBody(adminToken),
    });
    expect(doubleDeactivate.statusCode).toBe(409);
    expect(doubleDeactivate.json().error.code).toBe('AlreadyDeactivated');

    // Reactivate.
    const reactivate = await app.inject({
      method: 'POST',
      url: `/v1/users/${deactivatableId}/reactivate`,
      headers: authHeadersNoBody(adminToken),
    });
    expect(reactivate.statusCode).toBe(200);
    expect(reactivate.json().data?.reactivated).toBe(true);

    // Login must succeed again.
    const loginAfterReactivate = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'deactivatable@tecma.test', password: seedPassword },
    });
    expect(loginAfterReactivate.statusCode).toBe(200);

    // Audit trail must contain deactivate + reactivate events.
    const auditDeactivate = await app.mongoDb.collection('tz_authEvents').findOne({
      eventType: 'users.deactivate',
      'details.targetUserId': deactivatableId,
    });
    expect(auditDeactivate).not.toBeNull();

    const auditReactivate = await app.mongoDb.collection('tz_authEvents').findOne({
      eventType: 'users.reactivate',
      'details.targetUserId': deactivatableId,
    });
    expect(auditReactivate).not.toBeNull();
  });

  it("blocca deactivate dell'ultimo Tecma SuperAdmin attivo", async () => {
    // Ensure only solo-superadmin is active (disable all other admins for this test).
    await app.mongoDb.collection('tz_users').updateMany(
      {
        _id: { $ne: new ObjectId('65f000000000000000000006') },
        $or: [{ systemRole: 'tecma_admin' }, { system_role: 'tecma_admin' }],
      },
      { $set: { status: 'disabled' } },
    );
    const soloAdminToken = await loginToken('solo-superadmin@tecma.test');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/65f000000000000000000006/deactivate',
      headers: authHeadersNoBody(soloAdminToken),
    });

    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('LastTecmaAdmin');
  });

  it('reactivate restituisce 409 se utente non e deactivated', async () => {
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { _id: new ObjectId('65f000000000000000000001') },
        { $set: { status: 'active', systemRole: 'tecma_admin' } },
      );
    const adminToken = await loginToken('admin-hardening@tecma.test');
    // shared-member is active (not deactivated).
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/65f000000000000000000003/reactivate',
      headers: authHeadersNoBody(adminToken),
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('NotDeactivated');
  });

  it('GET /v1/users/:userId/audit restituisce eventi per utente autorizzato', async () => {
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { _id: new ObjectId('65f000000000000000000001') },
        { $set: { status: 'active', systemRole: 'tecma_admin' } },
      );
    const adminToken = await loginToken('admin-hardening@tecma.test');
    // Tecma admin can read audit for any user.
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users/65f000000000000000000001/audit',
      headers: authHeadersNoBody(adminToken),
    });
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.json().data)).toBe(true);
  });

  it('GET /v1/users/:userId/audit usa page/perPage e totalDocs reali', async () => {
    const adminToken = await loginToken('admin-hardening@tecma.test');
    const auditOnlyUserId = '66f0000000000000000000aa';

    for (const index of [0, 1, 2]) {
      await app.auditService.authEvent({
        eventType: `users.audit.pagination.${index}`,
        actorUserId: '65f000000000000000000001',
        targetUserId: auditOnlyUserId,
        details: { index },
      });
    }

    const response = await app.inject({
      method: 'GET',
      url: `/v1/users/${auditOnlyUserId}/audit?perPage=2&page=1&sortField=createdAt&sortOrder=desc`,
      headers: authHeadersNoBody(adminToken),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      data: Array<{ eventType: string }>;
      paginationInfo: {
        totalDocs: number;
        page: number;
        perPage: number;
        totalPages: number;
        hasNextPage: boolean;
      };
    };
    expect(body.data).toHaveLength(2);
    expect(body.paginationInfo).toMatchObject({
      totalDocs: 3,
      page: 1,
      perPage: 2,
      totalPages: 2,
      hasNextPage: true,
    });
    expect(body.data.every((event) => event.eventType.startsWith('users.audit.pagination.'))).toBe(
      true,
    );
  });

  it('GET /v1/users/:userId/audit blocca utente non autorizzato', async () => {
    const outsiderToken = await loginToken('outsider-member@tecma.test');
    // outsider tries to read admin audit trail (different workspace).
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users/65f000000000000000000001/audit',
      headers: authHeadersNoBody(outsiderToken),
    });
    expect(response.statusCode).toBe(403);
  });

  it('GET /v1/users/:userId/audit consente a un utente di leggere i propri eventi', async () => {
    const outsiderToken = await loginToken('outsider-member@tecma.test');
    await app.auditService.authEvent({
      eventType: 'users.audit.self',
      actorUserId: '65f000000000000000000004',
      targetUserId: '65f000000000000000000004',
      details: { source: 'self-test' },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/users/65f000000000000000000004/audit?perPage=5',
      headers: authHeadersNoBody(outsiderToken),
    });

    expect(response.statusCode).toBe(200);
    const eventTypes = (response.json().data as Array<{ eventType: string }>).map(
      (event) => event.eventType,
    );
    expect(eventTypes).toContain('users.audit.self');
  });

  it('GET /v1/users/:userId/audit valida userId prima della lettura', async () => {
    const adminToken = await loginToken('admin-hardening@tecma.test');
    const response = await app.inject({
      method: 'GET',
      url: '/v1/users/not-a-valid-object-id/audit',
      headers: authHeadersNoBody(adminToken),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('InvalidUserId');
  });

  it('POST /v1/users/:userId/password-reset valida userId', async () => {
    const adminToken = await loginToken('admin-hardening@tecma.test');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/not-a-valid-object-id/password-reset',
      headers: authHeadersNoBody(adminToken),
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('InvalidUserId');
  });

  it('POST /v1/users/:userId/password-reset blocca owner/admin fuori tenant anche con users.invite', async () => {
    await app.mongoDb.collection('tz_users').updateOne(
      { _id: new ObjectId('65f000000000000000000002') },
      {
        $set: {
          permissionsOverride: [PERMISSIONS.USERS_READ, PERMISSIONS.USERS_INVITE],
          status: 'active',
        },
      },
    );
    const scopedToken = await loginToken('scoped-viewer@tecma.test');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/65f000000000000000000004/password-reset',
      headers: authHeadersNoBody(scopedToken),
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('Forbidden');
  });

  it('POST /v1/users/:userId/password-reset genera token reset, audit e risposta neutra', async () => {
    const adminToken = await loginToken('admin-hardening@tecma.test');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/65f000000000000000000003/password-reset',
      headers: authHeadersNoBody(adminToken),
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual({ requested: true });

    const resetToken = await app.mongoDb.collection('tz_authPasswordResets').findOne({
      userId: '65f000000000000000000003',
    });
    expect(resetToken?.tokenHash).toHaveLength(64);
    expect(resetToken?.token).toBeUndefined();

    const audit = await app.mongoDb.collection('tz_authEvents').findOne({
      eventType: 'users.password-reset',
      'details.targetUserId': '65f000000000000000000003',
    });
    expect(audit).not.toBeNull();
  });

  // ---------------------------------------------------------------------------
  // POST /v1/users — invite flow (caller perspective)
  // ---------------------------------------------------------------------------

  it('POST /v1/users crea utente invited con token invito e membership workspace', async () => {
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { _id: new ObjectId('65f000000000000000000001') },
        { $set: { status: 'active', systemRole: 'tecma_admin' } },
      );

    const now = new Date().toISOString();
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: 'ws-invite-test',
      name: 'Invite Test Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId: 'ws-invite-test',
      userId: '65f000000000000000000001',
      role: 'owner',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const adminToken = await loginToken('admin-hardening@tecma.test');
    const invite = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: authHeaders(adminToken),
      payload: {
        email: 'new-invite@tecma.test',
        fullName: 'New Invited User',
        role: 'collaborator',
        workspaceId: 'ws-invite-test',
      },
    });
    expect(invite.statusCode).toBe(201);
    expect(invite.json().data?.email).toBe('new-invite@tecma.test');
    expect(invite.json().data?.status).toBe('invited');
    expect(invite.json().data?.passwordHash).toBeUndefined();

    // Invite token must be saved.
    const inviteToken = await app.mongoDb
      .collection('tz_inviteTokens')
      .findOne({ userId: invite.json().data._id });
    expect(inviteToken).not.toBeNull();
    expect(inviteToken?.status).toBe('active');

    // Membership must be created in invited state.
    const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
      workspaceId: 'ws-invite-test',
      userId: invite.json().data._id,
    });
    expect(membership).toMatchObject({ status: 'invited', role: 'collaborator' });

    // Invited user cannot log in before accepting invite.
    const loginAttempt = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'new-invite@tecma.test', password: 'anything' },
    });
    expect(loginAttempt.statusCode).toBe(401);
  });

  it('POST /v1/users riusa email esistente senza duplicate-key e genera invito neutro', async () => {
    const now = new Date().toISOString();
    await app.mongoDb.collection('tz_workspaces').updateOne(
      { _id: 'ws-invite-test' },
      {
        $setOnInsert: {
          _id: 'ws-invite-test',
          name: 'Invite Test Workspace',
          status: 'active',
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );
    await app.mongoDb.collection('tz_user_workspaces').updateOne(
      { workspaceId: 'ws-invite-test', userId: '65f000000000000000000001' },
      {
        $setOnInsert: {
          _id: randomUUID(),
          workspaceId: 'ws-invite-test',
          userId: '65f000000000000000000001',
          createdAt: now,
        },
        $set: { role: 'owner', status: 'active', updatedAt: now },
      },
      { upsert: true },
    );
    const adminToken = await loginToken('admin-hardening@tecma.test');
    const mailSpy = vi.spyOn(app.mail, 'sendTemplate').mockResolvedValue(undefined);
    const invite = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: authHeaders(adminToken),
      payload: {
        email: 'shared-member@tecma.test',
        fullName: 'Shared Member',
        role: 'viewer',
        workspaceId: 'ws-invite-test',
      },
    });

    expect(invite.statusCode).toBe(201);
    expect(invite.json().data?.email).toBe('shared-member@tecma.test');
    expect(invite.json().data?.passwordHash).toBeUndefined();

    const duplicates = await app.mongoDb
      .collection('tz_users')
      .countDocuments({ email: 'shared-member@tecma.test' });
    expect(duplicates).toBe(1);

    const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
      workspaceId: 'ws-invite-test',
      userId: invite.json().data._id,
    });
    expect(membership).toMatchObject({ status: 'invited', role: 'viewer' });

    const inviteToken = await app.mongoDb
      .collection('tz_inviteTokens')
      .findOne({ userId: invite.json().data._id, workspaceId: 'ws-invite-test' });
    expect(inviteToken?.tokenHash).toHaveLength(64);
    expect(mailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'shared-member@tecma.test',
        flowKey: 'workspace_invite',
        vars: expect.objectContaining({
          workspaceId: 'ws-invite-test',
          inviteUrl: expect.stringContaining('/invite-accept?token='),
        }),
      }),
    );
  });

  it('POST /v1/users consente a Tecma di creare una nuova identita workspace-scoped con email duplicata', async () => {
    const now = new Date().toISOString();
    await app.mongoDb.collection('tz_workspaces').updateOne(
      { _id: 'ws-beta' },
      {
        $setOnInsert: {
          _id: 'ws-beta',
          name: 'Workspace Beta',
          status: 'active',
          createdAt: now,
        },
        $set: { updatedAt: now },
      },
      { upsert: true },
    );
    const adminToken = await loginToken('admin-hardening@tecma.test');
    const invite = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: authHeaders(adminToken),
      payload: {
        email: 'shared-member@tecma.test',
        fullName: 'Shared Member Duplicate',
        role: 'viewer',
        workspaceId: 'ws-beta',
        createNewIdentity: true,
      },
    });

    expect(invite.statusCode).toBe(201);
    expect(invite.json().data?.email).toBe('shared-member@tecma.test');
    expect(invite.json().data?.homeWorkspaceId).toBe('ws-beta');
    expect(invite.json().data?._id).not.toBe('65f000000000000000000003');

    const duplicates = await app.mongoDb
      .collection('tz_users')
      .find({ email: 'shared-member@tecma.test', status: { $ne: 'deleted' } })
      .toArray();
    expect(duplicates).toHaveLength(2);
  });

  it('POST /v1/users blocca invito se la stessa email e presente su piu identita workspace-scoped', async () => {
    const now = new Date().toISOString();
    const hash = await bcrypt.hash(seedPassword, 10);
    const firstUserId = new ObjectId();
    const secondUserId = new ObjectId();
    await app.mongoDb.collection('tz_users').insertMany([
      {
        _id: firstUserId,
        email: 'ambiguous-invite@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        homeWorkspaceId: 'ws-alpha',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: secondUserId,
        email: 'ambiguous-invite@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        homeWorkspaceId: 'ws-beta',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const adminToken = await loginToken('admin-hardening@tecma.test');
    const invite = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: authHeaders(adminToken),
      payload: {
        email: 'ambiguous-invite@tecma.test',
        fullName: 'Ambiguous Invite',
        role: 'viewer',
        workspaceId: 'ws-invite-test',
      },
    });

    expect(invite.statusCode).toBe(409);
    expect(invite.json().error?.code).toBe('AmbiguousUserIdentity');

    const memberships = await app.mongoDb.collection('tz_user_workspaces').countDocuments({
      workspaceId: 'ws-invite-test',
      userId: { $in: [firstUserId.toString(), secondUserId.toString()] },
    });
    expect(memberships).toBe(0);
  });

  it('POST /v1/users nega invito se caller non e owner/admin del workspace', async () => {
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { _id: new ObjectId('65f000000000000000000001') },
        { $set: { status: 'active', systemRole: 'tecma_admin' } },
      );
    const viewerToken = await loginToken('shared-member@tecma.test');
    const invite = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: authHeaders(viewerToken),
      payload: {
        email: 'denied-invite@tecma.test',
        fullName: 'Denied Invite',
        role: 'viewer',
        workspaceId: 'ws-invite-test',
      },
    });
    // shared-member is a viewer in ws-alpha (different workspace), not owner/admin in ws-invite-test
    expect(invite.statusCode).toBe(403);
  });

  it('deactivate restituisce 404 per userId inesistente', async () => {
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { _id: new ObjectId('65f000000000000000000001') },
        { $set: { status: 'active', systemRole: 'tecma_admin' } },
      );
    const adminToken = await loginToken('admin-hardening@tecma.test');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/000000000000000000000099/deactivate',
      headers: authHeadersNoBody(adminToken),
    });
    expect(response.statusCode).toBe(404);
  });

  it('reactivate restituisce 404 per userId inesistente', async () => {
    const adminToken = await loginToken('admin-hardening@tecma.test');
    const response = await app.inject({
      method: 'POST',
      url: '/v1/users/000000000000000000000099/reactivate',
      headers: authHeadersNoBody(adminToken),
    });
    expect(response.statusCode).toBe(404);
  });

  // ---------------------------------------------------------------------------
  // POST /v1/users/bulk-invite
  // ---------------------------------------------------------------------------

  it('POST /v1/users/bulk-invite invita batch con successes/failures parziali', async () => {
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { _id: new ObjectId('65f000000000000000000001') },
        { $set: { status: 'active', systemRole: 'tecma_admin' } },
      );

    const adminToken = await loginToken('admin-hardening@tecma.test');
    const now = new Date().toISOString();
    await app.mongoDb.collection('tz_users').insertOne({
      _id: new ObjectId(),
      email: 'bulk-existing@tecma.test',
      passwordHash: await bcrypt.hash(seedPassword, 10),
      status: 'active',
      systemRole: 'user',
      homeWorkspaceId: 'ws-beta',
      createdAt: now,
      updatedAt: now,
    });

    // First user in batch is new; second is an existing active user (should reuse).
    const bulk = await app.inject({
      method: 'POST',
      url: '/v1/users/bulk-invite',
      headers: authHeaders(adminToken),
      payload: {
        workspaceId: 'ws-invite-test',
        users: [
          { email: 'bulk-new@tecma.test', fullName: 'Bulk New User', role: 'viewer' },
          {
            email: 'bulk-existing@tecma.test',
            fullName: 'Bulk Existing User',
            role: 'collaborator',
          },
        ],
      },
    });
    expect(bulk.statusCode).toBe(200);
    const { successes, failures } = bulk.json().data;
    expect(successes).toHaveLength(2);
    expect(failures).toHaveLength(0);

    // New user must be in invited state.
    const newUser = await app.mongoDb
      .collection('tz_users')
      .findOne({ email: 'bulk-new@tecma.test' });
    expect(newUser).toMatchObject({ status: 'invited' });

    // Both must have invite tokens.
    const tokens = await app.mongoDb
      .collection('tz_inviteTokens')
      .find({ workspaceId: 'ws-invite-test', status: 'active' })
      .toArray();
    expect(tokens.length).toBeGreaterThanOrEqual(2);

    // Audit event must be written.
    const audit = await app.mongoDb.collection('tz_authEvents').findOne({
      eventType: 'users.bulk_invite',
      'details.workspaceId': 'ws-invite-test',
    });
    expect(audit).not.toBeNull();
    expect((audit as { details?: { succeeded?: number } })?.details?.succeeded).toBe(2);
  });

  it('POST /v1/users/bulk-invite restituisce 403 se caller non e owner/admin del workspace', async () => {
    const viewerToken = await loginToken('shared-member@tecma.test');
    const bulk = await app.inject({
      method: 'POST',
      url: '/v1/users/bulk-invite',
      headers: authHeaders(viewerToken),
      payload: {
        workspaceId: 'ws-invite-test',
        users: [{ email: 'denied-bulk@tecma.test', fullName: 'Denied', role: 'viewer' }],
      },
    });
    expect(bulk.statusCode).toBe(403);
    expect(bulk.json().error?.code).toBe('Forbidden');
  });
});
