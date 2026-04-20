/**
 * One-off script: imposta system_role "tecma_admin" per una singola email.
 * Consentito SOLO sul DB test-zanetti.
 *
 * Esecuzione:
 *   MONGO_DB_NAME=test-zanetti npx tsx scripts/set-tecma-admin-by-email.ts
 */
import { connectDb, getDb } from "../src/config/db.js";
import { ENV } from "../src/config/env.js";
import {
  USER_COLLECTION_CANDIDATES,
  escapeEmailForRegex,
} from "../src/core/auth/userAccessPayload.js";

const ALLOWED_DB_NAME = "test-zanetti";
const TARGET_EMAIL = "f.stravino@tecmasolutions.com";
const TARGET_EMAIL_REGEX = new RegExp(`^${escapeEmailForRegex(TARGET_EMAIL)}$`, "i");

function getDbName(): string {
  return (process.env.MONGO_DB_NAME || ENV.MONGO_DB_NAME).trim();
}

async function main(): Promise<void> {
  const dbName = getDbName();
  if (dbName !== ALLOWED_DB_NAME) {
    console.error(
      `Script consentito solo per MONGO_DB_NAME=${ALLOWED_DB_NAME}. Attuale: ${dbName || "(vuoto)"}.`
    );
    process.exit(1);
  }

  await connectDb();
  const db = getDb();
  let totalMatched = 0;
  let totalUpdated = 0;

  for (const collName of USER_COLLECTION_CANDIDATES) {
    const exists = await db.listCollections({ name: collName }).hasNext();
    if (!exists) continue;

    const result = await db.collection(collName).updateMany(
      { email: { $regex: TARGET_EMAIL_REGEX } },
      { $set: { system_role: "tecma_admin", updatedAt: new Date() } }
    );

    if (result.matchedCount > 0 || result.modifiedCount > 0) {
      console.log(
        `[${collName}] matched=${result.matchedCount} updated=${result.modifiedCount} email=${TARGET_EMAIL}`
      );
    }
    totalMatched += result.matchedCount;
    totalUpdated += result.modifiedCount;
  }

  if (totalMatched === 0) {
    console.warn(`Nessun utente trovato per email ${TARGET_EMAIL}.`);
  }

  console.log(`Totale matched: ${totalMatched}`);
  console.log(`Totale aggiornati: ${totalUpdated}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
