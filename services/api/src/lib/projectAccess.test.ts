import { describe, expect, it } from 'vitest';
import { ObjectId } from 'mongodb';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

import { buildServer } from '../server.js';
import { listAccessibleProjectIdsForUser, userHasProjectAccess } from './projectAccess.js';

type StringIdDocument = { _id: string; [key: string]: unknown };

describe('projectAccess', () => {
  it('listAccessibleProjectIdsForUser raccoglie assegnazioni e link workspace', async () => {
    const mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = '1234567890123456';

    const app = await buildServer();
    const now = new Date().toISOString();
    const uid = 'user-list-test';
    const ws = 'ws-list-test';
    const pid = 'proj-list-test';

    await app.mongoDb.collection<StringIdDocument>('tz_workspaces').insertOne({
      _id: ws,
      name: 'Workspace list test',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection<StringIdDocument>('tz_projects').insertOne({
      _id: pid,
      workspaceId: ws,
      name: 'Project list test',
      code: 'PLT',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: new ObjectId(),
      workspaceId: ws,
      userId: uid,
      role: 'viewer',
      createdAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: new ObjectId(),
      workspaceId: ws,
      projectId: pid,
      createdAt: now,
    });

    const ids = await listAccessibleProjectIdsForUser(app, [uid]);
    expect(ids).toContain(pid);

    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 30_000);

  it('userHasProjectAccess read via membership workspace senza assegnazione diretta', async () => {
    const mongoContext = await startInMemoryMongo();
    process.env.MONGO_URI = mongoContext.uri;
    process.env.MONGO_DB_NAME = 'test-zanetti';
    process.env.ALLOWED_WRITE_DB = 'test-zanetti';
    process.env.AUTH_JWT_SECRET = 'super-secure-jwt-secret-with-at-least-32-chars';
    process.env.INTERNAL_API_KEY = '1234567890123456';

    const app = await buildServer();
    const now = new Date().toISOString();
    const uid = 'user-read-ws';
    const ws = 'ws-read-ws';
    const pid = 'proj-read-ws';

    await app.mongoDb.collection<StringIdDocument>('tz_workspaces').insertOne({
      _id: ws,
      name: 'Workspace read test',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_projects').insertOne({
      _id: pid as unknown as ObjectId,
      workspaceId: ws,
      name: 'P',
      code: 'P',
      createdAt: now,
      updatedAt: now,
    });
    await app.mongoDb.collection('tz_user_workspaces').insertOne({
      _id: new ObjectId(),
      workspaceId: ws,
      userId: uid,
      role: 'viewer',
      createdAt: now,
    });
    await app.mongoDb.collection('tz_workspace_projects').insertOne({
      _id: new ObjectId(),
      workspaceId: ws,
      projectId: pid,
      createdAt: now,
    });

    const okRead = await userHasProjectAccess(
      app,
      { sub: uid, email: 'x@test.com', permissions: [] },
      pid,
      'read',
    );
    expect(okRead).toBe(true);

    const okWrite = await userHasProjectAccess(
      app,
      { sub: uid, email: 'x@test.com', permissions: [] },
      pid,
      'write',
    );
    expect(okWrite).toBe(false);

    await app.close();
    await stopInMemoryMongo(mongoContext);
  }, 30_000);
});
