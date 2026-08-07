#!/usr/bin/env node
/**
 * Scansiona le soft-delete mature e marca le notice come pronte per review.
 *
 * Non fa hard-delete: il purge resta una review manuale Tecma.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
dotenv.config({ path: path.join(root, '.env') });
dotenv.config({ path: path.join(root, '.env.local'), override: true });

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME?.trim();

if (uri == null || uri.trim() === '') {
  console.error('Missing MONGO_URI');
  process.exit(1);
}
if (dbName == null || dbName === '') {
  console.error('Missing MONGO_DB_NAME');
  process.exit(1);
}

const now = new Date().toISOString();
const client = new MongoClient(uri);

try {
  await client.connect();
  const db = client.db(dbName);
  const notices = db.collection('tz_lifecycle_notices');
  const eligible = await notices
    .find({
      purgeEligibleAt: { $lte: now },
      status: { $in: ['pending', 'pending_config'] },
    })
    .toArray();

  if (eligible.length > 0) {
    await notices.updateMany(
      { _id: { $in: eligible.map((notice) => notice._id) } },
      {
        $set: {
          status: 'ready_for_manual_review',
          reviewedAt: null,
          updatedAt: now,
        },
      },
    );
  }

  console.log(
    JSON.stringify(
      {
        database: db.databaseName,
        collection: 'tz_lifecycle_notices',
        eligible: eligible.length,
        mode: 'mark-ready-for-manual-review',
      },
      null,
      2,
    ),
  );
} finally {
  await client.close();
}
