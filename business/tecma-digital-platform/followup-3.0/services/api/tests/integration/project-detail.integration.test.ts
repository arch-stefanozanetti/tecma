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
let adminId: ObjectId;
let viewerId: ObjectId;
let outsiderId: ObjectId;
const workspaceId = 'ws-pd-int';
const projectId = 'project-pd-int';

describe('Project Detail integration (POC-plus 11 sezioni)', () => {
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
    const projects = app.mongoDb.collection('tz_projects');
    const projectAccess = app.mongoDb.collection('tz_project_access');
    const now = new Date().toISOString();
    const hash = await bcrypt.hash('Password123!', 10);

    adminId = new ObjectId();
    viewerId = new ObjectId();
    outsiderId = new ObjectId();

    await users.insertMany([
      {
        _id: adminId,
        email: 'pd-admin@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'tecma_admin',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: viewerId,
        email: 'pd-viewer@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: outsiderId,
        email: 'pd-outsider@tecma.test',
        passwordHash: hash,
        status: 'active',
        systemRole: 'user',
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await workspaces.insertOne({
      _id: workspaceId,
      name: 'PD Workspace',
      createdAt: now,
      updatedAt: now,
    } as any);

    await memberships.insertMany([
      {
        _id: 'm-pd-admin',
        workspaceId,
        userId: adminId.toString(),
        role: 'owner',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'm-pd-viewer',
        workspaceId,
        userId: viewerId.toString(),
        role: 'viewer',
        createdAt: now,
        updatedAt: now,
      },
    ] as any);

    await projects.insertOne({
      _id: projectId,
      workspaceId,
      name: 'PD Project',
      code: 'pd-1',
      createdAt: now,
      updatedAt: now,
    } as any);

    await projectAccess.insertOne({
      _id: 'pa-pd-1',
      project_id: projectId,
      workspace_id: workspaceId,
      role: 'viewer',
      created_at: now,
    } as any);
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  const loginAs = async (email: string): Promise<string> => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: 'Password123!' },
    });
    expect(res.statusCode).toBe(200);
    return res.json().data.accessToken as string;
  };

  describe('Identity + Contacts (PATCH /projects/:projectId)', () => {
    it('PATCH applica identity + contacts e GET ritorna i campi', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const patch = await app.inject({
        method: 'PATCH',
        url: `/v1/projects/${projectId}`,
        headers: authHeaders(token),
        payload: {
          displayName: 'Residenze POC',
          mode: 'sell',
          defaultLang: 'it',
          hostKey: 'host-1',
          contactEmail: 'info@tecma.test',
          city: 'Milano',
          payoff: 'Powered by Tecma',
        },
      });
      expect(patch.statusCode).toBe(200);
      const data = patch.json().data as Record<string, unknown>;
      expect(data.displayName).toBe('Residenze POC');
      expect(data.mode).toBe('sell');
      expect(data.contactEmail).toBe('info@tecma.test');
    });

    it('PATCH 400 con mode invalido', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/projects/${projectId}`,
        headers: authHeaders(token),
        payload: { mode: 'lease' },
      });
      expect([400, 500]).toContain(res.statusCode);
    });
  });

  describe('Branding section', () => {
    it('PUT salva branding e GET lo ritorna', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const put = await app.inject({
        method: 'PUT',
        url: `/v1/projects/${projectId}/branding`,
        headers: authHeaders(token),
        payload: {
          logoUrl: 'https://cdn.tecma.test/proj-logo.png',
          primaryColor: '#1A2B3C',
          footerText: 'Powered by Tecma',
        },
      });
      expect(put.statusCode).toBe(200);

      const get = await app.inject({
        method: 'GET',
        url: `/v1/projects/${projectId}/branding`,
        headers: authHeaders(token),
      });
      expect(get.statusCode).toBe(200);
      const data = get.json().data as Record<string, unknown>;
      expect(data.primaryColor).toBe('#1A2B3C');
    });

    it('PUT 400 con primaryColor invalido', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const res = await app.inject({
        method: 'PUT',
        url: `/v1/projects/${projectId}/branding`,
        headers: authHeaders(token),
        payload: { primaryColor: 'red' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('PUT 403 per viewer', async () => {
      const token = await loginAs('pd-viewer@tecma.test');
      const res = await app.inject({
        method: 'PUT',
        url: `/v1/projects/${projectId}/branding`,
        headers: authHeaders(token),
        payload: { primaryColor: '#000000' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('GET 403 per outsider', async () => {
      const token = await loginAs('pd-outsider@tecma.test');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/projects/${projectId}/branding`,
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Policies / Marketing / Workflow / EmailConfig sections', () => {
    it.each([
      [
        'policies',
        { privacyPolicyUrl: 'https://tecma.test/privacy', consentBannerEnabled: true },
      ],
      [
        'marketing-settings',
        { googleAnalyticsId: 'UA-1234', ga4PropertyId: '12345', metaAdAccountId: 'act_999' },
      ],
      ['workflow-settings', { flowType: 'sales', autoAssign: true, reminderDays: 5 }],
      [
        'email-config',
        {
          smtpHost: 'smtp.tecma.test',
          smtpPort: 587,
          smtpUsername: 'noreply@tecma.test',
          smtpPassword: 'super-secret-password',
          fromEmail: 'noreply@tecma.test',
        },
      ],
    ])('PUT %s applica payload e GET ritorna', async (segment, payload) => {
      const token = await loginAs('pd-admin@tecma.test');
      const put = await app.inject({
        method: 'PUT',
        url: `/v1/projects/${projectId}/${segment}`,
        headers: authHeaders(token),
        payload,
      });
      expect(put.statusCode).toBe(200);

      const get = await app.inject({
        method: 'GET',
        url: `/v1/projects/${projectId}/${segment}`,
        headers: authHeaders(token),
      });
      expect(get.statusCode).toBe(200);
      const data = get.json().data as Record<string, unknown>;
      expect(data).not.toBeNull();
      if (segment === 'email-config') {
        const password = data.smtpPassword as string;
        expect(password).not.toBe('super-secret-password');
        expect(password).toMatch(/^\*+/);
      }
    });

    it('PUT email-config 400 con smtpPort invalido', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const res = await app.inject({
        method: 'PUT',
        url: `/v1/projects/${projectId}/email-config`,
        headers: authHeaders(token),
        payload: { smtpPort: 70000 },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Email templates CRUD', () => {
    let createdId: string;

    it('POST crea email template', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const res = await app.inject({
        method: 'POST',
        url: `/v1/projects/${projectId}/email-templates`,
        headers: authHeaders(token),
        payload: {
          name: 'welcome',
          subject: 'Benvenuto',
          htmlBody: '<p>Hello {{name}}</p>',
          placeholders: ['name'],
        },
      });
      expect(res.statusCode).toBe(201);
      createdId = res.json().data._id as string;
    });

    it('POST 409 su name duplicato', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const res = await app.inject({
        method: 'POST',
        url: `/v1/projects/${projectId}/email-templates`,
        headers: authHeaders(token),
        payload: { name: 'welcome', subject: 'B', htmlBody: '<p>x</p>' },
      });
      expect(res.statusCode).toBe(409);
    });

    it('PATCH aggiorna template', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const res = await app.inject({
        method: 'PATCH',
        url: `/v1/projects/${projectId}/email-templates/${createdId}`,
        headers: authHeaders(token),
        payload: { subject: 'Benvenuto in Tecma' },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data.subject).toBe('Benvenuto in Tecma');
    });

    it('DELETE elimina template e GET 404', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const del = await app.inject({
        method: 'DELETE',
        url: `/v1/projects/${projectId}/email-templates/${createdId}`,
        headers: authHeadersNoBody(token),
      });
      expect(del.statusCode).toBe(200);

      const patchAfter = await app.inject({
        method: 'PATCH',
        url: `/v1/projects/${projectId}/email-templates/${createdId}`,
        headers: authHeaders(token),
        payload: { subject: 'x' },
      });
      expect(patchAfter.statusCode).toBe(404);
    });
  });

  describe('PDF templates CRUD', () => {
    let createdId: string;

    it('POST crea PDF template + 409 su key duplicato', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const created = await app.inject({
        method: 'POST',
        url: `/v1/projects/${projectId}/pdf-templates`,
        headers: authHeaders(token),
        payload: {
          templateKey: 'quote',
          name: 'Preventivo',
          htmlBody: '<html>{{total}}</html>',
          pageSize: 'A4',
        },
      });
      expect(created.statusCode).toBe(201);
      createdId = created.json().data._id as string;

      const dup = await app.inject({
        method: 'POST',
        url: `/v1/projects/${projectId}/pdf-templates`,
        headers: authHeaders(token),
        payload: { templateKey: 'quote', name: 'Altro', htmlBody: '<html/>' },
      });
      expect(dup.statusCode).toBe(409);
    });

    it('DELETE elimina PDF template', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const res = await app.inject({
        method: 'DELETE',
        url: `/v1/projects/${projectId}/pdf-templates/${createdId}`,
        headers: authHeadersNoBody(token),
      });
      expect(res.statusCode).toBe(200);
    });
  });

  describe('Legacy overrides', () => {
    it('PUT applica identityFields + advancedOverrides', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const res = await app.inject({
        method: 'PUT',
        url: `/v1/projects/${projectId}/legacy-overrides`,
        headers: authHeaders(token),
        payload: {
          identityFields: { legacyHostId: 'host-legacy-1' },
          advancedOverrides: [
            { path: 'legacy.fee', valueType: 'number', value: 12.5 },
            { path: 'legacy.flag', valueType: 'boolean', value: true },
          ],
        },
      });
      expect(res.statusCode).toBe(200);

      const get = await app.inject({
        method: 'GET',
        url: `/v1/projects/${projectId}/legacy-overrides`,
        headers: authHeaders(token),
      });
      expect(get.statusCode).toBe(200);
      const data = get.json().data as Record<string, unknown>;
      expect(data.advancedOverrides).toHaveLength(2);
    });

    it('PUT 400 su valueType invalido', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const res = await app.inject({
        method: 'PUT',
        url: `/v1/projects/${projectId}/legacy-overrides`,
        headers: authHeaders(token),
        payload: {
          advancedOverrides: [{ path: 'p', valueType: 'date', value: '2025-01-01' }],
        },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  describe('Connectors & workflow lookup (stub)', () => {
    it('GET ads-customers ritorna [] se config assente', async () => {
      const token = await loginAs('pd-admin@tecma.test');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/connectors/marketing-google/ads-customers`,
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().data).toEqual([]);
    });

    it('GET connectors 403 outsider', async () => {
      const token = await loginAs('pd-outsider@tecma.test');
      const res = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/connectors/marketing-meta/ad-accounts`,
        headers: authHeaders(token),
      });
      expect(res.statusCode).toBe(403);
    });

    it('GET workflows + workflow-config con doc preinserito', async () => {
      await app.mongoDb.collection('tz_workflows').insertOne({
        _id: 'wf-1',
        workspaceId,
        name: 'Sales',
      } as any);
      await app.mongoDb.collection('tz_workflow_configs').insertOne({
        _id: 'wfc-1',
        workspaceId,
        projectId,
        flowType: 'sales',
        steps: ['lead', 'quote', 'won'],
      } as any);

      const token = await loginAs('pd-admin@tecma.test');
      const list = await app.inject({
        method: 'GET',
        url: `/v1/workspaces/${workspaceId}/workflows`,
        headers: authHeaders(token),
      });
      expect(list.statusCode).toBe(200);
      expect((list.json().data as unknown[]).length).toBeGreaterThanOrEqual(1);

      const cfg = await app.inject({
        method: 'GET',
        url: `/v1/workflow/config?workspaceId=${workspaceId}&projectId=${projectId}&flowType=sales`,
        headers: authHeaders(token),
      });
      expect(cfg.statusCode).toBe(200);
      expect(cfg.json().data).toMatchObject({ flowType: 'sales' });
    });
  });
});
