/**
 * Migrazione una tantum: tz_user_workspaces — ruoli legacy → spec.
 * vendor → collaborator, vendor_manager → admin.
 * Idempotente: i documenti già migrati non vengono modificati.
 *
 * Esecuzione: npx tsx src/utils/migrate-workspace-roles-legacy.ts
 */
import { connectDb, getDb } from "../config/db.js";

const COLLECTION = "tz_user_workspaces";

async function migrate() {
  await connectDb();
  const db = getDb();
  const coll = db.collection(COLLECTION);

  const rVendor = await coll.updateMany(
    { role: "vendor" },
    { $set: { role: "collaborator", updatedAt: new Date().toISOString() } }
  );
  const rVendorManager = await coll.updateMany(
    { role: "vendor_manager" },
    { $set: { role: "admin", updatedAt: new Date().toISOString() } }
  );

  console.log(
    `Migrazione ruoli legacy: vendor→collaborator ${rVendor.modifiedCount} doc, vendor_manager→admin ${rVendorManager.modifiedCount} doc.`
  );
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
