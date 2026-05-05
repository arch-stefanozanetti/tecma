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

describe('RBAC roadmap integration', () => {
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

    const ownerId = new ObjectId();
    const viewerId = new ObjectId();
    const outsiderId = new ObjectId();
    await users.insertMany([
      {
        _id: ownerId,
        email: 'rbac-owner@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: viewerId,
        email: 'rbac-viewer@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: outsiderId,
        email: 'rbac-outsider@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const wsHome = 'ws-rbac-home';
    const wsGuest = 'ws-rbac-guest';
    await app.mongoDb.collection('tz_workspaces').insertMany([
      {
        _id: wsHome,
        name: 'Home WS',
        owner_user_id: ownerId.toString(),
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: wsGuest,
        name: 'Guest WS',
        owner_user_id: viewerId.toString(),
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await app.mongoDb.collection('tz_user_workspaces').insertMany([
      {
        _id: randomUUID(),
        workspaceId: wsHome,
        userId: ownerId.toString(),
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: randomUUID(),
        workspaceId: wsHome,
        userId: viewerId.toString(),
        role: 'viewer',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: randomUUID(),
        workspaceId: wsGuest,
        userId: viewerId.toString(),
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const projShared = 'proj-rbac-shared';
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projShared,
      workspaceId: wsHome,
      name: 'Shared',
      code: 'SHR',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId: wsHome,
      projectId: projShared,
      createdAt: now,
    });

    await app.mongoDb.collection('tz_project_access').insertOne({
      _id: randomUUID(),
      project_id: projShared,
      workspace_id: wsGuest,
      role: 'viewer',
      created_at: now,
    });

    await app.mongoDb.collection('tz_clients').insertOne({
      _id: randomUUID(),
      workspaceId: wsHome,
      name: 'Cliente test',
      createdAt: now,
    });
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('GET /v1/projects senza workspaceId non espone tutti i progetti per utente normale', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-outsider@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/projects',
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data as unknown[];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBe(0);
  });

  it('membro workspace guest legge progetto home tramite grant cross-workspace', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-viewer@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/projects/proj-rbac-shared',
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data._id).toBe('proj-rbac-shared');
  });

  it('403 se utente non membro del workspace richiede GET projects con workspaceId altrui', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-outsider@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/projects?workspaceId=ws-rbac-home',
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(403);
  });

  it('workspace owner crea invito con POST /v1/workspaces/:id/invitations', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-owner@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/ws-rbac-home/invitations',
      headers: authHeaders(token),
      payload: {
        email: 'invited-rbac-new@tecma.test',
        fullName: 'Invited User',
        role: 'collaborator',
        projectIds: ['proj-rbac-shared'],
      },
    });
    expect(res.statusCode).toBe(201);
    const row = await app.mongoDb.collection('tz_user_workspaces').findOne({
      workspaceId: 'ws-rbac-home',
      userId: res.json().data.userId as string,
    });
    expect(row).not.toBeNull();
    const assign = await app.mongoDb.collection('tz_workspace_user_projects').findOne({
      workspaceId: 'ws-rbac-home',
      projectId: 'proj-rbac-shared',
      userId: res.json().data.userId as string,
    });
    expect(assign).not.toBeNull();
  });

  it('GET /v1/workspaces/:id/clients restituisce record per workspace', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-owner@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/ws-rbac-home/clients',
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data as { name?: string }[];
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.some((c) => c.name === 'Cliente test')).toBe(true);
  });

  it('POST /v1/users con workspaceId consente owner workspace senza users.invite nel JWT', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-owner@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: authHeaders(token),
      payload: {
        email: 'another-invite-user@tecma.test',
        fullName: 'Another User',
        role: 'viewer',
        workspaceId: 'ws-rbac-home',
      },
    });
    expect(res.statusCode).toBe(201);
  });
});
