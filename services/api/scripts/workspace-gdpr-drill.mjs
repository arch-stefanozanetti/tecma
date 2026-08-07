import { mkdir, writeFile } from 'node:fs/promises';

import { startInMemoryMongo, stopInMemoryMongo } from '@followup/db/testing';

const dbName = 'test-zanetti';
const workspaceId = 'ws-gdpr-drill';
const memberUserId = 'user-gdpr-1';
const ownerUserId = 'user-gdpr-owner';

const workspaceCollections = [
  'tz_user_workspaces',
  'tz_workspace_user_projects',
  'tz_workspace_entitlements',
  'tz_workspace_entity_assignments',
  'tz_workspace_platform_api_keys',
  'tz_workspace_ai_config',
  'tz_additional_infos',
  'tz_inviteTokens',
];

const main = async () => {
  const mongoContext = await startInMemoryMongo();
  try {
    const db = mongoContext.client.db(dbName);
    const now = new Date().toISOString();

    await db.collection('tz_users').insertMany([
      {
        _id: ownerUserId,
        email: 'owner-gdpr@tecma.test',
        fullName: 'Workspace Owner',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: memberUserId,
        email: 'member-gdpr@tecma.test',
        fullName: 'Workspace Member',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.collection('tz_workspaces').insertOne({
      _id: workspaceId,
      name: 'Workspace GDPR Drill',
      owner_user_id: ownerUserId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await db.collection('tz_user_workspaces').insertMany([
      {
        _id: 'm-gdpr-owner',
        workspaceId,
        userId: ownerUserId,
        role: 'owner',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        _id: 'm-gdpr-member',
        workspaceId,
        userId: memberUserId,
        role: 'viewer',
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
    ]);
    await db.collection('tz_workspace_user_projects').insertOne({
      _id: 'aup-gdpr-1',
      workspaceId,
      userId: memberUserId,
      projectId: 'project-gdpr-1',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await db.collection('tz_workspace_entitlements').insertOne({
      _id: 'ent-gdpr-1',
      workspaceId,
      feature: 'analytics',
      status: 'enabled',
      createdAt: now,
      updatedAt: now,
    });

    const exportBundle = {
      workspace: await db.collection('tz_workspaces').findOne({ _id: workspaceId }),
      users: await db
        .collection('tz_users')
        .find({ _id: { $in: [ownerUserId, memberUserId] } })
        .toArray(),
      collections: {},
    };
    for (const name of workspaceCollections) {
      exportBundle.collections[name] = await db.collection(name).find({ workspaceId }).toArray();
    }

    const deletedAt = new Date().toISOString();
    await db.collection('tz_workspaces').updateOne(
      { _id: workspaceId },
      {
        $set: {
          status: 'deleted',
          deletedAt,
          updatedAt: deletedAt,
        },
      },
    );
    for (const name of workspaceCollections) {
      await db.collection(name).updateMany(
        { workspaceId, status: { $ne: 'deleted' } },
        {
          $set: {
            status: 'deleted',
            deletedAt,
            updatedAt: deletedAt,
          },
        },
      );
    }
    await db.collection('tz_users').updateMany({ _id: { $in: [ownerUserId, memberUserId] } }, [
      {
        $set: {
          email: {
            $concat: ['deleted+', { $toString: '$_id' }, '@example.invalid'],
          },
          fullName: 'Deleted User',
          status: 'deleted',
          deletedAt,
          updatedAt: deletedAt,
        },
      },
    ]);

    const activeWorkspaceRows = await Promise.all(
      workspaceCollections.map(async (name) => {
        const count = await db
          .collection(name)
          .countDocuments({ workspaceId, status: { $nin: ['deleted', 'deactivated'] } });
        return [name, count];
      }),
    );
    const activeWorkspaceRowsMap = Object.fromEntries(activeWorkspaceRows);
    const leakedOriginalEmails =
      (await db
        .collection('tz_users')
        .countDocuments({ email: { $in: ['owner-gdpr@tecma.test', 'member-gdpr@tecma.test'] } })) >
      0;

    const erased =
      !leakedOriginalEmails &&
      Object.values(activeWorkspaceRowsMap).every((count) => Number(count) === 0) &&
      (await db
        .collection('tz_workspaces')
        .countDocuments({ _id: workspaceId, status: 'deleted' })) === 1;

    const report = {
      generatedAt: new Date().toISOString(),
      workspaceId,
      exportedCounts: {
        users: exportBundle.users.length,
        ...Object.fromEntries(
          Object.entries(exportBundle.collections).map(([name, rows]) => [name, rows.length]),
        ),
      },
      erased,
      activeWorkspaceRowsAfterErase: activeWorkspaceRowsMap,
      leakedOriginalEmails,
    };

    await mkdir('security-reports', { recursive: true });
    await writeFile(
      'security-reports/workspace-gdpr-drill.json',
      `${JSON.stringify(report, null, 2)}\n`,
      'utf-8',
    );

    if (!erased) {
      throw new Error('GDPR drill failed: residual active rows or original emails detected');
    }

    console.log('Workspace GDPR drill completed');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await stopInMemoryMongo(mongoContext);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
