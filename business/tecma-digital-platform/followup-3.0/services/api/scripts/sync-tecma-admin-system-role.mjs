#!/usr/bin/env node
/**
 * Sincronizza il ruolo globale Tecma dai campi legacy ai campi canonici.
 *
 * Default: dry-run read-only.
 * Applica solo con `--apply`, dopo aver verificato il report.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local'), override: true });

const COLLECTION = 'tz_users';
const CANONICAL_ROLE = 'tecma_admin';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME ?? 'test-zanetti';
const allowedWriteDb = process.env.ALLOWED_WRITE_DB;

if (uri == null || uri.trim() === '') {
  console.error('Missing MONGO_URI');
  process.exit(1);
}

if (apply && allowedWriteDb !== dbName) {
  console.error(
    `Refused: --apply requires ALLOWED_WRITE_DB (${allowedWriteDb ?? 'unset'}) to match MONGO_DB_NAME (${dbName}).`,
  );
  process.exit(1);
}

function isPlatformAdminRole(value) {
  if (typeof value !== 'string') return false;
  return ['tecma_admin', 'tecma_superadmin', 'tecma_super_admin'].includes(
    value.trim().toLowerCase(),
  );
}

function needsCanonicalSync(doc) {
  const legacyAdmin = isPlatformAdminRole(doc.system_role);
  const camelAdmin = isPlatformAdminRole(doc.systemRole);
  const shouldBeAdmin = legacyAdmin || camelAdmin || doc.isTecmaAdmin === true;
  if (!shouldBeAdmin) return false;
  return (
    doc.systemRole !== CANONICAL_ROLE ||
    doc.system_role !== CANONICAL_ROLE ||
    doc.isTecmaAdmin !== true
  );
}

const client = new MongoClient(uri);
try {
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection(COLLECTION);
  const cursor = users.find({
    $or: [
      { systemRole: { $in: ['tecma_admin', 'tecma_superadmin', 'tecma_super_admin'] } },
      { system_role: { $in: ['tecma_admin', 'tecma_superadmin', 'tecma_super_admin'] } },
      { isTecmaAdmin: true },
    ],
  });

  const report = {
    mode: apply ? 'apply' : 'dry-run',
    database: db.databaseName,
    collection: COLLECTION,
    examined: 0,
    alreadyCanonical: 0,
    toSync: 0,
    applied: 0,
  };

  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    report.examined += 1;

    if (!needsCanonicalSync(doc)) {
      report.alreadyCanonical += 1;
      continue;
    }

    report.toSync += 1;
    if (!apply) continue;

    await users.updateOne(
      { _id: doc._id },
      {
        $set: {
          systemRole: CANONICAL_ROLE,
          system_role: CANONICAL_ROLE,
          isTecmaAdmin: true,
          updatedAt: new Date().toISOString(),
        },
      },
    );
    report.applied += 1;
  }

  console.log(JSON.stringify(report, null, 2));
  if (!apply) {
    console.error('\nDry-run only. Re-run with --apply after account verification.');
  }
} finally {
  await client.close();
}
