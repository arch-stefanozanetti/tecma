#!/usr/bin/env node
/**
 * Migrazione idempotente: crea indici core sulle collection `tz_*` allineati a `ensureCoreIndexes`
 * in `@followup/db` (mantenere allineamento manuale finché non si condivide un unico entrypoint CLI).
 *
 * Default: **dry-run** (solo log). Esegui con `--apply`.
 * Safety: rifiuta se `MONGO_DB_NAME` (o default) non coincide con `ALLOWED_WRITE_DB` (o stesso default) salvo `--force`.
 *
 * Opzionale: `--with-validators` (solo con `--apply`) applica `collMod` con JSON Schema permissivo (`validationAction: warn`).
 */
import { MongoClient } from 'mongodb';

const allowedDb = (
  process.env.ALLOWED_WRITE_DB ??
  process.env.MONGO_DB_NAME ??
  'test-zanetti'
).trim();
const dbName = (process.env.MONGO_DB_NAME ?? allowedDb).trim();

const INDEX_PLAN = [
  {
    collection: 'tz_users',
    keys: { email: 1 },
    options: { unique: true, name: 'tz_users_email_unique' },
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
const force = args.has('--force');
const withValidators = args.has('--with-validators');

const uri = process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017';

async function main() {
  if (dbName !== allowedDb && !force) {
    console.error(
      `Refused: MONGO_DB_NAME "${dbName}" must match ALLOWED_WRITE_DB "${allowedDb}" (allineato all'API) o passa --force`,
    );
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

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
