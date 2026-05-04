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
});

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let demoUserId: string;

describe('api smoke integration', () => {
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
    const ins = await users.insertOne({
      _id: new ObjectId(),
      email: 'smoke@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });
    demoUserId = ins.insertedId.toString();

    const wsId = 'ws-smoke-1';
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: wsId,
      name: 'Smoke WS',
      owner_user_id: demoUserId,
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId: wsId,
      userId: demoUserId,
      role: 'owner',
      createdAt: now,
    });

    const projectId = 'proj-smoke-1';
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId: wsId,
      name: 'Smoke Project',
      code: 'SMK',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId: wsId,
      projectId,
      createdAt: now,
    });
    await app.mongoDb.collection('tz_workspace_user_projects').insertOne({
      _id: randomUUID(),
      workspaceId: wsId,
      userId: demoUserId,
      projectId,
      createdAt: now,
    });
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('login then auth/me, workspaces, projects, session/preferences', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'smoke@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const accessToken = login.json().data.accessToken as string;
    expect(accessToken.length).toBeGreaterThan(20);

    const me = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: authHeaders(accessToken),
    });
    expect(me.statusCode).toBe(200);
    expect(me.json().data.email).toBe('smoke@tecma.test');

    const workspaces = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: authHeaders(accessToken),
    });
    expect(workspaces.statusCode).toBe(200);
    expect(Array.isArray(workspaces.json().data)).toBe(true);
    expect(workspaces.json().data.length).toBeGreaterThanOrEqual(1);

    const projects = await app.inject({
      method: 'GET',
      url: `/v1/projects?workspaceId=ws-smoke-1&userId=${encodeURIComponent(demoUserId)}`,
      headers: authHeaders(accessToken),
    });
    expect(projects.statusCode).toBe(200);
    expect(projects.json().data.length).toBe(1);
    expect(projects.json().data[0].code).toBe('SMK');

    const prefGet = await app.inject({
      method: 'GET',
      url: '/v1/session/preferences',
      headers: authHeaders(accessToken),
    });
    expect(prefGet.statusCode).toBe(200);
    expect(prefGet.json().data).toEqual({ projectIds: [] });

    const prefPost = await app.inject({
      method: 'POST',
      url: '/v1/session/preferences',
      headers: { ...authHeaders(accessToken), 'content-type': 'application/json' },
      payload: { projectIds: ['proj-smoke-1'] },
    });
    expect(prefPost.statusCode).toBe(200);
    expect(prefPost.json().data.projectIds).toEqual(['proj-smoke-1']);

    const refresh = await app.inject({
      method: 'POST',
      url: '/v1/auth/refresh',
      headers: { 'x-api-key': API_KEY, 'content-type': 'application/json' },
      payload: { refreshToken: login.json().data.refreshToken },
    });
    expect(refresh.statusCode).toBe(200);
    expect(refresh.json().data.accessToken.length).toBeGreaterThan(20);
  });

  it('lists projects from workspace when tz_workspace_user_projects has no rows', async () => {
    const now = new Date().toISOString();
    const wsId = 'ws-fallback-1';
    const projectId = 'proj-fallback-1';
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: wsId,
      name: 'Fallback WS',
      owner_user_id: demoUserId,
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId: wsId,
      userId: demoUserId,
      role: 'owner',
      createdAt: now,
    });
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId: wsId,
      name: 'Fallback Project',
      code: 'FB1',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId: wsId,
      projectId,
      createdAt: now,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: 'smoke@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const accessToken = login.json().data.accessToken as string;

    const projects = await app.inject({
      method: 'GET',
      url: `/v1/projects?workspaceId=${wsId}&userId=${encodeURIComponent(demoUserId)}`,
      headers: authHeaders(accessToken),
    });
    expect(projects.statusCode).toBe(200);
    expect(projects.json().data.length).toBe(1);
    expect(projects.json().data[0]._id).toBe(projectId);
    expect(projects.json().data[0].code).toBe('FB1');
  });

  it('lists projects when workspace assignments are keyed by user email', async () => {
    const now = new Date().toISOString();
    const wsId = 'ws-email-identity-1';
    const projectId = 'proj-email-identity-1';
    const emailIdentity = 'smoke@tecma.test';

    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: wsId,
      name: 'Email Identity WS',
      owner_user_id: demoUserId,
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId: wsId,
      userId: emailIdentity,
      role: 'owner',
      createdAt: now,
    });
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: projectId,
      workspaceId: wsId,
      name: 'Email Identity Project',
      code: 'EML',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId: wsId,
      projectId,
      createdAt: now,
    });
    await app.mongoDb.collection('tz_workspace_user_projects').insertOne({
      _id: randomUUID(),
      workspaceId: wsId,
      userId: emailIdentity,
      projectId,
      createdAt: now,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: { email: emailIdentity, password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const accessToken = login.json().data.accessToken as string;

    // Il frontend passa userId dal JWT.sub (ObjectId string), ma in DB le assegnazioni
    // possono essere legacy su email: la route deve risolvere entrambe le identità.
    const projects = await app.inject({
      method: 'GET',
      url: `/v1/projects?workspaceId=${wsId}&userId=${encodeURIComponent(demoUserId)}`,
      headers: authHeaders(accessToken),
    });
    expect(projects.statusCode).toBe(200);
    expect(projects.json().data.length).toBe(1);
    expect(projects.json().data[0]._id).toBe(projectId);
    expect(projects.json().data[0].code).toBe('EML');
  });

  it('rejects protected routes with wrong api key', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'smoke@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;
    const bad = await app.inject({
      method: 'GET',
      url: '/v1/auth/me',
      headers: { authorization: `Bearer ${token}`, 'x-api-key': 'wrong-key____________' },
    });
    expect(bad.statusCode).toBe(401);
  });
});
