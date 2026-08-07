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
let userAId: string;
const userBEmail = 'user-b@tecma.test';
let isolatedProjectId: string;
let emailScopedProjectId: string;
let emailScopedWorkspaceId: string;
let legacyAdminProjectId: string;
let legacyAdminWorkspaceId: string;

describe('security integration', () => {
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

    const insA = await users.insertOne({
      _id: new ObjectId(),
      email: 'user-a@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });
    userAId = insA.insertedId.toString();

    await users.insertOne({
      _id: new ObjectId(),
      email: userBEmail,
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });

    await users.insertOne({
      _id: new ObjectId(),
      email: 'admin-cross@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'tecma_admin',
      createdAt: now,
      updatedAt: now,
    });

    await users.insertOne({
      _id: new ObjectId(),
      email: 'legacy-admin-cross@tecma.test',
      passwordHash: hash,
      status: 'active',
      system_role: 'tecma_admin',
      createdAt: now,
      updatedAt: now,
    });

    isolatedProjectId = 'proj-isolated-1';
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: isolatedProjectId,
      workspaceId: 'ws-x',
      name: 'Isolated',
      code: 'ISO',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_user_projects').insertOne({
      _id: randomUUID(),
      workspaceId: 'ws-x',
      userId: userAId,
      projectId: isolatedProjectId,
      createdAt: now,
    });

    emailScopedWorkspaceId = 'ws-email-access';
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: emailScopedWorkspaceId,
      name: 'Email Scoped WS',
      owner_user_id: userAId,
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId: emailScopedWorkspaceId,
      userId: 'user-a@tecma.test',
      role: 'owner',
      createdAt: now,
    });
    emailScopedProjectId = 'proj-email-access-1';
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: emailScopedProjectId,
      workspaceId: emailScopedWorkspaceId,
      name: 'Email Scoped Project',
      code: 'EMS',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_user_projects').insertOne({
      _id: randomUUID(),
      workspaceId: emailScopedWorkspaceId,
      userId: 'user-a@tecma.test',
      projectId: emailScopedProjectId,
      createdAt: now,
    });

    legacyAdminWorkspaceId = 'ws-legacy-project-access';
    legacyAdminProjectId = 'proj-legacy-project-access';
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: legacyAdminWorkspaceId,
      name: 'Legacy Admin Project WS',
      owner_user_id: 'other-user',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: legacyAdminProjectId,
      workspaceId: legacyAdminWorkspaceId,
      name: 'Legacy Admin Project',
      code: 'LAP',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId: legacyAdminWorkspaceId,
      projectId: legacyAdminProjectId,
      createdAt: now,
    });
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('projects-by-email forbids querying another user email for normal user', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'user-a@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/session/projects-by-email',
      headers: authHeaders(token),
      payload: { email: userBEmail },
    });
    expect(res.statusCode).toBe(403);
  });

  it('projects-by-email per Tecma admin ritorna lista vuota per email inesistente senza leak', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-cross@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/session/projects-by-email?perPage=5',
      headers: authHeaders(token),
      payload: { email: 'missing-user@tecma.test', workspaceId: emailScopedWorkspaceId },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      data: [],
      paginationInfo: { totalDocs: 0, page: 1, perPage: 5 },
    });
  });

  it('projects-by-email per Tecma admin legge i progetti di un utente esistente con paginazione reale', async () => {
    await app.mongoDb.collection('tz_workspace_user_projects').insertOne({
      _id: randomUUID(),
      workspaceId: emailScopedWorkspaceId,
      userId: userAId,
      projectId: emailScopedProjectId,
      createdAt: new Date().toISOString(),
    });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-cross@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/session/projects-by-email?sortField=projectId&sortOrder=asc&perPage=10',
      headers: authHeaders(token),
      payload: { email: 'user-a@tecma.test', workspaceId: emailScopedWorkspaceId },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      data: Array<{ projectId: string }>;
      paginationInfo: { totalDocs: number; perPage: number };
    };
    expect(body.data.map((row) => row.projectId)).toContain(emailScopedProjectId);
    expect(body.paginationInfo.totalDocs).toBeGreaterThanOrEqual(1);
    expect(body.paginationInfo.perPage).toBe(10);
  });

  it('non-admin without assignment cannot read project', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: userBEmail, password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${isolatedProjectId}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(403);
  });

  it('assigned-scope member can only read explicitly assigned active projects', async () => {
    const now = new Date().toISOString();
    const wsId = 'ws-assigned-scope';
    const assignedProjectId = 'proj-assigned-scope-allowed';
    const siblingProjectId = 'proj-assigned-scope-denied';
    const revokedProjectId = 'proj-assigned-scope-revoked';

    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: wsId,
      name: 'Assigned Scope WS',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId: wsId,
      userId: userBEmail,
      role: 'viewer',
      accessScope: 'assigned',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    for (const projectId of [assignedProjectId, siblingProjectId, revokedProjectId]) {
      await app.mongoDb.collection('tz_projects').insertOne({
        _id: projectId,
        workspaceId: wsId,
        name: projectId,
        code: projectId.slice(-3).toUpperCase(),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
      await app.mongoDb.collection('tz_workspace_projects').insertOne({
        _id: randomUUID(),
        workspaceId: wsId,
        projectId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });
    }

    await app.mongoDb.collection('tz_workspace_user_projects').insertMany([
      {
        _id: randomUUID(),
        workspaceId: wsId,
        userId: userBEmail,
        projectId: assignedProjectId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: randomUUID(),
        workspaceId: wsId,
        userId: userBEmail,
        projectId: revokedProjectId,
        status: 'revoked',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: userBEmail, password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const list = await app.inject({
      method: 'GET',
      url: `/v1/projects?workspaceId=${wsId}`,
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    const listedIds = (list.json().data as Array<{ _id: string }>).map((p) => p._id);
    expect(listedIds).toEqual([assignedProjectId]);

    const assigned = await app.inject({
      method: 'GET',
      url: `/v1/projects/${assignedProjectId}`,
      headers: authHeaders(token),
    });
    expect(assigned.statusCode).toBe(200);

    const sibling = await app.inject({
      method: 'GET',
      url: `/v1/projects/${siblingProjectId}`,
      headers: authHeaders(token),
    });
    expect(sibling.statusCode).toBe(403);

    const revoked = await app.inject({
      method: 'GET',
      url: `/v1/projects/${revokedProjectId}`,
      headers: authHeaders(token),
    });
    expect(revoked.statusCode).toBe(403);
  });

  it('POST /v1/projects richiede ruolo Tecma (non basta projects.read di base)', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: userBEmail, password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: authHeaders(token),
      payload: {
        workspaceId: emailScopedWorkspaceId,
        name: 'Nuovo progetto',
        code: 'NOP',
      },
    });
    expect(res.statusCode).toBe(403);
    expect(String(res.json().error?.message ?? '')).toMatch(/Tecma admin required/i);
  });

  it('tecma_admin can read project without membership row', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-cross@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${isolatedProjectId}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.code).toBe('ISO');
  });

  it('legacy system_role tecma_admin lists workspace projects without membership row', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'legacy-admin-cross@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects?workspaceId=${legacyAdminWorkspaceId}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const ids = (res.json().data as Array<{ _id: string }>).map((p) => p._id);
    expect(ids).toContain(legacyAdminProjectId);
  });

  it('GET user by id richiede users.read per utente standard', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'user-a@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: `/v1/users/${userAId}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(403);
  });

  it('resolves workspace/project access when membership is keyed by email', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'user-a@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const workspaceRes = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${emailScopedWorkspaceId}`,
      headers: authHeaders(token),
    });
    expect(workspaceRes.statusCode).toBe(200);
    expect(workspaceRes.json().data._id).toBe(emailScopedWorkspaceId);

    const projectRes = await app.inject({
      method: 'GET',
      url: `/v1/projects/${emailScopedProjectId}`,
      headers: authHeaders(token),
    });
    expect(projectRes.statusCode).toBe(200);
    expect(projectRes.json().data._id).toBe(emailScopedProjectId);
  });
});
