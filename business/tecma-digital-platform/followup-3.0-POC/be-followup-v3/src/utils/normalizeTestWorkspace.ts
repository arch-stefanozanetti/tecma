import { connectDb } from "../config/db.js";

const run = async () => {
  const db = await connectDb();
  const wsColl = db.collection("tz_workspaces");

  const all = await wsColl.find({ name: "Test Workspace" }).toArray();
  if (all.length <= 1) {
    // eslint-disable-next-line no-console
    console.log("Nessun duplicato Test Workspace da normalizzare.");
    process.exit(0);
  }

  const canonical = all[0];
  const canonicalId = String(canonical._id);
  const duplicateIds = all.slice(1).map((w) => String(w._id));

  // eslint-disable-next-line no-console
  console.log("Canonical Test Workspace:", canonicalId);
  // eslint-disable-next-line no-console
  console.log("Duplicate ids:", duplicateIds);

  const collectionsToFix = [
    "clients",
    "apartments",
    "calendar_events",
    "tz_requests",
    "tz_workspace_projects",
    "tz_additional_infos",
  ];

  for (const collName of collectionsToFix) {
    const coll = db.collection(collName);
    const res = await coll.updateMany(
      { workspaceId: { $in: duplicateIds } },
      { $set: { workspaceId: canonicalId } }
    );
    // eslint-disable-next-line no-console
    console.log(`Updated ${res.modifiedCount} docs in ${collName}`);
  }

  // Rimuovi i workspace duplicati
  await wsColl.deleteMany({ _id: { $in: all.slice(1).map((w) => w._id) } });

  // eslint-disable-next-line no-console
  console.log("Normalizzazione completata.");
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

