import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { FastifyInstance } from 'fastify';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { RBAC_FIXTURE_PASSWORD, seedCrossWorkspaceScenario } from '../helpers/rbacActorFixtures.js';
import { buildServer } from '../../src/server.js';

const API_KEY = '1234567890123456';

const authHeaders = (accessToken: string) => ({
  'x-api-key': API_KEY,
  authorization: `Bearer ${accessToken}`,
  'content-type': 'application/json',
});

let app: FastifyInstance;
let mongoContext: Awaited<ReturnType<typeof startInMemoryMongo>>;
let scenario: Awaited<ReturnType<typeof seedCrossWorkspaceScenario>>;

describe('rbac cross-workspace integration', () => {
  beforeAll(async () => {
    mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = API_KEY;

    app = await buildServer();
    scenario = await seedCrossWorkspaceScenario(app.mongoDb);
  });

  afterAll(async () => {
    await app.close();
    await stopInMemoryMongo(mongoContext);
  });

  const login = async (email: string) => {
    const res = await app.inject({
      method: 'POST',
      url: '/v1/auth/login',
      payload: { email, password: RBAC_FIXTURE_PASSWORD },
    });
    expect(res.statusCode).toBe(200);
    return res.json().data.accessToken as string;
  };

  it('owner di alpha non legge il workspace beta (403)', async () => {
    const token = await login(scenario.alphaOwnerEmail);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/workspaces/${scenario.wsBetaId}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(403);
  });

  it('owner di alpha non elenca progetti nel workspace beta (403)', async () => {
    const token = await login(scenario.alphaOwnerEmail);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects?workspaceId=${scenario.wsBetaId}&perPage=10`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(403);
  });

  it('viewer di alpha non può aggiornare il workspace alpha (403)', async () => {
    const token = await login(scenario.alphaViewerEmail);
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/workspaces/${scenario.wsAlphaId}`,
      headers: authHeaders(token),
      payload: { name: 'Hacked name' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('viewer di alpha legge il progetto alpha (200)', async () => {
    const token = await login(scenario.alphaViewerEmail);
    const res = await app.inject({
      method: 'GET',
      url: `/v1/projects/${scenario.alphaProjectId}`,
      headers: authHeaders(token),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data._id).toBe(scenario.alphaProjectId);
  });

  it('viewer di alpha non può mutare il progetto alpha (403)', async () => {
    const token = await login(scenario.alphaViewerEmail);
    const res = await app.inject({
      method: 'PATCH',
      url: `/v1/projects/${scenario.alphaProjectId}`,
      headers: authHeaders(token),
      payload: { name: 'No write' },
    });
    expect(res.statusCode).toBe(403);
  });
});
