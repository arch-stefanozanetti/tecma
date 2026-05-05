import { randomUUID } from 'node:crypto';

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

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let targetUserId: string;
let soloAdminId: string;

async function loginToken(email: string): Promise<string> {
  const login = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: 'Password123!' },
  });
  expect(login.statusCode).toBe(200);
  return login.json().data.accessToken as string;
}

describe('workspaces permissions integration', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;

    app = await buildServer();
    app.get(
      '/v1/test/permissions-any',
      {
        preHandler: [app.authenticate, app.requireAnyPermission(['projects.admin'])],
      },
      async () => ({ data: { ok: true } }),
    );
    app.get(
      '/v1/test/workspace-access-missing-param',
      {
        preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      },
      async () => ({ data: { ok: true } }),
    );
    app.get(
      '/v1/test/workspace-access-no-auth',
      {
        preHandler: [app.requireCanAccessWorkspace()],
      },
      async () => ({ data: { ok: true } }),
    );
    app.get(
      '/v1/test/project-access-missing-param',
      {
        preHandler: [app.authenticate, app.requireCanAccessProject()],
      },
      async () => ({ data: { ok: true } }),
    );
    app.get(
      '/v1/test/project-access-no-auth/:projectId',
      {
        preHandler: [app.requireCanAccessProject()],
      },
      async () => ({ data: { ok: true } }),
    );
    const users = app.mongoDb.collection('tz_users');
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);

    const target = new ObjectId();
    targetUserId = target.toString();
    const soloAdmin = new ObjectId();
    soloAdminId = soloAdmin.toString();
    await users.insertMany([
      {
        _id: new ObjectId(),
        email: 'admin-perm@tecma.test',
        passwordHash,
        status: 'active',
        systemRole: 'tecma_admin',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId(),
        email: 'owner-perm@tecma.test',
        passwordHash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId(),
        email: 'admin-member-perm@tecma.test',
        passwordHash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: new ObjectId(),
        email: 'viewer-perm@tecma.test',
        passwordHash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: soloAdmin,
        email: 'solo-admin-perm@tecma.test',
        passwordHash,
        status: 'active',
        systemRole: 'tecma_admin',
        system_role: 'tecma_admin',
        isTecmaAdmin: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: target,
        email: 'target-role-perm@tecma.test',
        passwordHash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('allows workspace create only to tecma_admin', async () => {
    const adminToken = await loginToken('admin-perm@tecma.test');
    const userToken = await loginToken('owner-perm@tecma.test');

    const createAsAdmin = await app.inject({
      method: 'POST',
      url: '/v1/workspaces',
      headers: authHeaders(adminToken),
      payload: { name: 'Permitted Workspace', mfaRequired: false },
    });
    expect(createAsAdmin.statusCode).toBe(201);

    const createAsUser = await app.inject({
      method: 'POST',
      url: '/v1/workspaces',
      headers: authHeaders(userToken),
      payload: { name: 'Forbidden Workspace', mfaRequired: false },
    });
    expect(createAsUser.statusCode).toBe(403);
    expect(createAsUser.json().error?.message).toMatch(/Tecma admin required/i);
  });

  it('allows patch only to workspace owner/admin or tecma_admin', async () => {
    const now = new Date().toISOString();
    const adminToken = await loginToken('admin-perm@tecma.test');
    const ownerToken = await loginToken('owner-perm@tecma.test');
    const adminMemberToken = await loginToken('admin-member-perm@tecma.test');
    const viewerToken = await loginToken('viewer-perm@tecma.test');

    const adminLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-perm@tecma.test', password: 'Password123!' },
    });
    const ownerLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'owner-perm@tecma.test', password: 'Password123!' },
    });
    const adminMemberLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-member-perm@tecma.test', password: 'Password123!' },
    });
    const viewerLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'viewer-perm@tecma.test', password: 'Password123!' },
    });

    const workspaceId = `ws-permissions-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Permissions Workspace',
      owner_user_id: adminLogin.json().data.user.id,
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });

    await app.mongoDb.collection('tz_user_workspaces').insertMany([
      {
        _id: randomUUID(),
        workspaceId,
        userId: ownerLogin.json().data.user.id,
        role: 'owner',
        createdAt: now,
      },
      {
        _id: randomUUID(),
        workspaceId,
        userId: adminMemberLogin.json().data.user.id,
        role: 'admin',
        createdAt: now,
      },
      {
        _id: randomUUID(),
        workspaceId,
        userId: viewerLogin.json().data.user.id,
        role: 'viewer',
        createdAt: now,
      },
    ]);

    const patchAsOwner = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${workspaceId}`,
      headers: authHeaders(ownerToken),
      payload: { name: 'Owner Updated Workspace' },
    });
    expect(patchAsOwner.statusCode).toBe(200);
    expect(patchAsOwner.json().data.name).toBe('Owner Updated Workspace');

    const patchAsWorkspaceAdmin = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${workspaceId}`,
      headers: authHeaders(adminMemberToken),
      payload: { name: 'Admin Updated Workspace' },
    });
    expect(patchAsWorkspaceAdmin.statusCode).toBe(200);
    expect(patchAsWorkspaceAdmin.json().data.name).toBe('Admin Updated Workspace');

    const patchAsViewer = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${workspaceId}`,
      headers: authHeaders(viewerToken),
      payload: { name: 'Viewer Updated Workspace' },
    });
    expect(patchAsViewer.statusCode).toBe(403);

    const patchAsTecmaAdmin = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${workspaceId}`,
      headers: authHeaders(adminToken),
      payload: { name: 'Superadmin Updated Workspace' },
    });
    expect(patchAsTecmaAdmin.statusCode).toBe(200);
    expect(patchAsTecmaAdmin.json().data.name).toBe('Superadmin Updated Workspace');
  });

  it('enforces requireAnyPermission for non-admin users', async () => {
    const adminToken = await loginToken('admin-perm@tecma.test');
    const userToken = await loginToken('owner-perm@tecma.test');

    const forbiddenUser = await app.inject({
      method: 'GET',
      url: '/v1/test/permissions-any',
      headers: authHeaders(userToken),
    });
    expect(forbiddenUser.statusCode).toBe(403);

    const allowedAdmin = await app.inject({
      method: 'GET',
      url: '/v1/test/permissions-any',
      headers: authHeaders(adminToken),
    });
    expect(allowedAdmin.statusCode).toBe(200);
  });

  it('returns explicit permission errors for missing params and missing auth context', async () => {
    const adminToken = await loginToken('admin-perm@tecma.test');

    const missingWorkspace = await app.inject({
      method: 'GET',
      url: '/v1/test/workspace-access-missing-param',
      headers: authHeaders(adminToken),
    });
    expect(missingWorkspace.statusCode).toBe(400);
    expect(missingWorkspace.json().error?.message).toBe('workspaceId is required');

    const noWorkspaceAuth = await app.inject({
      method: 'GET',
      url: '/v1/test/workspace-access-no-auth',
      headers: { 'x-api-key': API_KEY },
    });
    expect(noWorkspaceAuth.statusCode).toBe(400);

    const missingProject = await app.inject({
      method: 'GET',
      url: '/v1/test/project-access-missing-param',
      headers: authHeaders(adminToken),
    });
    expect(missingProject.statusCode).toBe(400);
    expect(missingProject.json().error?.message).toBe('projectId is required');

    const noProjectAuth = await app.inject({
      method: 'GET',
      url: '/v1/test/project-access-no-auth/proj-no-auth',
      headers: { 'x-api-key': API_KEY },
    });
    expect(noProjectAuth.statusCode).toBe(401);
  });

  it('allows only Tecma SuperAdmin to assign canonical tecma_admin role and writes audit', async () => {
    const adminToken = await loginToken('admin-perm@tecma.test');
    const userToken = await loginToken('owner-perm@tecma.test');

    const forbidden = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${targetUserId}`,
      headers: authHeaders(userToken),
      payload: { systemRole: 'tecma_admin' },
    });
    expect(forbidden.statusCode).toBe(403);

    const allowed = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${targetUserId}`,
      headers: authHeaders(adminToken),
      payload: { systemRole: 'tecma_admin' },
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().data).toMatchObject({
      systemRole: 'tecma_admin',
      system_role: 'tecma_admin',
      isTecmaAdmin: true,
    });
    expect(allowed.json().data.passwordHash).toBeUndefined();

    const audit = await app.mongoDb.collection('tz_authEvents').findOne({
      eventType: 'users.systemRole.update',
      'details.targetUserId': targetUserId,
    });
    expect(audit).not.toBeNull();
  });

  it('prevents a Tecma SuperAdmin from removing itself when it is the last active admin', async () => {
    await app.mongoDb.collection('tz_users').updateMany(
      {
        _id: { $ne: new ObjectId(soloAdminId) },
        $or: [{ systemRole: 'tecma_admin' }, { system_role: 'tecma_admin' }],
      },
      {
        $set: { status: 'disabled' },
      },
    );
    const soloToken = await loginToken('solo-admin-perm@tecma.test');

    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/users/${soloAdminId}`,
      headers: authHeaders(soloToken),
      payload: { systemRole: 'user' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error?.code).toBe('LastTecmaAdmin');
  });

  it('espone audit events solo a Tecma SuperAdmin con filtri platform', async () => {
    await app.mongoDb
      .collection('tz_users')
      .updateOne(
        { email: 'admin-perm@tecma.test' },
        { $set: { status: 'active', systemRole: 'tecma_admin' } },
      );
    const adminToken = await loginToken('admin-perm@tecma.test');
    const userToken = await loginToken('owner-perm@tecma.test');

    await app.auditService.authEvent({
      eventType: 'admin.audit.test',
      actorUserId: soloAdminId,
      workspaceId: 'ws-audit-test',
      targetUserId,
      severity: 'warning',
      traceId: 'trace-audit-test',
    });

    const forbidden = await app.inject({
      method: 'GET',
      url: '/v1/admin/audit-events?workspaceId=ws-audit-test',
      headers: authHeaders(userToken),
    });
    expect(forbidden.statusCode).toBe(403);

    const allowed = await app.inject({
      method: 'GET',
      url: '/v1/admin/audit-events?workspaceId=ws-audit-test&eventType=admin.audit.test',
      headers: authHeaders(adminToken),
    });
    expect(allowed.statusCode).toBe(200);
    expect(allowed.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'admin.audit.test',
          actorUserId: soloAdminId,
          workspaceId: 'ws-audit-test',
          targetUserId,
          traceId: 'trace-audit-test',
        }),
      ]),
    );
  });
});
