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
    await users.insertOne({
      _id: new ObjectId(),
      email: 'projects-empty@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 120_000);

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
    const memberDoc = await app.mongoDb.collection('tz_user_workspaces').findOne({
      workspaceId,
      userId: memberUserId,
    });
    expect(memberDoc?.status).toBe('deleted');

    const deleteWorkspace = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}`,
      headers: authHeadersNoBody(token),
    });
    expect(deleteWorkspace.statusCode).toBe(200);
    expect(deleteWorkspace.json().data.deleted).toBe(true);
    const workspaceDoc = await app.mongoDb
      .collection('tz_workspaces')
      .findOne({ _id: workspaceId });
    expect(workspaceDoc?.status).toBe('deleted');
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
    const secondaryWorkspaceId = `ws-crud-secondary-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Workspace for project CRUD',
      owner_user_id: adminUserId,
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: secondaryWorkspaceId,
      name: 'Secondary workspace for grant revoke',
      owner_user_id: adminUserId,
      mfaRequired: false,
      status: 'active',
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

    // Add a second owner grant on another workspace so we can revoke the first
    // without allowing duplicate active grants for the same project/workspace.
    const grantAccess2 = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/access`,
      headers: authHeaders(token),
      payload: { workspaceId: secondaryWorkspaceId, role: 'owner' },
    });
    expect(grantAccess2.statusCode).toBe(201);

    const revokeAccess = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}/access/${encodeURIComponent(grantId)}`,
      headers: authHeadersNoBody(token),
    });
    expect(revokeAccess.statusCode).toBe(200);
    expect(revokeAccess.json().data.deleted).toBe(true);
    const grantDoc = await app.mongoDb.collection('tz_project_access').findOne({ _id: grantId });
    expect(grantDoc?.status).toBe('deleted');

    const deleteProject = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}`,
      headers: authHeadersNoBody(token),
    });
    expect(deleteProject.statusCode).toBe(200);
    expect(deleteProject.json().data.deleted).toBe(true);
    const projectDoc = await app.mongoDb.collection('tz_projects').findOne({ _id: projectId });
    expect(projectDoc?.status).toBe('deleted');
  });

  it('prevents duplicate active project access grants under concurrent requests', async () => {
    const now = new Date().toISOString();
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const projectId = `proj-race-${randomUUID()}`;
    const workspaceId = `ws-race-${randomUUID()}`;
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId,
      name: 'Race Project',
      code: 'RACE',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Race Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const [first, second] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/v1/projects/${projectId}/access`,
        headers: authHeaders(token),
        payload: { workspaceId, role: 'owner' },
      }),
      app.inject({
        method: 'POST',
        url: `/v1/projects/${projectId}/access`,
        headers: authHeaders(token),
        payload: { workspaceId, role: 'owner' },
      }),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([201, 409]);
    const activeGrants = await app.mongoDb.collection('tz_project_access').countDocuments({
      project_id: projectId,
      workspace_id: workspaceId,
      status: 'active',
    });
    expect(activeGrants).toBe(1);
  });

  it('supports associating and dissociating existing project/workspace links', async () => {
    const now = new Date().toISOString();
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const workspaceId = `ws-link-${randomUUID()}`;
    const projectId = `proj-link-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Workspace Link',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId: `legacy-${randomUUID()}`,
      name: 'Legacy Project',
      code: 'LNK',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const associate = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/projects/associate',
      headers: authHeaders(token),
      payload: { workspaceId, projectId },
    });
    expect(associate.statusCode).toBe(201);
    expect(associate.json().data.associated).toBe(true);

    const linked = await app.mongoDb.collection('tz_workspace_projects').findOne({
      workspaceId,
      projectId,
      status: 'active',
    });
    expect(linked).not.toBeNull();

    const dissociate = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}/projects/${projectId}`,
      headers: authHeadersNoBody(token),
    });
    expect(dissociate.statusCode).toBe(200);
    expect(dissociate.json().data.deleted).toBe(true);
  });

  it('denies project workspace association for non-Tecma workspace owner before topology details leak', async () => {
    const now = new Date().toISOString();
    const ownerId = new ObjectId();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await app.mongoDb.collection('tz_users').insertOne({
      _id: ownerId,
      email: 'ws-owner-cross@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);

    const w1 = `ws-cross-${randomUUID()}`;
    const w2 = `ws-other-${randomUUID()}`;
    const projId = `proj-cross-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertMany([
      { _id: w1, name: 'W1', status: 'active', createdAt: now, updatedAt: now },
      { _id: w2, name: 'W2', status: 'active', createdAt: now, updatedAt: now },
    ] as any);
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId: w1,
      userId: ownerId.toString(),
      role: 'owner',
      createdAt: now,
    } as any);
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projId,
      workspaceId: w2,
      name: 'Foreign',
      code: 'FRN',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ws-owner-cross@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/projects/associate',
      headers: authHeaders(token),
      payload: { workspaceId: w1, projectId: projId },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error?.code).toBe('Forbidden');
  });

  it('denies project billing lifecycle operations to non-Tecma workspace owner', async () => {
    const now = new Date().toISOString();
    const ownerId = new ObjectId();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await app.mongoDb.collection('tz_users').insertOne({
      _id: ownerId,
      email: 'ws-owner-lifecycle@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);

    const workspaceId = `ws-owner-lifecycle-${randomUUID()}`;
    const projectId = `proj-owner-lifecycle-${randomUUID()}`;
    const foreignProjectId = `proj-foreign-lifecycle-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Owner Lifecycle WS',
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
    await app.mongoDb.collection('tz_projects').insertMany([
      {
        _id: projectId,
        workspaceId,
        name: 'Owner Lifecycle Project',
        code: 'OLP',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: foreignProjectId,
        workspaceId: `foreign-${workspaceId}`,
        name: 'Foreign Lifecycle Project',
        code: 'FLP',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ] as any[]);
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId,
      projectId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ws-owner-lifecycle@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const createProject = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: authHeaders(token),
      payload: { workspaceId, name: 'Denied Create', code: 'DCR' },
    });
    expect(createProject.statusCode).toBe(403);

    const associate = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/projects/associate',
      headers: authHeaders(token),
      payload: { workspaceId, projectId: foreignProjectId },
    });
    expect(associate.statusCode).toBe(403);

    const dissociate = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}/projects/${projectId}`,
      headers: authHeadersNoBody(token),
    });
    expect(dissociate.statusCode).toBe(403);

    const suspend = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/suspend`,
      headers: authHeaders(token),
      payload: { reason: 'billing_overdue' },
    });
    expect(suspend.statusCode).toBe(403);

    const deleteProject = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}`,
      headers: authHeadersNoBody(token),
    });
    expect(deleteProject.statusCode).toBe(403);
  });

  it('allows workspace owner to archive and restore a project without delete/suspend powers', async () => {
    const now = new Date().toISOString();
    const ownerId = new ObjectId();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await app.mongoDb.collection('tz_users').insertOne({
      _id: ownerId,
      email: 'ws-owner-archive@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);

    const workspaceId = `ws-owner-archive-${randomUUID()}`;
    const projectId = `proj-owner-archive-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Owner Archive WS',
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
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId,
      name: 'Owner Archivable Project',
      code: 'OAP',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'ws-owner-archive@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const archive = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/archive`,
      headers: authHeaders(token),
      payload: { reason: 'completed' },
    });
    expect(archive.statusCode).toBe(200);

    const archived = await app.mongoDb.collection('tz_projects').findOne({ _id: projectId });
    expect(archived?.status).toBe('archived');

    const restore = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/restore`,
      headers: authHeaders(token),
      payload: { reason: 'manual' },
    });
    expect(restore.statusCode).toBe(200);
    const restored = await app.mongoDb.collection('tz_projects').findOne({ _id: projectId });
    expect(restored?.status).toBe('active');
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
    const assignmentDoc = await app.mongoDb.collection('tz_workspace_user_projects').findOne({
      workspaceId,
      userId: memberUserId,
      projectId,
    });
    expect(assignmentDoc?.status).toBe('deleted');

    const delAgain = await app.inject({
      method: 'DELETE',
      url: `/v1/workspaces/${workspaceId}/members/${encodeURIComponent(memberUserId)}/projects/${encodeURIComponent(projectId)}`,
      headers: authHeadersNoBody(token),
    });
    expect(delAgain.statusCode).toBe(404);
  });

  it('GET /v1/me/projects restituisce i progetti accessibili via workspace membership', async () => {
    const now = new Date().toISOString();
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    // Seed a workspace, project, and membership.
    const meWsId = `ws-me-${randomUUID()}`;
    const meProjId = `proj-me-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: meWsId,
      name: 'Me Projects WS',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: meProjId,
      workspaceId: meWsId,
      name: 'Me Project',
      code: 'MPR',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId: meWsId,
      projectId: meProjId,
      createdAt: now,
    });
    // admin-crud already has tecma_admin — so should see all active projects.
    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/projects',
      headers: { 'x-api-key': API_KEY, authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data)).toBe(true);
    const ids = (res.json().data as Array<{ _id: string }>).map((p) => p._id);
    expect(ids).toContain(meProjId);
  });

  it('GET /v1/me/projects restituisce lista vuota per utente normale senza grant', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'projects-empty@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/projects?page=1&perPage=10',
      headers: authHeadersNoBody(token),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
    expect(res.json().paginationInfo.totalDocs).toBe(0);
  });

  it('GET /v1/me/projects pagina i progetti accessibili a un utente normale', async () => {
    const now = new Date().toISOString();
    const normalUser = await app.mongoDb
      .collection('tz_users')
      .findOne({ email: 'projects-empty@tecma.test' });
    expect(normalUser?._id).toBeTruthy();

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'projects-empty@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const workspaceId = `ws-normal-me-${randomUUID()}`;
    const projectId = `proj-normal-me-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Normal Me Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId,
      name: 'Normal Me Project',
      code: 'NME',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: String(normalUser?._id),
      role: 'viewer',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId,
      projectId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });

    const res = await app.inject({
      method: 'GET',
      url: '/v1/me/projects?page=1&perPage=5&sortField=name&sortOrder=asc',
      headers: authHeadersNoBody(token),
    });

    expect(res.statusCode).toBe(200);
    expect((res.json().data as Array<{ _id: string }>).map((p) => p._id)).toContain(projectId);
    expect(res.json().paginationInfo.totalDocs).toBeGreaterThanOrEqual(1);
  });

  it('supports project archive / restore lifecycle as tecma_admin', async () => {
    const now = new Date().toISOString();
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    // Create a throwaway workspace + project.
    const archWsId = `ws-arch-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: archWsId,
      name: 'Archive WS',
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });

    const createProject = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: authHeaders(token),
      payload: { workspaceId: archWsId, name: 'Archivable Project', code: 'ARC' },
    });
    expect(createProject.statusCode).toBe(201);
    const projectId = createProject.json().data._id as string;

    // Archive.
    const archiveRes = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/archive`,
      headers: authHeaders(token),
      payload: {},
    });
    expect(archiveRes.statusCode).toBe(200);
    expect(archiveRes.json().data.archived).toBe(true);
    const archivedDoc = await app.mongoDb.collection('tz_projects').findOne({ _id: projectId });
    expect(archivedDoc?.status).toBe('archived');

    // Double-archive → 409 AlreadyArchived.
    const doubleArchive = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/archive`,
      headers: authHeaders(token),
      payload: {},
    });
    expect(doubleArchive.statusCode).toBe(409);
    expect(doubleArchive.json().error?.code).toBe('AlreadyArchived');

    // Restore.
    const restoreRes = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/restore`,
      headers: authHeaders(token),
      payload: {},
    });
    expect(restoreRes.statusCode).toBe(200);
    expect(restoreRes.json().data.restored).toBe(true);
    const restoredDoc = await app.mongoDb.collection('tz_projects').findOne({ _id: projectId });
    expect(restoredDoc?.status).toBe('active');
    expect(restoredDoc?.archivedAt).toBeUndefined();

    // Restore of a non-archived project → 409 NotArchived.
    const restoreAgain = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/restore`,
      headers: authHeaders(token),
      payload: {},
    });
    expect(restoreAgain.statusCode).toBe(409);
    expect(restoreAgain.json().error?.code).toBe('NotArchived');

    const restoreMissing = await app.inject({
      method: 'POST',
      url: `/v1/projects/${randomUUID()}/restore`,
      headers: authHeaders(token),
      payload: {},
    });
    expect(restoreMissing.statusCode).toBe(404);
    expect(restoreMissing.json().error?.code).toBe('ProjectNotFound');
  });

  it('supports Tecma suspend/resume project and hides suspended projects from normal access', async () => {
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const normalUserId = new ObjectId();
    await app.mongoDb.collection('tz_users').insertOne({
      _id: normalUserId,
      email: 'project-suspended-viewer@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);

    const adminToken = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
      })
    ).json().data.accessToken as string;
    const viewerToken = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'project-suspended-viewer@tecma.test', password: 'Password123!' },
      })
    ).json().data.accessToken as string;

    const workspaceId = `ws-suspended-project-${randomUUID()}`;
    const projectId = `proj-suspended-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Suspended Project WS',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: normalUserId.toString(),
      role: 'viewer',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId,
      name: 'Suspended Project',
      code: 'SUS',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId,
      projectId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const beforeSuspend = await app.inject({
      method: 'GET',
      url: '/v1/me/projects',
      headers: authHeadersNoBody(viewerToken),
    });
    expect(beforeSuspend.statusCode).toBe(200);
    expect((beforeSuspend.json().data as Array<{ _id: string }>).map((p) => p._id)).toContain(
      projectId,
    );

    const suspend = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/suspend`,
      headers: authHeaders(adminToken),
      payload: { reason: 'billing_overdue' },
    });
    expect(suspend.statusCode).toBe(200);

    const afterSuspend = await app.inject({
      method: 'GET',
      url: '/v1/me/projects',
      headers: authHeadersNoBody(viewerToken),
    });
    expect(afterSuspend.statusCode).toBe(200);
    expect((afterSuspend.json().data as Array<{ _id: string }>).map((p) => p._id)).not.toContain(
      projectId,
    );

    const resume = await app.inject({
      method: 'POST',
      url: `/v1/projects/${projectId}/resume`,
      headers: authHeaders(adminToken),
      payload: { reason: 'manual' },
    });
    expect(resume.statusCode).toBe(200);
    const project = await app.mongoDb.collection('tz_projects').findOne({ _id: projectId });
    expect(project?.status).toBe('active');
  });

  it('workspace suspension blocks project access even when project and membership are active', async () => {
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const normalUserId = new ObjectId();
    await app.mongoDb.collection('tz_users').insertOne({
      _id: normalUserId,
      email: 'workspace-suspended-viewer@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    } as any);

    const adminToken = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
      })
    ).json().data.accessToken as string;
    const viewerToken = (
      await app.inject({
        method: 'POST',
        url: '/v1/auth/login',
        payload: { email: 'workspace-suspended-viewer@tecma.test', password: 'Password123!' },
      })
    ).json().data.accessToken as string;

    const workspaceId = `ws-suspended-access-${randomUUID()}`;
    const projectId = `proj-parent-suspended-${randomUUID()}`;
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Suspended Access WS',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: normalUserId.toString(),
      role: 'viewer',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId,
      name: 'Parent Suspended Project',
      code: 'PSP',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId,
      projectId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);

    const suspendWorkspace = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/suspend`,
      headers: authHeaders(adminToken),
      payload: { reason: 'billing_overdue' },
    });
    expect(suspendWorkspace.statusCode).toBe(200);

    const projects = await app.inject({
      method: 'GET',
      url: '/v1/me/projects',
      headers: authHeadersNoBody(viewerToken),
    });
    expect(projects.statusCode).toBe(200);
    expect((projects.json().data as Array<{ _id: string }>).map((p) => p._id)).not.toContain(
      projectId,
    );
  });

  it('DELETE /v1/projects/:id/access/:grantId blocca rimozione ultimo admin grant', async () => {
    const now = new Date().toISOString();
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const guardProjId = `proj-guard-${randomUUID()}`;
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: guardProjId,
      workspaceId: 'ws-guard',
      name: 'Guard Project',
      code: 'GRD',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspaces').updateOne(
      { _id: 'ws-guard' },
      {
        $set: {
          name: 'Guard Workspace',
          status: 'active',
          updatedAt: now,
        },
        $setOnInsert: {
          _id: 'ws-guard',
          createdAt: now,
        },
      },
      { upsert: true },
    );
    const grantRes = await app.inject({
      method: 'POST',
      url: `/v1/projects/${guardProjId}/access`,
      headers: {
        'x-api-key': API_KEY,
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: { workspaceId: 'ws-guard', role: 'owner' },
    });
    expect(grantRes.statusCode).toBe(201);
    const onlyGrantId = grantRes.json().data._id as string;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${guardProjId}/access/${encodeURIComponent(onlyGrantId)}`,
      headers: { 'x-api-key': API_KEY, authorization: `Bearer ${token}` },
    });
    expect(deleteRes.statusCode).toBe(409);
    expect(deleteRes.json().error?.code).toBe('LastProjectAdmin');
  });

  it('supports legacy POC revoke semantics by workspaceId on project access delete', async () => {
    const now = new Date().toISOString();
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-crud@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const projectId = `proj-legacy-${randomUUID()}`;
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId: 'ws-legacy-root',
      name: 'Legacy Semantic Project',
      code: 'LGC',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    } as any);
    await app.mongoDb.collection('tz_project_access').insertMany([
      {
        _id: randomUUID(),
        project_id: projectId,
        workspace_id: 'ws-legacy-a',
        role: 'owner',
        status: 'active',
        created_at: now,
      },
      {
        _id: randomUUID(),
        project_id: projectId,
        workspace_id: 'ws-legacy-b',
        role: 'owner',
        status: 'active',
        created_at: now,
      },
    ] as any[]);

    const revokeByWorkspace = await app.inject({
      method: 'DELETE',
      url: `/v1/projects/${projectId}/access/ws-legacy-a`,
      headers: { 'x-api-key': API_KEY, authorization: `Bearer ${token}` },
    });
    expect(revokeByWorkspace.statusCode).toBe(200);
    expect(revokeByWorkspace.json().data.deletedCount).toBe(1);

    const activeOwners = await app.mongoDb.collection('tz_project_access').countDocuments({
      project_id: projectId,
      role: 'owner',
      status: 'active',
    } as any);
    expect(activeOwners).toBe(1);
  });
});
