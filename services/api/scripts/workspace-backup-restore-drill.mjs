import { mkdir, writeFile } from 'node:fs/promises';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

const targetWorkspaceId = 'ws-backup-drill';
const dbName = 'test-zanetti';

const collections = [
  'tz_workspaces',
  'tz_user_workspaces',
  'tz_workspace_user_projects',
  'tz_workspace_entitlements',
  'tz_workspace_entity_assignments',
  'tz_workspace_platform_api_keys',
  'tz_workspace_ai_config',
  'tz_additional_infos',
];

const workspaceFilter = (collectionName) =>
  collectionName === 'tz_workspaces'
    ? { _id: targetWorkspaceId }
    : { workspaceId: targetWorkspaceId };

const seed = async (db) => {
  const now = new Date().toISOString();
  await db.collection('tz_workspaces').insertOne({
    _id: targetWorkspaceId,
    name: 'Workspace Backup Drill',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_user_workspaces').insertOne({
    _id: 'm-backup-owner',
    workspaceId: targetWorkspaceId,
    userId: 'user-backup-owner',
    role: 'owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_workspace_user_projects').insertOne({
    _id: 'aup-backup-1',
    workspaceId: targetWorkspaceId,
    userId: 'user-backup-owner',
    projectId: 'project-backup-1',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_workspace_entitlements').insertOne({
    _id: 'ent-backup-1',
    workspaceId: targetWorkspaceId,
    feature: 'analytics',
    status: 'enabled',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_workspace_entity_assignments').insertOne({
    _id: 'assign-backup-1',
    workspaceId: targetWorkspaceId,
    entityType: 'client',
    entityId: 'client-backup-1',
    userId: 'user-backup-owner',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_workspace_platform_api_keys').insertOne({
    _id: 'wk-backup-1',
    workspaceId: targetWorkspaceId,
    tokenHash: 'hash-backup-1',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_workspace_ai_config').insertOne({
    _id: 'ai-backup-1',
    workspaceId: targetWorkspaceId,
    provider: 'openai',
    model: 'gpt-4o-mini',
    enabled: true,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('tz_additional_infos').insertOne({
    _id: 'info-backup-1',
    workspaceId: targetWorkspaceId,
    label: 'Codice',
    value: 'AB-001',
    sortOrder: 1,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });
};

const countWorkspaceDocs = async (db) => {
  const entries = await Promise.all(
    collections.map(async (name) => {
      const count = await db.collection(name).countDocuments(workspaceFilter(name));
      return [name, count];
    }),
  );
  return Object.fromEntries(entries);
};

const main = async () => {
  const mongoContext = await startInMemoryMongo();
  try {
    const db = mongoContext.client.db(dbName);

    await seed(db);
    const countsBefore = await countWorkspaceDocs(db);

    const backup = {};
    for (const name of collections) {
      backup[name] = await db.collection(name).find(workspaceFilter(name)).toArray();
    }

    for (const name of collections) {
      await db.collection(name).deleteMany(workspaceFilter(name));
    }
    const countsAfterDelete = await countWorkspaceDocs(db);

    for (const name of collections) {
      const docs = backup[name];
      if (Array.isArray(docs) && docs.length > 0) {
        await db.collection(name).insertMany(docs);
      }
    }
    const countsAfterRestore = await countWorkspaceDocs(db);

    const restored = Object.entries(countsBefore).every(
      ([name, before]) => countsAfterDelete[name] === 0 && countsAfterRestore[name] === before,
    );

    const report = {
      generatedAt: new Date().toISOString(),
      workspaceId: targetWorkspaceId,
      collectionCounts: {
        beforeBackup: countsBefore,
        afterDelete: countsAfterDelete,
        afterRestore: countsAfterRestore,
      },
      restored,
    };

    await mkdir('security-reports', { recursive: true });
    await writeFile(
      'security-reports/workspace-backup-restore-drill.json',
      `${JSON.stringify(report, null, 2)}\n`,
      'utf-8',
    );

    if (!restored) {
      throw new Error('Backup/restore drill failed: restored counts do not match baseline');
    }

    console.log('Workspace backup/restore drill completed');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await stopInMemoryMongo(mongoContext);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
