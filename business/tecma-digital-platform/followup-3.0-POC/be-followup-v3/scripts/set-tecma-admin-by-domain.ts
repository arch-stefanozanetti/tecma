/**
 * One-off script: imposta system_role "tecma_admin" per tutti gli utenti
 * con email @tecmasolutions.com. Consentito SOLO sul DB test-zanetti.
 *
 * Esecuzione: MONGO_DB_NAME=test-zanetti npx tsx scripts/set-tecma-admin-by-domain.ts
 */
import { connectDb, getDb } from "../src/config/db.js";
import { ENV } from "../src/config/env.js";
import { USER_COLLECTION_CANDIDATES } from "../src/core/auth/userAccessPayload.js";

const ALLOWED_DB_NAME = "test-zanetti";
const EMAIL_DOMAIN_REGEX = /@tecmasolutions\.com$/i;

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

  let totalUpdated = 0;

  for (const collName of USER_COLLECTION_CANDIDATES) {
    const exists = await db.listCollections({ name: collName }).hasNext();
    if (!exists) continue;

    const result = await db.collection(collName).updateMany(
      { email: { $regex: EMAIL_DOMAIN_REGEX } },
      { $set: { system_role: "tecma_admin", updatedAt: new Date() } }
    );

    const count = result.modifiedCount;
    if (count > 0) {
      console.log(`[${collName}] aggiornati ${count} documenti`);
      totalUpdated += count;
    }
  }

  console.log(`Totale documenti aggiornati: ${totalUpdated}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
