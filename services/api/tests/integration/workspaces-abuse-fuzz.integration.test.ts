import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

/**
 * Mitigazioni abuse/replay nel perimetro workspace-adiacente (inviti utente):
 * identita workspace-scoped + risposta 409 ripetibile al POST duplicato nello stesso workspace.
 */
const API_KEY = '1234567890123456';
const workspaceId = 'ws-abuse-fuzz';

const authHeaders = (accessToken: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${accessToken}`,
  'content-type': 'application/json',
});

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let adminId: ObjectId;

async function loginToken(email: string): Promise<string> {
  const login = await app.inject({
    method: 'POST',
    url: '/v1/auth/login',
    payload: { email, password: 'Password123!' },
  });
  expect(login.statusCode).toBe(200);
  return login.json().data.accessToken as string;
}

describe('workspace-adjacent abuse / replay guards', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;

    app = await buildServer();
    const users = app.mongoDb.collection('tz_users');
    const workspaces = app.mongoDb.collection('tz_workspaces');
    const memberships = app.mongoDb.collection('tz_user_workspaces');
    const now = new Date().toISOString();
    const hash = await bcrypt.hash('Password123!', 10);

    adminId = new ObjectId();
    await users.insertOne({
      _id: adminId,
      email: 'admin-abuse@tecma.test',
      passwordHash: hash,
      status: 'active',
      systemRole: 'tecma_admin',
      createdAt: now,
      updatedAt: now,
    });
    await workspaces.insertOne({
      _id: workspaceId,
      name: 'Abuse Fuzz Workspace',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await memberships.insertOne({
      _id: randomUUID(),
      workspaceId,
      userId: adminId.toString(),
      role: 'owner',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }, 120_000);

  afterAll(async () => {
    if (app != null) {
      await app.close();
    }
    if (mongoContext != null) {
      await stopInMemoryMongo(mongoContext);
    }
  }, 120_000);

  it('replay invito stessa email nello stesso workspace → 409 DuplicateWorkspaceEmail', async () => {
    const token = await loginToken('admin-abuse@tecma.test');
    const email = `dup-${randomUUID()}@tecma.test`;
    const body = {
      email,
      fullName: 'Replay Test',
      role: 'viewer',
      workspaceId,
    };

    const first = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: authHeaders(token),
      payload: body,
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/v1/users',
      headers: authHeaders(token),
      payload: body,
    });
    expect(second.statusCode).toBe(409);
    expect(second.json().error?.code).toBe('DuplicateWorkspaceEmail');
  });

  it('rifiuta payload invito workspace con email non valida', async () => {
    const token = await loginToken('admin-abuse@tecma.test');
    const response = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/${workspaceId}/invitations`,
      headers: authHeaders(token),
      payload: { email: 'not-an-email', fullName: 'Bad Payload', role: 'viewer' },
    });
    expect(response.statusCode).toBe(400);
  });
});
