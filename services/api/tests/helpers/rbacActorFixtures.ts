import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';

/** Password condivisa tra attori nei test integration (solo DB in-memory). */
export const RBAC_FIXTURE_PASSWORD = 'Password123!';

export type CrossWorkspaceScenario = {
  password: string;
  wsAlphaId: string;
  wsBetaId: string;
  alphaProjectId: string;
  alphaOwnerEmail: string;
  alphaViewerEmail: string;
  betaOwnerEmail: string;
};

/**
 * Crea due workspace isolati con utenti distinti:
 * - owner di alpha, viewer di alpha, owner di beta (nessun overlap di membership tra alpha e beta).
 */
export const seedCrossWorkspaceScenario = async (db: Db): Promise<CrossWorkspaceScenario> => {
  const users = db.collection('tz_users');
  const now = new Date().toISOString();
  const hash = await bcrypt.hash(RBAC_FIXTURE_PASSWORD, 10);

  const wsAlphaId = 'ws-rbac-alpha';
  const wsBetaId = 'ws-rbac-beta';
  const alphaProjectId = 'proj-rbac-alpha-1';

  const alphaOwnerEmail = 'rbac-alpha-owner@tecma.test';
  const alphaViewerEmail = 'rbac-alpha-viewer@tecma.test';
  const betaOwnerEmail = 'rbac-beta-owner@tecma.test';

  const insAlphaOwner = await users.insertOne({
    _id: new ObjectId(),
    email: alphaOwnerEmail,
    passwordHash: hash,
    status: 'active',
    systemRole: 'user',
    createdAt: now,
    updatedAt: now,
  });
  const alphaOwnerId = insAlphaOwner.insertedId.toString();

  const insAlphaViewer = await users.insertOne({
    _id: new ObjectId(),
    email: alphaViewerEmail,
    passwordHash: hash,
    status: 'active',
    systemRole: 'user',
    createdAt: now,
    updatedAt: now,
  });
  const alphaViewerId = insAlphaViewer.insertedId.toString();

  const insBetaOwner = await users.insertOne({
    _id: new ObjectId(),
    email: betaOwnerEmail,
    passwordHash: hash,
    status: 'active',
    systemRole: 'user',
    createdAt: now,
    updatedAt: now,
  });
  const betaOwnerId = insBetaOwner.insertedId.toString();

  await db.collection('tz_workspaces').insertMany([
    {
      _id: wsAlphaId,
      name: 'RBAC Alpha',
      owner_user_id: alphaOwnerId,
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: wsBetaId,
      name: 'RBAC Beta',
      owner_user_id: betaOwnerId,
      mfaRequired: false,
      createdAt: now,
      updatedAt: now,
    },
  ]);

  await db.collection('tz_projects').insertOne({
    _id: alphaProjectId,
    workspaceId: wsAlphaId,
    name: 'RBAC Alpha Project',
    code: 'RBA',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_workspace_projects').insertOne({
    _id: randomUUID(),
    workspaceId: wsAlphaId,
    projectId: alphaProjectId,
    createdAt: now,
  });

  await db.collection('tz_user_workspaces').insertMany([
    {
      _id: randomUUID(),
      workspaceId: wsAlphaId,
      userId: alphaOwnerId,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: randomUUID(),
      workspaceId: wsAlphaId,
      userId: alphaViewerId,
      role: 'viewer',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: randomUUID(),
      workspaceId: wsBetaId,
      userId: betaOwnerId,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  return {
    password: RBAC_FIXTURE_PASSWORD,
    wsAlphaId,
    wsBetaId,
    alphaProjectId,
    alphaOwnerEmail,
    alphaViewerEmail,
    betaOwnerEmail,
  };
};
