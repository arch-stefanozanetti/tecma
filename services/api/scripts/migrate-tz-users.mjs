#!/usr/bin/env node
/**
 * Migrazione idempotente della collection POC `tz_users` sul database esplicito:
 * - email trim + lowercase
 * - password (bcrypt $2*) → passwordHash + $unset password
 * - status da isDisabled / status legacy
 * - $unset isDisabled
 *
 * Default: dry-run. Le modifiche richiedono `--apply` e
 * `ENABLE_POC_TZ_WRITES=1`.
 */
import { MongoClient } from 'mongodb';

const COLLECTION = 'tz_users';

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');

function assertDbName(db, expectedDbName) {
  if (db.databaseName !== expectedDbName) {
    console.error(
      `Refused: connected database is "${db.databaseName}", expected "${expectedDbName}".`,
    );
    process.exit(1);
  }
}

function isBcryptPasswordField(value) {
  return typeof value === 'string' && value.startsWith('$2');
}

function deriveStatus(doc) {
  if (doc.isDisabled === true) return 'disabled';
  if (doc.status === 'active') return 'active';
  if (doc.status === 'disabled') return 'disabled';
  if (doc.status === 'invited') return 'invited';
  if (typeof doc.status === 'string' && doc.status.trim() !== '') return doc.status;
  return 'active';
}

function needsChange(doc) {
  const emailRaw = doc.email;
  const hasStringEmail = typeof emailRaw === 'string';
  const emailNorm = hasStringEmail ? emailRaw.trim().toLowerCase() : '';
  const hasValidEmail = hasStringEmail && emailNorm !== '';
  const emailChanged = hasValidEmail && emailRaw !== emailNorm;

  const hasPasswordHash = typeof doc.passwordHash === 'string' && doc.passwordHash.length > 0;
  const legacyPassword = doc.password;
  const promotePassword = !hasPasswordHash && isBcryptPasswordField(legacyPassword);

  const nextStatus = deriveStatus(doc);
  const statusChanged = doc.status !== nextStatus;

  const unsetIsDisabled = doc.isDisabled !== undefined;

  const unsetPassword = promotePassword && doc.password !== undefined;

  const noop =
    !(hasStringEmail && !hasValidEmail) &&
    !emailChanged &&
    !promotePassword &&
    !statusChanged &&
    !unsetIsDisabled &&
    !unsetPassword;

  const missingHash = !hasPasswordHash && !promotePassword;

  return {
    noop,
    emailNorm,
    hasValidEmail,
    emailChanged,
    promotePassword,
    nextStatus,
    statusChanged,
    unsetIsDisabled,
    unsetPassword,
    missingHash,
  };
}

async function main() {
  const uri = process.env.MONGO_URI;
  if (uri == null || String(uri).trim() === '') {
    console.error('Missing MONGO_URI');
    process.exit(1);
  }
  const targetDbName = process.env.MONGO_DB_NAME?.trim();
  const allowedWriteDb = process.env.ALLOWED_WRITE_DB?.trim();
  if (targetDbName == null || targetDbName === '') {
    console.error('Missing MONGO_DB_NAME');
    process.exit(1);
  }
  if (allowedWriteDb == null || allowedWriteDb === '') {
    console.error('Missing ALLOWED_WRITE_DB');
    process.exit(1);
  }
  if (targetDbName !== allowedWriteDb) {
    console.error('Refused: MONGO_DB_NAME must match ALLOWED_WRITE_DB');
    process.exit(1);
  }
  if (apply && process.env.ENABLE_POC_TZ_WRITES !== '1') {
    console.error('Refused: --apply requires ENABLE_POC_TZ_WRITES=1');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  let dbName = targetDbName;
  try {
    await client.connect();
    const db = client.db(targetDbName);
    assertDbName(db, targetDbName);
    dbName = db.databaseName;

    const coll = db.collection(COLLECTION);
    const cursor = coll.find({});
    const report = {
      examined: 0,
      toLowercase: 0,
      toUnsetPassword: 0,
      toSetPasswordHash: 0,
      toSetStatus: 0,
      toUnsetIsDisabled: 0,
      missingHash: 0,
      invalidEmailSkipped: 0,
      noop: 0,
      applied: 0,
    };

    while (await cursor.hasNext()) {
      const doc = await cursor.next();
      report.examined += 1;
      const plan = needsChange(doc);

      if (plan.missingHash) report.missingHash += 1;
      if (!plan.hasValidEmail) report.invalidEmailSkipped += 1;

      if (plan.noop) {
        report.noop += 1;
        continue;
      }

      if (plan.emailChanged) report.toLowercase += 1;
      if (plan.promotePassword) {
        report.toSetPasswordHash += 1;
        report.toUnsetPassword += 1;
      }
      if (plan.statusChanged) report.toSetStatus += 1;
      if (plan.unsetIsDisabled) report.toUnsetIsDisabled += 1;

      if (!apply) continue;

      const set = {};
      if (plan.emailChanged) set.email = plan.emailNorm;
      if (plan.promotePassword) set.passwordHash = doc.password;
      if (plan.statusChanged) set.status = plan.nextStatus;

      const unset = {};
      if (plan.unsetIsDisabled) unset.isDisabled = '';
      if (plan.unsetPassword) unset.password = '';

      const update = {};
      if (Object.keys(set).length > 0) update.$set = set;
      if (Object.keys(unset).length > 0) update.$unset = unset;

      if (Object.keys(update).length === 0) continue;

      await coll.updateOne({ _id: doc._id }, update);
      report.applied += 1;
    }

    console.log(
      JSON.stringify(
        {
          mode: apply ? 'apply' : 'dry-run',
          database: dbName,
          collection: COLLECTION,
          ...report,
        },
        null,
        2,
      ),
    );

    if (!apply) {
      console.error('\nDry-run only. Re-run with --apply after verification.');
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
