#!/usr/bin/env node
/**
 * Migrazione idempotente: crea indici core sulle collection `tz_*` allineati a `ensureCoreIndexes`
 * in `@followup/db` (mantenere allineamento manuale finché non si condivide un unico entrypoint CLI).
 *
 * Default: **dry-run** (solo log). Esegui con `--apply`.
 * Safety: richiede database esplicito e coincidente; `--apply` richiede anche
 * `ENABLE_POC_TZ_WRITES=1`.
 *
 * Opzionale: `--with-validators` (solo con `--apply`) applica `collMod` con JSON Schema permissivo (`validationAction: warn`).
 */
import { MongoClient } from 'mongodb';

const allowedDb = process.env.ALLOWED_WRITE_DB?.trim();
const dbName = process.env.MONGO_DB_NAME?.trim();

const DROP_INDEX_PLAN = [
  {
    collection: 'tz_users',
    name: 'tz_users_email_unique',
  },
];

const INDEX_PLAN = [
  {
    collection: 'tz_users',
    keys: { homeWorkspaceId: 1, email: 1 },
    options: {
      unique: true,
      name: 'tz_users_homeWorkspace_email_unique',
      partialFilterExpression: {
        homeWorkspaceId: { $exists: true },
        status: { $in: ['active', 'invited', 'deactivated', 'suspended'] },
      },
    },
  },
  {
    collection: 'tz_users',
    keys: { email: 1 },
    options: {
      unique: true,
      name: 'tz_users_tecma_email_unique',
      partialFilterExpression: {
        systemRole: 'tecma_admin',
        status: { $in: ['active', 'invited', 'deactivated', 'suspended'] },
      },
    },
  },
  { collection: 'tz_users', keys: { status: 1 }, options: { name: 'tz_users_status_idx' } },
  { collection: 'tz_users', keys: { systemRole: 1 }, options: { name: 'tz_users_systemRole_idx' } },
  {
    collection: 'tz_user_workspaces',
    keys: { workspaceId: 1, userId: 1 },
    options: { unique: true },
  },
  {
    collection: 'tz_workspace_user_projects',
    keys: { workspaceId: 1, userId: 1, projectId: 1 },
    options: { unique: true },
  },
  {
    collection: 'tz_workspace_user_projects',
    keys: { userId: 1, workspaceId: 1 },
    options: { name: 'tz_workspace_user_projects_user_workspace_idx' },
  },
  {
    collection: 'tz_workspace_user_projects',
    keys: { projectId: 1 },
    options: { name: 'tz_workspace_user_projects_projectId_idx' },
  },
  {
    collection: 'tz_workspace_entitlements',
    keys: { workspaceId: 1, feature: 1 },
    options: { unique: true },
  },
  {
    collection: 'tz_workspace_projects',
    keys: { workspaceId: 1, projectId: 1 },
    options: { unique: true },
  },
  {
    collection: 'tz_workspace_projects',
    keys: { projectId: 1 },
    options: { name: 'tz_workspace_projects_projectId_idx' },
  },
  {
    collection: 'tz_projects',
    keys: { workspaceId: 1, code: 1 },
    options: { unique: true, name: 'tz_projects_workspace_code_unique' },
  },
  {
    collection: 'tz_workspaces',
    keys: { owner_user_id: 1 },
    options: { name: 'tz_workspaces_owner_user_id_idx' },
  },
  {
    collection: 'tz_project_access',
    keys: { project_id: 1 },
    options: { name: 'tz_project_access_project_id_idx' },
  },
  {
    collection: 'tz_authEvents',
    keys: { createdAt: -1 },
    options: { name: 'tz_authEvents_createdAt_idx' },
  },
  { collection: 'tz_authSessions', keys: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
  {
    collection: 'tz_authSessions',
    keys: { refreshTokenHash: 1 },
    options: { unique: true, name: 'tz_authSessions_refreshTokenHash_unique' },
  },
  {
    collection: 'tz_authSessions',
    keys: { sessionId: 1 },
    options: { unique: true, name: 'tz_authSessions_sessionId_unique' },
  },
];

/** JSON Schema permissivi: solo tipi base; documenti legacy restano validabili con `warn`. */
const VALIDATOR_SPECS = [
  {
    collection: 'tz_users',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['email'],
        properties: {
          email: { bsonType: 'string', description: 'Login email' },
          homeWorkspaceId: { bsonType: ['string', 'objectId', 'null'] },
          status: { bsonType: ['string', 'null'] },
          systemRole: { bsonType: ['string', 'null'] },
        },
      },
    },
  },
  {
    collection: 'tz_workspaces',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        properties: {
          name: { bsonType: ['string', 'null'] },
          owner_user_id: { bsonType: ['string', 'null'] },
          workspaceId: { bsonType: ['string', 'null'] },
        },
      },
    },
  },
  {
    collection: 'tz_projects',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        properties: {
          code: { bsonType: ['string', 'null'] },
          name: { bsonType: ['string', 'null'] },
          workspaceId: { bsonType: ['string', 'null'] },
        },
      },
    },
  },
];

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const withValidators = args.has('--with-validators');

const uri = process.env.MONGO_URI?.trim();

async function main() {
  if (uri == null || uri === '') {
    console.error('Missing MONGO_URI');
    process.exit(1);
  }
  if (dbName == null || dbName === '') {
    console.error('Missing MONGO_DB_NAME');
    process.exit(1);
  }
  if (allowedDb == null || allowedDb === '') {
    console.error('Missing ALLOWED_WRITE_DB');
    process.exit(1);
  }
  if (dbName !== allowedDb) {
    console.error(`Refused: MONGO_DB_NAME "${dbName}" must match ALLOWED_WRITE_DB "${allowedDb}"`);
    process.exit(1);
  }
  if (apply && process.env.ENABLE_POC_TZ_WRITES !== '1') {
    console.error('Refused: --apply requires ENABLE_POC_TZ_WRITES=1');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  for (const { collection, name } of DROP_INDEX_PLAN) {
    const label = `${collection} ${name}`;
    if (!apply) {
      console.log(`[dry-run] dropIndex ${label}`);
      continue;
    }
    try {
      await db.collection(collection).dropIndex(name);
      console.log(`[apply] OK dropIndex ${label}`);
    } catch (e) {
      const codeName = e?.codeName ?? '';
      const msg = String(e?.message ?? e).toLowerCase();
      if (
        codeName === 'IndexNotFound' ||
        codeName === 'NamespaceNotFound' ||
        msg.includes('index not found') ||
        msg.includes('ns not found')
      ) {
        console.log(`[skip] index missing: ${label}`);
        continue;
      }
      throw e;
    }
  }

  for (const { collection, keys, options } of INDEX_PLAN) {
    const label = `${collection} ${JSON.stringify(keys)} ${JSON.stringify(options)}`;
    if (!apply) {
      console.log(`[dry-run] createIndex ${label}`);
      continue;
    }
    try {
      await db.collection(collection).createIndex(keys, options);
      console.log(`[apply] OK ${label}`);
    } catch (e) {
      const codeName = e?.codeName ?? '';
      const msg = String(e?.message ?? e);
      if (
        codeName === 'IndexOptionsConflict' &&
        msg.includes('already exists with a different name')
      ) {
        console.warn(`[skip] index name conflict (benign): ${label}`);
        continue;
      }
      throw e;
    }
  }

  if (withValidators) {
    if (!apply) {
      console.log('[dry-run] --with-validators ignored without --apply');
    } else {
      for (const { collection, validator } of VALIDATOR_SPECS) {
        const label = `${collection} collMod validator`;
        console.log(`[apply] ${label}`);
        await db.command({
          collMod: collection,
          validator,
          validationLevel: 'moderate',
          validationAction: 'warn',
        });
      }
    }
  }

  await client.close();
  console.log(apply ? 'Done (apply).' : 'Done (dry-run). Use --apply to execute.');
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
