import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

const API_KEY = '1234567890123456';
const PASSWORD = 'Password123!';

const authHeaders = (accessToken: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${accessToken}`,
  'content-type': 'application/json',
});

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;

async function login(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: PASSWORD },
  });
  expect(res.statusCode).toBe(200);
  return res.json().data.accessToken as string;
}

describe('Requests / Trattative integration', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-requests';
    process.env.ALLOWED_WRITE_DB = 'test-requests';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;

    app = await buildServer();
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const adminId = new ObjectId();
    const viewerId = new ObjectId();

    await app.mongoDb.collection('tz_users').insertMany([
      {
        _id: adminId,
        email: 'requests-admin@tecma.test',
        passwordHash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: viewerId,
        email: 'requests-viewer@tecma.test',
        passwordHash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await app.mongoDb.collection('tz_workspaces').insertMany([
      {
        _id: 'ws-req-1',
        name: 'Requests Workspace',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'ws-req-2',
        name: 'Other Workspace',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await app.mongoDb.collection('tz_user_workspaces').insertMany([
      {
        workspaceId: 'ws-req-1',
        userId: adminId.toHexString(),
        role: 'admin',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        workspaceId: 'ws-req-1',
        userId: viewerId.toHexString(),
        role: 'viewer',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await app.mongoDb.collection('tz_projects').insertMany([
      {
        _id: 'proj-req-1',
        workspaceId: 'ws-req-1',
        name: 'Request Project',
        code: 'REQ',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'proj-req-2',
        workspaceId: 'ws-req-2',
        name: 'Other Project',
        code: 'OTH',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await app.mongoDb.collection('tz_clients').insertMany([
      {
        _id: 'client-req-1',
        workspaceId: 'ws-req-1',
        firstName: 'Ada',
        lastName: 'Rossi',
        email: 'ada@example.test',
        status: 'lead',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'client-req-2',
        workspaceId: 'ws-req-2',
        firstName: 'Cross',
        lastName: 'Tenant',
        email: 'cross@example.test',
        status: 'lead',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await app.mongoDb.collection('tz_apartments').insertOne({
      _id: 'apt-req-1',
      workspaceId: 'ws-req-1',
      projectId: 'proj-req-1',
      name: 'Unit Request',
      code: 'UR-1',
      status: 'AVAILABLE',
      mode: 'SELL',
      createdAt: now,
      updatedAt: now,
    });
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 120_000);

  it('creates, queries and updates a request with timeline side effects', async () => {
    const token = await login('requests-admin@tecma.test');

    const create = await app.inject({
      method: 'POST',
      url: '/v1/requests',
      headers: authHeaders(token),
      payload: {
        workspaceId: 'ws-req-1',
        projectId: 'proj-req-1',
        clientId: 'client-req-1',
        apartmentId: 'apt-req-1',
        title: 'Visita attico',
        priority: 'high',
        assignedUserIds: [],
      },
    });
    expect(create.statusCode).toBe(201);
    const requestId = create.json().data._id as string;
    expect(create.json().data.clientName).toBe('Ada Rossi');
    expect(create.json().data.apartmentCode).toBe('UR-1');

    const query = await app.inject({
      method: 'POST',
      url: '/v1/requests/query',
      headers: authHeaders(token),
      payload: { workspaceId: 'ws-req-1', statuses: ['new'], projectIds: ['proj-req-1'] },
    });
    expect(query.statusCode).toBe(200);
    expect(query.json().data).toHaveLength(1);

    const update = await app.inject({
      method: 'PATCH',
      url: `/v1/requests/${requestId}/status`,
      headers: authHeaders(token),
      payload: { status: 'contacted', notes: 'Prima chiamata completata' },
    });
    expect(update.statusCode).toBe(200);
    expect(update.json().data.status).toBe('contacted');

    const timelineRows = await app.mongoDb
      .collection('tz_entity_timeline')
      .find({
        workspaceId: 'ws-req-1',
        entityId: { $in: [requestId, 'client-req-1', 'apt-req-1'] },
      })
      .toArray();
    expect(timelineRows.length).toBeGreaterThanOrEqual(5);
  });

  it('blocks cross-workspace create and write without request update permission', async () => {
    const adminToken = await login('requests-admin@tecma.test');
    const cross = await app.inject({
      method: 'POST',
      url: '/v1/requests',
      headers: authHeaders(adminToken),
      payload: {
        workspaceId: 'ws-req-1',
        projectId: 'proj-req-1',
        clientId: 'client-req-2',
        title: 'Cross tenant',
      },
    });
    expect(cross.statusCode).toBe(400);

    const create = await app.inject({
      method: 'POST',
      url: '/v1/requests',
      headers: authHeaders(adminToken),
      payload: {
        workspaceId: 'ws-req-1',
        projectId: 'proj-req-1',
        clientId: 'client-req-1',
        title: 'Solo lettura',
      },
    });
    expect(create.statusCode).toBe(201);
    const viewerToken = await login('requests-viewer@tecma.test');
    const forbidden = await app.inject({
      method: 'PATCH',
      url: `/v1/requests/${create.json().data._id}/status`,
      headers: authHeaders(viewerToken),
      payload: { status: 'contacted' },
    });
    expect(forbidden.statusCode).toBe(403);
  });
});
