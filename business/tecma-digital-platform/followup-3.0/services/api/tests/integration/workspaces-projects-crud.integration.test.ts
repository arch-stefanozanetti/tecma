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

const authHeadersNoBody = (accessToken: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${accessToken}`,
});

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;

describe('workspaces/projects CRUD integration', () => {
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
    const passwordHash = await bcrypt.hash('Password123!', 10);

    await users.insertOne({
      _id: new ObjectId(),
      email: 'admin-crud@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'tecma_admin',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('supports workspace and member lifecycle as tecma_admin', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const createWorkspace = await app.inject({
      method: 'POST',
      url: '/v1/workspaces',
      headers: authHeaders(token),
      payload: { name: 'CRUD Workspace', mfaRequired: true },
    });
    expect(createWorkspace.statusCode).toBe(201);
    const workspaceId = createWorkspace.json().data._id as string;

    const list = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.json().data)).toBe(true);

    const getWorkspace = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}`,
      headers: authHeaders(token),
    });
    expect(getWorkspace.statusCode).toBe(200);
    expect(getWorkspace.json().data.name).toBe('CRUD Workspace');

    const patchWorkspace = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${workspaceId}`,
      headers: authHeaders(token),
      payload: { name: 'CRUD Workspace Updated', mfaRequired: false },
    });
    expect(patchWorkspace.statusCode).toBe(200);
    expect(patchWorkspace.json().data.name).toBe('CRUD Workspace Updated');

    const memberUserId = `member-${randomUUID()}`;
    const addMember = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/members`,
      headers: authHeaders(token),
      payload: { userId: memberUserId, role: 'viewer' },
    });
    expect(addMember.statusCode).toBe(201);

    const listMembers = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}/members`,
      headers: authHeaders(token),
    });
    expect(listMembers.statusCode).toBe(200);
    expect(Array.isArray(listMembers.json().data)).toBe(true);
    expect(listMembers.json().data.some((m: any) => m.userId === memberUserId)).toBe(true);

    const patchMember = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${workspaceId}/members/${encodeURIComponent(memberUserId)}`,
      headers: authHeaders(token),
      payload: { role: 'collaborator' },
    });
    expect(patchMember.statusCode).toBe(200);
    expect(patchMember.json().data.role).toBe('collaborator');

    const deleteMember = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}/members/${encodeURIComponent(memberUserId)}`,
      headers: authHeadersNoBody(token),
    });
    expect(deleteMember.statusCode).toBe(200);
    expect(deleteMember.json().data.deleted).toBe(true);

    const deleteWorkspace = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}`,
      headers: authHeadersNoBody(token),
    });
    expect(deleteWorkspace.statusCode).toBe(200);
    expect(deleteWorkspace.json().data.deleted).toBe(true);
  });

  it('supports project lifecycle as tecma_admin', async () => {
    const now = new Date().toISOString();
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;
    const adminUserId = login.json().data.user.id as string;

    const workspaceId = `ws-crud-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Workspace for project CRUD',
      owner_user_id: adminUserId,
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });

    const createProject = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: authHeaders(token),
      payload: { workspaceId, name: 'Project CRUD', code: 'PCR' },
    });
    expect(createProject.statusCode).toBe(201);
    const projectId = createProject.json().data._id as string;

    const getProject = await app.inject({
      method: 'GET',
      url: `/v1/projects/${projectId}`,
      headers: authHeaders(token),
    });
    expect(getProject.statusCode).toBe(200);
    expect(getProject.json().data.code).toBe('PCR');

    const patchProject = await app.inject({
      method: 'PATCH',
      url: `/v1/projects/${projectId}`,
      headers: authHeaders(token),
      payload: { name: 'Project CRUD Updated', code: 'PCRU' },
    });
    expect(patchProject.statusCode).toBe(200);
    expect(patchProject.json().data.code).toBe('PCRU');

    const grantAccess = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/access`,
      headers: authHeaders(token),
      payload: { workspaceId, role: 'owner' },
    });
    expect(grantAccess.statusCode).toBe(201);
    const grantId = grantAccess.json().data._id as string;

    const revokeAccess = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}/access/${encodeURIComponent(grantId)}`,
      headers: authHeadersNoBody(token),
    });
    expect(revokeAccess.statusCode).toBe(200);
    expect(revokeAccess.json().data.deleted).toBe(true);

    const deleteProject = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}`,
      headers: authHeadersNoBody(token),
    });
    expect(deleteProject.statusCode).toBe(200);
    expect(deleteProject.json().data.deleted).toBe(true);
  });

  it('supports member ↔ project assignments (tz_workspace_user_projects) as tecma_admin', async () => {
    const now = new Date().toISOString();
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const workspaceId = `ws-assign-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Assignment WS',
      owner_user_id: 'owner-x',
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });

    const memberUserId = `member-assign-${randomUUID()}`;
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: memberUserId,
      role: 'viewer',
      createdAt: now,
    });

    const projectId = `proj-assign-${randomUUID()}`;
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId,
      name: 'Assignable Project',
      code: 'ASN',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId,
      projectId,
      createdAt: now,
    });

    const listBefore = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}/members/${encodeURIComponent(memberUserId)}/projects`,
      headers: authHeadersNoBody(token),
    });
    expect(listBefore.statusCode).toBe(200);
    expect(listBefore.json().data.length).toBe(0);

    const addAssign = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/members/${encodeURIComponent(memberUserId)}/projects`,
      headers: authHeaders(token),
      payload: { projectId },
    });
    expect(addAssign.statusCode).toBe(201);
    expect(addAssign.json().data.projectId).toBe(projectId);

    const dup = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/members/${encodeURIComponent(memberUserId)}/projects`,
      headers: authHeaders(token),
      payload: { projectId },
    });
    expect(dup.statusCode).toBe(409);

    const listAfter = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${workspaceId}/members/${encodeURIComponent(memberUserId)}/projects`,
      headers: authHeadersNoBody(token),
    });
    expect(listAfter.statusCode).toBe(200);
    expect(listAfter.json().data.length).toBe(1);

    const badProject = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/members/${encodeURIComponent(memberUserId)}/projects`,
      headers: authHeaders(token),
      payload: { projectId: 'not-linked-project' },
    });
    expect(badProject.statusCode).toBe(400);

    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}/members/${encodeURIComponent(memberUserId)}/projects/${encodeURIComponent(projectId)}`,
      headers: authHeadersNoBody(token),
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().data.deleted).toBe(true);

    const delAgain = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}/members/${encodeURIComponent(memberUserId)}/projects/${encodeURIComponent(projectId)}`,
      headers: authHeadersNoBody(token),
    });
    expect(delAgain.statusCode).toBe(404);
  });
});
