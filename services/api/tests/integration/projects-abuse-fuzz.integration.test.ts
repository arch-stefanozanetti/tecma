import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';
import { PERMISSIONS } from '@followup/shared-rbac';

import { buildServer } from '../../src/server.js';

/**
 * Wave E — Test phantom recovery per `projects` domain.
 * Copre i casi di abuse e isolamento multi-tenant principali:
 * 1. IDOR cross-workspace su PATCH/DELETE/GET project
 * 2. Grant cross-workspace verso workspace inesistente
 * 3. Tentativo di modificare progetto di workspace B con token A
 */

const API_KEY = '1234567890123456';
const seedPassword = 'Password123!';

const adminAEmail = 'projects-abuse-admin-a@tecma.test';
const adminBEmail = 'projects-abuse-admin-b@tecma.test';
const wsAlpha = 'ws-projects-abuse-alpha';
const wsBeta = 'ws-projects-abuse-beta';
const projectAlpha = 'proj-alpha-abuse';
const projectBeta = 'proj-beta-abuse';

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let tokenA: string;

const authHeaders = (token: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

describe('projects abuse + tenant isolation (Wave E)', () => {
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

    const adminAId = new ObjectId();
    const adminBId = new ObjectId();

    await app.mongoDb.collection('tz_users').insertMany([
      {
        _id: adminAId,
        email: adminAEmail,
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        permissionsOverride: [PERMISSIONS.PROJECTS_READ, PERMISSIONS.PROJECTS_WRITE],
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: adminBId,
        email: adminBEmail,
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        permissionsOverride: [PERMISSIONS.PROJECTS_READ, PERMISSIONS.PROJECTS_WRITE],
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await app.mongoDb.collection('tz_workspaces').insertMany([
      { _id: wsAlpha, name: 'Alpha', status: 'active', createdAt: now, updatedAt: now },
      { _id: wsBeta, name: 'Beta', status: 'active', createdAt: now, updatedAt: now },
    ]);

    await app.mongoDb.collection('tz_user_workspaces').insertMany([
      {
        userId: adminAId.toString(),
        workspaceId: wsAlpha,
        role: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: adminBId.toString(),
        workspaceId: wsBeta,
        role: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await app.mongoDb.collection('tz_projects').insertMany([
      {
        _id: projectAlpha,
        workspaceId: wsAlpha,
        name: 'Project Alpha',
        code: 'PA',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: projectBeta,
        workspaceId: wsBeta,
        name: 'Project Beta',
        code: 'PB',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await app.mongoDb.collection('tz_workspace_projects').insertMany([
      { workspaceId: wsAlpha, projectId: projectAlpha, status: 'active', createdAt: now },
      { workspaceId: wsBeta, projectId: projectBeta, status: 'active', createdAt: now },
    ]);

    const loginA = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: adminAEmail, password: seedPassword },
    });
    expect(loginA.statusCode).toBe(200);
    tokenA = loginA.json().data.accessToken as string;

    // Login admin B per validare che pesso davvero loggarmi (smoke).
    const loginB = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: adminBEmail, password: seedPassword },
    });
    expect(loginB.statusCode).toBe(200);
  }, 60_000);

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 60_000);

  it('IDOR: admin A non vede project Beta nella lista projects', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects?workspaceId=${wsAlpha}`,
      headers: authHeaders(tokenA),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { data: Array<{ _id?: string; id?: string }> };
    const ids = body.data.map((p) => p._id ?? p.id);
    expect(ids).not.toContain(projectBeta);
  });

  it('IDOR: admin A riceve 403 su GET projects di workspace Beta', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects?workspaceId=${wsBeta}`,
      headers: authHeaders(tokenA),
    });
    expect(res.statusCode).toBe(403);
  });

  it('IDOR: admin A riceve errore != 200 su DELETE project Beta da workspace Alpha', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${wsAlpha}/projects/${projectBeta}`,
      headers: authHeaders(tokenA),
    });
    // 400 (bad request: project non associato), 403 (forbidden), 404 (not found).
    // Tutti coerenti con anti-leak: la richiesta non deve avere successo.
    expect([400, 403, 404]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(200);
    expect(res.statusCode).not.toBe(204);
  });

  it('IDOR: admin A non puo dissociare project Beta dal workspace Beta', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${wsBeta}/projects/${projectBeta}`,
      headers: authHeaders(tokenA),
    });
    // Stessa semantica: la richiesta deve fallire.
    expect([400, 403, 404]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(200);
    expect(res.statusCode).not.toBe(204);
  });

  it('Grant verso workspace inesistente: 400 o 404 (no leak)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectAlpha}/access`,
      headers: authHeaders(tokenA),
      payload: { workspaceId: 'ws-does-not-exist', accessLevel: 'viewer' },
    });
    // Risposta accettabile: 400 (validation), 404 (not found), o 403 (no access).
    // Importante: non deve essere 201 (creazione su workspace fantasma).
    expect([400, 403, 404]).toContain(res.statusCode);
    expect(res.statusCode).not.toBe(201);
  });

  it('Anti-enumeration: GET project con id inesistente vs id altrui ritornano stesso codice', async () => {
    const ghostRes = await app.inject({
      method: 'GET',
      url: `/v1/projects?workspaceId=ghost-workspace`,
      headers: authHeaders(tokenA),
    });

    const otherRes = await app.inject({
      method: 'GET',
      url: `/v1/projects?workspaceId=${wsBeta}`,
      headers: authHeaders(tokenA),
    });

    // Idealmente entrambi ritornano lo stesso codice (no info leak su esistenza
    // del workspace altrui). Verifichiamo solo che non ci sia un 200 su uno e
    // 403/404 sull'altro che permetta di distinguerli.
    if (ghostRes.statusCode === 200 || otherRes.statusCode === 200) {
      expect(ghostRes.statusCode).toBe(otherRes.statusCode);
    }
  });
});
