import { connectDb } from "../config/db.js";

const LEGACY_WORKSPACES = ["dev-1", "demo", "prod"];

const run = async () => {
  const db = await connectDb(); // usa ENV.MONGO_DB_NAME (test-zanetti)

  const wsColl = db.collection("tz_workspaces");
  const requestsColl = db.collection("tz_requests");

  const testWorkspace = await wsColl.findOne({ name: "Test Workspace" });
  if (!testWorkspace?._id) {
    // eslint-disable-next-line no-console
    console.error('Workspace "Test Workspace" non trovato in tz_workspaces.');
    process.exit(1);
  }
  const testWorkspaceId = String(testWorkspace._id);

  // eslint-disable-next-line no-console
  console.log('Test Workspace id:', testWorkspaceId);

  const legacyRequests = await requestsColl
    .find({ workspaceId: { $in: LEGACY_WORKSPACES } })
    .toArray();

  // eslint-disable-next-line no-console
  console.log("Trovate richieste legacy:", legacyRequests.length);

  if (legacyRequests.length === 0) {
    process.exit(0);
  }

  const docsToInsert = legacyRequests.map((req) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { _id, ...rest } = req as Record<string, unknown>;
    return {
      ...rest,
      workspaceId: testWorkspaceId,
    };
  });

  if (docsToInsert.length > 0) {
    const result = await requestsColl.insertMany(docsToInsert);
    // eslint-disable-next-line no-console
    console.log("Copiate richieste su Test Workspace:", result.insertedCount);
  }

  process.exit(0);
};

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});

