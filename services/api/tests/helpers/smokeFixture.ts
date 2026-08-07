import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';

export const SMOKE_API_KEY = '1234567890123456';
export const SMOKE_USER_EMAIL = 'smoke@tecma.test';
/** Stessa password dello smoke owner — utente `viewer` sullo stesso workspace (E2E multi-attore). */
export const SMOKE_VIEWER_EMAIL = 'smoke-viewer@tecma.test';
/** Workspace `admin` sullo stesso smoke workspace (E2E terzo attore / P2 smoke). */
export const SMOKE_WS_ADMIN_EMAIL = 'smoke-ws-admin@tecma.test';
/** Nessuna membership: E2E fullstack P6 (accesso negato a progetto smoke). */
export const SMOKE_ORPHAN_EMAIL = 'smoke-orphan@tecma.test';
export const SMOKE_PASSWORD = 'Password123!';
export const SMOKE_WORKSPACE_ID = 'ws-smoke-1';
export const SMOKE_PROJECT_ID = 'proj-smoke-1';

export interface SmokeFixtureContext {
  demoUserId: string;
  demoViewerUserId: string;
  demoWsAdminUserId: string;
}

export const seedSmokeFixture = async (db: Db): Promise<SmokeFixtureContext> => {
  const users = db.collection('tz_users');
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(SMOKE_PASSWORD, 10);
  const ins = await users.insertOne({
    _id: new ObjectId(),
    email: SMOKE_USER_EMAIL,
    passwordHash,
    status: 'active',
    systemRole: 'user',
    createdAt: now,
    updatedAt: now,
  });
  const demoUserId = ins.insertedId.toString();

  const insViewer = await users.insertOne({
    _id: new ObjectId(),
    email: SMOKE_VIEWER_EMAIL,
    passwordHash,
    status: 'active',
    systemRole: 'user',
    createdAt: now,
    updatedAt: now,
  });
  const demoViewerUserId = insViewer.insertedId.toString();

  const insWsAdmin = await users.insertOne({
    _id: new ObjectId(),
    email: SMOKE_WS_ADMIN_EMAIL,
    passwordHash,
    status: 'active',
    systemRole: 'user',
    createdAt: now,
    updatedAt: now,
  });
  const demoWsAdminUserId = insWsAdmin.insertedId.toString();

  await users.insertOne({
    _id: new ObjectId(),
    email: SMOKE_ORPHAN_EMAIL,
    passwordHash,
    status: 'active',
    systemRole: 'user',
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('tz_workspaces').insertOne({
    _id: SMOKE_WORKSPACE_ID,
    name: 'Smoke WS',
    owner_user_id: demoUserId,
    mfaRequired: false,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_user_workspaces').insertOne({
    _id: randomUUID(),
    workspaceId: SMOKE_WORKSPACE_ID,
    userId: demoUserId,
    role: 'owner',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_user_workspaces').insertOne({
    _id: randomUUID(),
    workspaceId: SMOKE_WORKSPACE_ID,
    userId: demoViewerUserId,
    role: 'viewer',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_user_workspaces').insertOne({
    _id: randomUUID(),
    workspaceId: SMOKE_WORKSPACE_ID,
    userId: demoWsAdminUserId,
    role: 'admin',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_projects').insertOne({
    _id: SMOKE_PROJECT_ID,
    workspaceId: SMOKE_WORKSPACE_ID,
    name: 'Smoke Project',
    code: 'SMK',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_workspace_projects').insertOne({
    _id: randomUUID(),
    workspaceId: SMOKE_WORKSPACE_ID,
    projectId: SMOKE_PROJECT_ID,
    createdAt: now,
  });
  await db.collection('tz_workspace_user_projects').insertOne({
    _id: randomUUID(),
    workspaceId: SMOKE_WORKSPACE_ID,
    userId: demoUserId,
    projectId: SMOKE_PROJECT_ID,
    createdAt: now,
  });
  await db.collection('tz_workspace_user_projects').insertOne({
    _id: randomUUID(),
    workspaceId: SMOKE_WORKSPACE_ID,
    userId: demoWsAdminUserId,
    projectId: SMOKE_PROJECT_ID,
    createdAt: now,
  });

  return { demoUserId, demoViewerUserId, demoWsAdminUserId };
};
