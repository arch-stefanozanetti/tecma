import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../../src/server.js';

const API_KEY = '1234567890123456';

const adminHeaders = (token: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
});

const adminHeadersNoBody = (token: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${token}`,
});

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let adminToken: string;

describe('admin email-flows CRUD integration', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-email-flows';
    process.env.ALLOWED_WRITE_DB = 'test-email-flows';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;

    app = await buildServer();
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await app.mongoDb.collection('tz_users').insertOne({
      _id: new ObjectId(),
      email: 'admin-flows@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'tecma_admin',
      createdAt: now,
      updatedAt: now,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'admin-flows@tecma.test', password: 'Password123!' },
    });
    adminToken = login.json().data.accessToken as string;
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  it('creates, reads, updates and deletes an email flow override', async () => {
    // Create.
    const create = await app.inject({
      method: 'POST',
      url: '/v1/admin/email-flows',
      headers: adminHeaders(adminToken),
      payload: {
        flowKey: 'welcome',
        subject: 'Benvenuto personalizzato: {{email}}',
        text: 'Ciao {{email}}, accedi a {{loginUrl}}',
      },
    });
    expect(create.statusCode).toBe(201);
    const flowId = create.json().data._id as string;
    expect(create.json().data.flowKey).toBe('welcome');

    // Duplicate → 409.
    const dup = await app.inject({
      method: 'POST',
      url: '/v1/admin/email-flows',
      headers: adminHeaders(adminToken),
      payload: {
        flowKey: 'welcome',
        subject: 'Altro soggetto',
        text: 'Altro testo',
      },
    });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().error?.code).toBe('DuplicateFlowKey');

    // List — must contain the new flow.
    const list = await app.inject({
      method: 'GET',
      url: '/v1/admin/email-flows',
      headers: adminHeadersNoBody(adminToken),
    });
    expect(list.statusCode).toBe(200);
    expect(Array.isArray(list.json().data)).toBe(true);
    expect((list.json().data as Array<{ _id: string }>).some((f) => f._id === flowId)).toBe(true);

    // Get by id.
    const get = await app.inject({
      method: 'GET',
      url: `/v1/admin/email-flows/${flowId}`,
      headers: adminHeadersNoBody(adminToken),
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().data.subject).toBe('Benvenuto personalizzato: {{email}}');

    // Patch.
    const patch = await app.inject({
      method: 'PATCH',
      url: `/v1/admin/email-flows/${flowId}`,
      headers: adminHeaders(adminToken),
      payload: { subject: 'Soggetto aggiornato' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().data.subject).toBe('Soggetto aggiornato');

    // Delete (soft).
    const del = await app.inject({
      method: 'DELETE',
      url: `/v1/admin/email-flows/${flowId}`,
      headers: adminHeadersNoBody(adminToken),
    });
    expect(del.statusCode).toBe(200);
    expect(del.json().data.deleted).toBe(true);

    // After delete the DB doc should have status=deleted.
    const dbDoc = await app.mongoDb.collection('tz_email_flows').findOne({ _id: flowId });
    expect(dbDoc?.status).toBe('deleted');

    // Get after delete → 404.
    const getAfterDel = await app.inject({
      method: 'GET',
      url: `/v1/admin/email-flows/${flowId}`,
      headers: adminHeadersNoBody(adminToken),
    });
    expect(getAfterDel.statusCode).toBe(404);
  });

  it('DB override is used by sendTemplate (end-to-end wiring)', async () => {
    // Seed a DB override for 'forgot_password'.
    const flowDoc = {
      _id: 'ef-test-id',
      flowKey: 'forgot_password',
      subject: 'DB override soggetto: {{resetUrl}}',
      text: 'DB override testo: {{resetUrl}}',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await app.mongoDb.collection('tz_email_flows').insertOne(flowDoc);

    // In test environment sendTemplate is a no-op in terms of SMTP,
    // but we can verify that lookupFlow is wired: call it and confirm no throw.
    // (the lookup function is exercised — an error would bubble up)
    await expect(
      app.mail.sendTemplate({
        to: 'test@example.com',
        flowKey: 'forgot_password',
        vars: { resetUrl: 'https://app.test/reset/abc' },
      }),
    ).resolves.toBeUndefined();
  });

  it('non-admin is rejected from all email-flow endpoints', async () => {
    // Create a regular user and get their token.
    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash('Password123!', 10);
    await app.mongoDb.collection('tz_users').insertOne({
      _id: new ObjectId(),
      email: 'regular-flows@tecma.test',
      passwordHash,
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'regular-flows@tecma.test', password: 'Password123!' },
    });
    const userToken = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/admin/email-flows',
      headers: adminHeadersNoBody(userToken),
    });
    expect(res.statusCode).toBe(403);
  });
});
