import { randomUUID } from 'node:crypto';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    vi.restoreAllMocks();
  });

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
      firstName: 'Cliente',
      lastName: 'Test',
      email: 'cliente.test@tecma.test',
      phone: '+39 333 123',
      city: 'Milano',
      status: 'lead',
      projectVisibility: { mode: 'workspace', projectIds: [] },
      gdpr: { consentSource: 'corporate_site', privacyAccepted: true },
      createdAt: now,
      updatedAt: now,
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

  it('workspace owner crea invito owner con POST /v1/workspaces/:id/invitations', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-owner@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;
    const mailSpy = vi.spyOn(app.mail, 'sendTemplate').mockResolvedValue(undefined);

    const res = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/ws-rbac-home/invitations',
      headers: authHeaders(token),
      payload: {
        email: 'invited-rbac-new@tecma.test',
        fullName: 'Invited User',
        role: 'owner',
        projectIds: ['proj-rbac-shared'],
      },
    });
    expect(res.statusCode).toBe(201);
    const row = await app.mongoDb.collection('tz_user_workspaces').findOne({
      workspaceId: 'ws-rbac-home',
      userId: res.json().data.userId as string,
    });
    expect(row).toMatchObject({ role: 'owner' });
    const assign = await app.mongoDb.collection('tz_workspace_user_projects').findOne({
      workspaceId: 'ws-rbac-home',
      projectId: 'proj-rbac-shared',
      userId: res.json().data.userId as string,
    });
    expect(assign).not.toBeNull();
    const inviteToken = await app.mongoDb.collection('tz_inviteTokens').findOne({
      workspaceId: 'ws-rbac-home',
      userId: res.json().data.userId as string,
      status: 'active',
    });
    expect(inviteToken).toMatchObject({
      workspaceId: 'ws-rbac-home',
      status: 'active',
      role: 'owner',
    });
    expect(inviteToken?.tokenHash).toHaveLength(64);
    expect(mailSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invited-rbac-new@tecma.test',
        flowKey: 'workspace_invite',
        vars: expect.objectContaining({
          workspaceId: 'ws-rbac-home',
          inviteUrl: expect.stringContaining('/invite-accept?token='),
        }),
      }),
    );

    const activeInviteTokens = await app.mongoDb.collection('tz_inviteTokens').countDocuments({
      workspaceId: 'ws-rbac-home',
      userId: res.json().data.userId as string,
      status: 'active',
    });
    expect(activeInviteTokens).toBe(1);
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
      url: '/v1/workspaces/ws-rbac-home/clients?searchText=cliente.test&status=lead&city=Milano&consentSource=corporate_site&visibilityMode=workspace&gdpr=complete&sortField=updatedAt&sortOrder=desc',
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data as { name?: string; email?: string; status?: string }[];
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data.some((c) => c.name === 'Cliente test')).toBe(true);
    expect(data.every((c) => c.status === 'lead')).toBe(true);
    expect(data.some((c) => c.email === 'cliente.test@tecma.test')).toBe(true);
  });

  it('crea e aggiorna clienti workspace con email unica, GDPR e visibilità progetto', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-owner@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const missingRequired = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/ws-rbac-home/clients',
      headers: authHeaders(token),
      payload: {
        email: 'cliente.incompleto@tecma.test',
        firstName: 'Cliente',
        lastName: 'Incompleto',
        phone: '+39 333',
        status: 'lead',
      },
    });
    expect(missingRequired.statusCode).toBe(400);

    const created = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/ws-rbac-home/clients',
      headers: authHeaders(token),
      payload: {
        email: 'Nuovo.Cliente@Tecma.Test',
        firstName: 'Nuovo',
        lastName: 'Cliente',
        phone: '+39 333',
        city: 'Milano',
        status: 'lead',
        source: 'corporate_site',
        budget: 450000,
        motivation: 'Cambio casa',
        profiling: {
          budget: 450000,
          preferredTypology: 'Trilocale',
          preferredRooms: 3,
          tags: ['premium'],
        },
        projectProfiles: [
          {
            projectId: 'proj-rbac-shared',
            interestLevel: 'high',
            preferredTypology: 'Trilocale',
          },
        ],
        projectVisibility: { mode: 'projects', projectIds: ['proj-rbac-shared'] },
        gdpr: {
          consentSource: 'project_site',
          privacyAccepted: true,
          marketingConsent: true,
          profilingConsent: false,
        },
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().data).toMatchObject({
      workspaceId: 'ws-rbac-home',
      email: 'nuovo.cliente@tecma.test',
      emailLower: 'nuovo.cliente@tecma.test',
      source: 'corporate_site',
      budget: 450000,
      profiling: { preferredTypology: 'Trilocale' },
      projectProfiles: [{ projectId: 'proj-rbac-shared', interestLevel: 'high' }],
      projectVisibility: { mode: 'projects', projectIds: ['proj-rbac-shared'] },
      gdpr: { consentSource: 'project_site', privacyAccepted: true },
    });

    const duplicate = await app.inject({
      method: 'POST',
      url: '/v1/workspaces/ws-rbac-home/clients',
      headers: authHeaders(token),
      payload: {
        email: 'nuovo.cliente@tecma.test',
        firstName: 'Duplicato',
        lastName: 'Cliente',
        phone: '+39 333',
        city: 'Milano',
        status: 'lead',
      },
    });
    expect(duplicate.statusCode).toBe(409);

    const clientId = created.json().data._id as string;
    const updated = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/ws-rbac-home/clients/${clientId}`,
      headers: authHeaders(token),
      payload: {
        status: 'client',
        notes: 'Nota aggiornata',
        projectProfiles: [
          {
            projectId: 'proj-rbac-shared',
            interestLevel: 'hot',
            preferredPriceMin: 300000,
            preferredPriceMax: 500000,
          },
        ],
        projectVisibility: { mode: 'workspace', projectIds: [] },
        gdpr: {
          consentSource: 'corporate_site',
          privacyAccepted: true,
          marketingConsent: false,
          profilingConsent: false,
        },
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({
      status: 'client',
      notes: 'Nota aggiornata',
      projectProfiles: [{ projectId: 'proj-rbac-shared', interestLevel: 'hot' }],
      projectVisibility: { mode: 'workspace', projectIds: [] },
      gdpr: { consentSource: 'corporate_site' },
    });

    const detail = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/ws-rbac-home/clients/${clientId}`,
      headers: authHeaders(token),
    });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().data).toMatchObject({
      _id: clientId,
      email: 'nuovo.cliente@tecma.test',
      status: 'client',
      notes: 'Nota aggiornata',
      projectProfiles: [{ projectId: 'proj-rbac-shared', interestLevel: 'hot' }],
      projectVisibility: { mode: 'workspace', projectIds: [] },
    });

    const emptyRequired = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/ws-rbac-home/clients/${clientId}`,
      headers: authHeaders(token),
      payload: { city: '   ' },
    });
    expect(emptyRequired.statusCode).toBe(400);

    const audit = await app.mongoDb.collection('tz_authEvents').findOne({
      eventType: 'workspaces.client.create',
      'details.clientId': clientId,
    });
    expect(audit).not.toBeNull();
  });

  it('gestisce assegnazioni cliente e timeline comune con audit automatico', async () => {
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-owner@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;
    const viewer = await app.mongoDb.collection('tz_users').findOne({
      email: 'rbac-viewer@tecma.test',
    });
    const clientId = randomUUID();
    await app.mongoDb.collection('tz_clients').insertOne({
      _id: clientId,
      workspaceId: 'ws-rbac-home',
      firstName: 'Timeline',
      lastName: 'Client',
      email: 'timeline.client@tecma.test',
      phone: '+39 333',
      city: 'Milano',
      status: 'lead',
      projectVisibility: { mode: 'workspace', projectIds: [] },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const assignment = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/ws-rbac-home/entities/client/${clientId}/assignments`,
      headers: authHeaders(token),
      payload: { userId: String(viewer?._id) },
    });
    expect(assignment.statusCode).toBe(201);

    const note = await app.inject({
      method: 'POST',
      url: `/v1/workspaces/ws-rbac-home/entities/client/${clientId}/timeline`,
      headers: authHeaders(token),
      payload: {
        type: 'note',
        title: 'Prima nota CRM',
        description: 'Cliente da richiamare',
        projectId: 'proj-rbac-shared',
      },
    });
    expect(note.statusCode).toBe(201);
    expect(note.json().data).toMatchObject({
      workspaceId: 'ws-rbac-home',
      entityType: 'client',
      entityId: clientId,
      type: 'note',
      title: 'Prima nota CRM',
    });

    const list = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/ws-rbac-home/entities/client/${clientId}/timeline?perPage=20`,
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    const rows = list.json().data as Array<{ type: string; title: string }>;
    expect(rows.some((row) => row.type === 'assignment')).toBe(true);
    expect(rows.some((row) => row.title === 'Prima nota CRM')).toBe(true);
  });

  it('filtra i clienti per visibilità quando un membro vede solo progetti assegnati', async () => {
    const now = new Date().toISOString();
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: 'proj-rbac-hidden',
      workspaceId: 'ws-rbac-home',
      name: 'Hidden',
      code: 'HID',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: randomUUID(),
      workspaceId: 'ws-rbac-home',
      projectId: 'proj-rbac-hidden',
      createdAt: now,
    });
    const viewer = await app.mongoDb.collection('tz_users').findOne({
      email: 'rbac-viewer@tecma.test',
    });
    await app.mongoDb.collection('tz_workspace_user_projects').insertOne({
      _id: randomUUID(),
      workspaceId: 'ws-rbac-home',
      userId: String(viewer?._id),
      projectId: 'proj-rbac-shared',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_clients').insertMany([
      {
        _id: randomUUID(),
        workspaceId: 'ws-rbac-home',
        firstName: 'Cliente',
        lastName: 'Visibile',
        email: 'visible-client@tecma.test',
        emailLower: 'visible-client@tecma.test',
        status: 'lead',
        projectVisibility: { mode: 'projects', projectIds: ['proj-rbac-shared'] },
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: randomUUID(),
        workspaceId: 'ws-rbac-home',
        firstName: 'Cliente',
        lastName: 'Nascosto',
        email: 'hidden-client@tecma.test',
        emailLower: 'hidden-client@tecma.test',
        status: 'lead',
        projectVisibility: { mode: 'projects', projectIds: ['proj-rbac-hidden'] },
        createdAt: now,
        updatedAt: now,
      },
    ]);
    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-viewer@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/ws-rbac-home/clients?perPage=100',
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    const emails = (res.json().data as { email?: string }[]).map((row) => row.email);
    expect(emails).toContain('visible-client@tecma.test');
    expect(emails).not.toContain('hidden-client@tecma.test');
  });

  it('non espone clienti a viewer senza progetti assegnati', async () => {
    const now = new Date().toISOString();
    const limitedUserId = new ObjectId();
    await app.mongoDb.collection('tz_users').insertOne({
      _id: limitedUserId,
      email: 'rbac-viewer-no-projects@tecma.test',
      passwordHash: await bcrypt.hash('Password123!', 10),
      status: 'active',
      systemRole: 'user',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: randomUUID(),
      workspaceId: 'ws-rbac-home',
      userId: limitedUserId.toString(),
      role: 'viewer',
      createdAt: now,
      updatedAt: now,
    });

    const login = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email: 'rbac-viewer-no-projects@tecma.test', password: 'Password123!' },
    });
    const token = login.json().data.accessToken as string;

    const res = await app.inject({
      method: 'GET',
      url: '/v1/workspaces/ws-rbac-home/clients?perPage=100',
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data).toEqual([]);
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
    const userId = res.json().data._id as string;
    const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
      workspaceId: 'ws-rbac-home',
      userId,
    });
    expect(membership).toMatchObject({ status: 'invited', role: 'viewer' });
    const inviteToken = await app.mongoDb.collection('tz_inviteTokens').findOne({
      workspaceId: 'ws-rbac-home',
      userId,
      status: 'active',
    });
    expect(inviteToken?.tokenHash).toHaveLength(64);
  });
});
