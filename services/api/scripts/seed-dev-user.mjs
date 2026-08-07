#!/usr/bin/env node
/**
 * Opzionale: utente fittizio per Mongo vuoto o smoke locali — NON è un account aziendale.
 * Per sviluppo su DB reale: usa login con utenti già in `tz_users` (no seed).
 *
 * Legge `services/api/.env` (e `.env.local` se presente).
 * Override: SEED_DEV_USER_EMAIL, SEED_DEV_USER_PASSWORD.
 * Default email/password = stesso pattern dei test Vitest (solo test automation).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { MongoClient, ObjectId } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local'), override: true });

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const ALLOWED_WRITE_DB = process.env.ALLOWED_WRITE_DB;

const email = (process.env.SEED_DEV_USER_EMAIL ?? 'demo@tecma.test').trim().toLowerCase();
const password = process.env.SEED_DEV_USER_PASSWORD ?? 'Password123!';

if (MONGO_URI == null || MONGO_URI === '') {
  console.error('Manca MONGO_URI in services/api/.env');
  process.exit(1);
}
if (MONGO_DB_NAME == null || MONGO_DB_NAME === '') {
  console.error('Manca MONGO_DB_NAME in services/api/.env');
  process.exit(1);
}
if (ALLOWED_WRITE_DB == null || ALLOWED_WRITE_DB === '') {
  console.error('Manca ALLOWED_WRITE_DB in services/api/.env');
  process.exit(1);
}
if (ALLOWED_WRITE_DB !== MONGO_DB_NAME) {
  console.error(
    `Refused: ALLOWED_WRITE_DB (${ALLOWED_WRITE_DB}) non coincide con MONGO_DB_NAME (${MONGO_DB_NAME}).`,
  );
  process.exit(1);
}
if (process.env.ENABLE_POC_TZ_WRITES !== '1') {
  console.error('Refused: seed requires ENABLE_POC_TZ_WRITES=1');
  process.exit(1);
}

const now = new Date().toISOString();
const passwordHash = await bcrypt.hash(password, 10);

const client = new MongoClient(MONGO_URI);
await client.connect();
try {
  const col = client.db(MONGO_DB_NAME).collection('tz_users');
  const r = await col.updateOne(
    { email },
    {
      $set: {
        email,
        passwordHash,
        status: 'active',
        systemRole: 'user',
        updatedAt: now,
      },
      $setOnInsert: { _id: new ObjectId(), createdAt: now },
    },
    { upsert: true },
  );
  const upserted = r.upsertedId != null ? r.upsertedId.toString() : 'n/a';
  console.log(`OK utente ${email} (password da SEED_DEV_USER_PASSWORD o default Password123!).`);
  console.log(
    `Mongo: matched=${r.matchedCount} modified=${r.modifiedCount} upsertedId=${upserted}`,
  );
} finally {
  await client.close();
}
