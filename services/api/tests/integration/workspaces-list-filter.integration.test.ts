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

describe('GET /v1/workspaces membership filter', () => {
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

    await users.insertOne({
      _id: new ObjectId(),
      email: 'admin-list@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'tecma_admin',
      createdAt: now,
      updatedAt: now,
    });

    await users.insertOne({
      _id: new ObjectId(),
      email: 'member-list@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });

    await users.insertOne({
      _id: new ObjectId(),
      email: 'nomember-list@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });

    await users.insertOne({
      _id: new ObjectId(),
      email: 'superadmin-list@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'tecma_superadmin',
      createdAt: now,
      updatedAt: now,
    });

    await users.insertOne({
      _id: new ObjectId(),
      email: 'legacy-admin-list@tecma.test',
      passwordHash: hash,
      status: 'active',
      system_role: 'tecma_admin',
      isTecmaAdmin: true,
      createdAt: now,
      updatedAt: now,
    });
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('tecma_admin vede tutti i workspace', async () => {
    const wsA = `ws-a-${randomUUID()}`;
    const wsB = `ws-b-${randomUUID()}`;
    const now = new Date().toISOString();
    await app.mongoDb.collection('tz_workspaces').insertMany([
      {
        _id: wsA,
        name: 'A',
        owner_user_id: 'x',
        mfaRequired: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: wsB,
        name: 'B',
        owner_user_id: 'x',
        mfaRequired: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-list@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const list = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    const ids = (list.json().data as Array<{ _id: string }>).map((w) => w._id);
    expect(ids).toContain(wsA);
    expect(ids).toContain(wsB);

    await app.mongoDb.collection('tz_workspaces').deleteMany({ _id: { $in: [wsA, wsB] } });
  });

  it('tecma_superadmin vede tutti i workspace (stesso trattamento di tecma_admin)', async () => {
    const wsX = `ws-sa-x-${randomUUID()}`;
    const wsY = `ws-sa-y-${randomUUID()}`;
    const now = new Date().toISOString();
    await app.mongoDb.collection('tz_workspaces').insertMany([
      {
        _id: wsX,
        name: 'SX',
        owner_user_id: 'x',
        mfaRequired: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: wsY,
        name: 'SY',
        owner_user_id: 'x',
        mfaRequired: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'superadmin-list@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const list = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    const ids = (list.json().data as Array<{ _id: string }>).map((w) => w._id);
    expect(ids).toContain(wsX);
    expect(ids).toContain(wsY);

    await app.mongoDb.collection('tz_workspaces').deleteMany({ _id: { $in: [wsX, wsY] } });
  });

  it('utente legacy system_role=tecma_admin vede tutti i workspace senza membership', async () => {
    const wsLegacy = `ws-legacy-admin-${randomUUID()}`;
    const now = new Date().toISOString();
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: wsLegacy,
      name: 'Legacy Admin Visible',
      owner_user_id: 'x',
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'legacy-admin-list@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const list = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    expect((list.json().data as Array<{ _id: string }>).some((w) => w._id === wsLegacy)).toBe(true);

    await app.mongoDb.collection('tz_workspaces').deleteOne({ _id: wsLegacy });
  });

  it('utente normale vede solo i workspace con membership', async () => {
    const memberLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'member-list@tecma.test', password: 'Password123!' },
    });
    const memberUserId = memberLogin.json().data.user.id as string;

    const wsIn = `ws-in-${randomUUID()}`;
    const wsOut = `ws-out-${randomUUID()}`;
    const now = new Date().toISOString();

    await app.mongoDb.collection('tz_workspaces').insertMany([
      {
        _id: wsIn,
        name: 'Inside',
        owner_user_id: memberUserId,
        mfaRequired: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: wsOut,
        name: 'Outside',
        owner_user_id: 'other',
        mfaRequired: false,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId: wsIn,
      userId: memberUserId,
      role: 'collaborator',
      createdAt: now,
    });

    const token = memberLogin.json().data.accessToken as string;
    const list = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    const rows = list.json().data as Array<{ _id: string }>;
    const ids = rows.map((w) => w._id);
    expect(ids).toContain(wsIn);
    expect(ids).not.toContain(wsOut);

    await app.mongoDb.collection('tz_user_workspaces').deleteMany({ workspaceId: { $in: [wsIn] } });
    await app.mongoDb.collection('tz_workspaces').deleteMany({ _id: { $in: [wsIn, wsOut] } });
  });

  it('utente normale vede workspace se membership ha userId come ObjectId (legacy)', async () => {
    const memberLogin = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'member-list@tecma.test', password: 'Password123!' },
    });
    const memberUserId = memberLogin.json().data.user.id as string;

    const wsOid = `ws-oid-${randomUUID()}`;
    const now = new Date().toISOString();

    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: wsOid,
      name: 'OID membership',
      owner_user_id: memberUserId,
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });

    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId: wsOid,
      userId: new ObjectId(memberUserId),
      role: 'collaborator',
      createdAt: now,
    });

    const token = memberLogin.json().data.accessToken as string;
    const list = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    const rows = list.json().data as Array<{ _id: string }>;
    expect(rows.some((w) => w._id === wsOid)).toBe(true);

    await app.mongoDb
      .collection('tz_user_workspaces')
      .deleteMany({ workspaceId: { $in: [wsOid] } });
    await app.mongoDb.collection('tz_workspaces').deleteMany({ _id: wsOid });
  });

  it('utente senza membership vede lista vuota anche se esistono workspace', async () => {
    const wsOnly = `ws-orphan-${randomUUID()}`;
    const now = new Date().toISOString();
    await app.mongoDb.collection('tz_workspaces').insertOne({
      _id: wsOnly,
      name: 'No membership',
      owner_user_id: 'x',
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'nomember-list@tecma.test', password: 'Password123!' },
    });
    expect(login.statusCode).toBe(200);
    const token = login.json().data.accessToken as string;

    const list = await app.inject({
      method: 'GET',
      url: '/v1/workspaces',
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    const rows = list.json().data as unknown[];
    expect(rows.length).toBe(0);

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${wsOnly}`,
      headers: authHeaders(token),
    });
    expect(detail.statusCode).toBe(403);

    await app.mongoDb.collection('tz_workspaces').deleteOne({ _id: wsOnly });
  });
});
