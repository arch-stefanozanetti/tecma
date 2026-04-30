import { connectDb } from "../config/db.js";

const run = async () => {
  const db = await connectDb();

  const wsColl = db.collection("tz_workspaces");
  const ws = await wsColl.findOne({ name: "Test Workspace" });
  if (!ws?._id) {
    // eslint-disable-next-line no-console
    console.log('Test Workspace non trovato in tz_workspaces');
    process.exit(0);
  }

  const workspaceId = String(ws._id);
  const requestsColl = db.collection("tz_requests");

  const total = await requestsColl.countDocuments({ workspaceId });
  // eslint-disable-next-line no-console
  console.log("WorkspaceId:", workspaceId, "| tz_requests per questo workspace:", total);

  const sample = await requestsColl
    .find({ workspaceId })
    .limit(5)
    .toArray();

  // eslint-disable-next-line no-console
  console.log("Sample:", JSON.stringify(sample, null, 2));
  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

