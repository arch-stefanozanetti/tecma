import { mkdir, writeFile } from 'node:fs/promises';

import { ensureCoreIndexes } from '../../../packages/db/src/ensureIndexes.ts';
import { startInMemoryMongo, stopInMemoryMongo } from '../../../packages/db/src/testing/index.ts';

const dbName = 'test-zanetti';

const watchedCollections = [
  'tz_workspaces',
  'tz_user_workspaces',
  'tz_workspace_user_projects',
  'tz_workspace_entitlements',
  'tz_workspace_entity_assignments',
  'tz_workspace_platform_api_keys',
  'tz_workspace_ai_config',
  'tz_additional_infos',
  'tz_inviteTokens',
];

const readIndexSignature = async (db, collectionName) => {
  const indexes = await db.collection(collectionName).indexes();
  return indexes
    .map((index) => `${index.name}:${JSON.stringify(index.key)}`)
    .sort((a, b) => a.localeCompare(b));
};

const main = async () => {
  const mongoContext = await startInMemoryMongo();
  try {
    const db = mongoContext.client.db(dbName);

    await ensureCoreIndexes(db);
    const firstRun = {};
    for (const collectionName of watchedCollections) {
      firstRun[collectionName] = await readIndexSignature(db, collectionName);
    }

    await ensureCoreIndexes(db);
    const secondRun = {};
    for (const collectionName of watchedCollections) {
      secondRun[collectionName] = await readIndexSignature(db, collectionName);
    }

    const stable = watchedCollections.every(
      (collectionName) =>
        JSON.stringify(firstRun[collectionName]) === JSON.stringify(secondRun[collectionName]),
    );

    const report = {
      generatedAt: new Date().toISOString(),
      checkedCollections: watchedCollections,
      stable,
      firstRun,
      secondRun,
    };

    await mkdir('security-reports', { recursive: true });
    await writeFile(
      'security-reports/workspace-migration-idempotence.json',
      `${JSON.stringify(report, null, 2)}\n`,
      'utf-8',
    );

    if (!stable) {
      throw new Error('Migration idempotence check failed: index signatures diverged');
    }

    console.log('Workspace migration idempotence check completed');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await stopInMemoryMongo(mongoContext);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
