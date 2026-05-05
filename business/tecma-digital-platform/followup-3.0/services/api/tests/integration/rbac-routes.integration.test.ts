import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';
import { ALL_PERMISSION_IDS, PERMISSION_WILDCARD, PERMISSIONS } from '@followup/shared-rbac';

import { buildServer } from '../../src/server.js';

const API_KEY = '1234567890123456';

const authHeaders = (accessToken: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${accessToken}`,
  'content-type': 'application/json',
});

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let adminId: ObjectId;
let normalUserId: ObjectId;
let targetUserId: ObjectId;

describe('RBAC routes integration', () => {
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
    const hash = await bcrypt.hash('Password123!', 10);

    adminId = new ObjectId();
    normalUserId = new ObjectId();
    targetUserId = new ObjectId();
    await users.insertMany([
      {
        _id: adminId,
        email: 'rbac-tecma-admin@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'tecma_admin',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: normalUserId,
        email: 'rbac-normal@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: targetUserId,
        email: 'rbac-target@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await app.mongoDb.collection('tz_roleDefinitions').insertOne({
      _id: new ObjectId(),
      roleKey: 'collaborator',
      permissions: [PERMISSIONS.PROJECTS_READ, PERMISSIONS.CLIENTS_READ],
      label: 'Custom collaborator',
      createdAt: now,
      updatedAt: now,
    });
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

  describe('GET /v1/rbac/permission-catalog', () => {
    it('ritorna gruppi modulo con permessi (richiede users.read)', async () => {
      const token = await loginAs('rbac-tecma-admin@tecma.test');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/rbac/permission-catalog',
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
      const groups = res.json().data.groups as Array<{
        module: string;
        permissions: Array<{ id: string }>;
      }>;
      expect(groups.length).toBeGreaterThan(0);
      const all = groups.flatMap((g) => g.permissions.map((p) => p.id));
      expect(all).toContain(PERMISSIONS.USERS_READ);
      expect(all).toContain(PERMISSIONS.PROJECTS_MANAGE);
      expect(all).not.toContain(PERMISSION_WILDCARD);
    });

    it('401 senza Authorization', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/rbac/permission-catalog',
        headers: { 'x-api-key': API_KEY },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /v1/rbac/roles/:roleKey/effective-permissions', () => {
    it('ritorna permessi builtin per ruolo viewer', async () => {
      const token = await loginAs('rbac-tecma-admin@tecma.test');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/rbac/roles/viewer/effective-permissions',
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(data.roleKey).toBe('viewer');
      expect(data.permissions).toContain(PERMISSIONS.PROJECTS_READ);
      expect(data.permissions).not.toContain(PERMISSIONS.PROJECTS_WRITE);
    });

    it('preferisce override DB per ruolo collaborator', async () => {
      const token = await loginAs('rbac-tecma-admin@tecma.test');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/rbac/roles/collaborator/effective-permissions',
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
      const data = res.json().data;
      expect(new Set(data.permissions)).toEqual(
        new Set([PERMISSIONS.CLIENTS_READ, PERMISSIONS.PROJECTS_READ]),
      );
      expect(data.permissions).not.toContain(PERMISSIONS.PROJECTS_WRITE);
    });

    it('400 per roleKey vuoto', async () => {
      const token = await loginAs('rbac-tecma-admin@tecma.test');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/rbac/roles/%20/effective-permissions',
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(400);
    });

    it('ritorna lista vuota per ruolo sconosciuto', async () => {
      const token = await loginAs('rbac-tecma-admin@tecma.test');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/rbac/roles/unknown/effective-permissions',
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.permissions).toEqual([]);
    });
  });

  describe('GET /v1/workspace-roles', () => {
    it('ritorna i 4 ruoli builtin', async () => {
      const token = await loginAs('rbac-tecma-admin@tecma.test');
      const res = await app.inject({
        method: 'GET',
        url: '/v1/workspace-roles',
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
      const roles = res.json().data as Array<{ roleKey: string }>;
      expect(roles.map((r) => r.roleKey)).toEqual(['owner', 'admin', 'collaborator', 'viewer']);
    });
  });

  describe('PATCH /v1/users/:userId con permissionsOverride', () => {
    it('tecma_admin puo grant wildcard *', async () => {
      const token = await loginAs('rbac-tecma-admin@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${targetUserId.toString()}`,
        headers: authHeaders(token),
        payload: { permissionsOverride: [PERMISSION_WILDCARD] },
      });
      expect(res.statusCode).toBe(200);
      const user = res.json().data;
      expect(user.permissionsOverride).toEqual([PERMISSION_WILDCARD]);
    });

    it('rifiuta wildcard se attore non e tecma_admin (403)', async () => {
      const adminToken = await loginAs('rbac-tecma-admin@tecma.test');
      // grant users.write al normalUser per simulare un actor con permission ma non tecma_admin
      await app.inject({
        method: 'PATCH',
        url: `/v1/users/${normalUserId.toString()}`,
        headers: authHeaders(adminToken),
        payload: { permissionsOverride: [PERMISSIONS.USERS_WRITE, PERMISSIONS.USERS_READ] },
      });

      const normalToken = await loginAs('rbac-normal@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${targetUserId.toString()}`,
        headers: authHeaders(normalToken),
        payload: { permissionsOverride: [PERMISSION_WILDCARD] },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json().error.code).toBe('WildcardPermissionRequiresAdmin');
    });

    it('400 per permission id sconosciuto', async () => {
      const token = await loginAs('rbac-tecma-admin@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${targetUserId.toString()}`,
        headers: authHeaders(token),
        payload: { permissionsOverride: ['fake.permission'] },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error.code).toBe('UnknownPermissionId');
    });

    it('persiste permissionsOverride deduplicato e include nei JWT al re-login', async () => {
      const adminToken = await loginAs('rbac-tecma-admin@tecma.test');
      const overrideRes = await app.inject({
        method: 'PATCH',
        url: `/v1/users/${targetUserId.toString()}`,
        headers: authHeaders(adminToken),
        payload: {
          permissionsOverride: [
            PERMISSIONS.USERS_INVITE,
            PERMISSIONS.USERS_INVITE,
            PERMISSIONS.PROJECTS_MANAGE,
          ],
        },
      });
      expect(overrideRes.statusCode).toBe(200);
      const updated = overrideRes.json().data;
      expect(updated.permissionsOverride).toEqual([
        PERMISSIONS.USERS_INVITE,
        PERMISSIONS.PROJECTS_MANAGE,
      ]);

      const targetLogin = await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'rbac-target@tecma.test', password: 'Password123!' },
      });
      const claims = targetLogin.json().data.user;
      expect(claims.permissions).toContain(PERMISSIONS.USERS_INVITE);
      expect(claims.permissions).toContain(PERMISSIONS.PROJECTS_MANAGE);
    });
  });

  it('catalogo include tutti gli ID di shared-rbac (sanity)', () => {
    expect(ALL_PERMISSION_IDS).toContain(PERMISSIONS.AUDIT_READ);
    expect(ALL_PERMISSION_IDS.length).toBeGreaterThan(20);
  });
});
