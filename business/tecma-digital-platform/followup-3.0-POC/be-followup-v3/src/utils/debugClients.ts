import { connectDb } from "../config/db.js";

const run = async () => {
  const db = await connectDb();

  const wsColl = db.collection("tz_workspaces");
  const allWs = await wsColl.find({ name: "Test Workspace" }).toArray();
  // eslint-disable-next-line no-console
  console.log("Test Workspace docs:", allWs.map((w) => String(w._id)));

  if (allWs.length === 0) {
    // eslint-disable-next-line no-console
    console.log("Nessun Test Workspace trovato");
    process.exit(0);
  }

  const canonicalId = String(allWs[0]._id);
  const clientsColl = db.collection("tz_clients");

  const total = await clientsColl.countDocuments({ workspaceId: canonicalId });
  // eslint-disable-next-line no-console
  console.log("WorkspaceId canonico:", canonicalId, "| clients per questo workspace:", total);

  const sample = await clientsColl
    .find({ workspaceId: canonicalId })
    .project({ fullName: 1, projectId: 1 })
    .limit(20)
    .toArray();

  // eslint-disable-next-line no-console
  console.log("Sample clients:", JSON.stringify(sample, null, 2));
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

