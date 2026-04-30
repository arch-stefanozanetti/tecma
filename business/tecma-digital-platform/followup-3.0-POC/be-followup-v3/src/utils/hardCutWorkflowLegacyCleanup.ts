import { ObjectId } from "mongodb";
import { connectDb, disconnectDb, getDb } from "../config/db.js";
import { getWorkflowForWorkspaceAndType, getStateByCode } from "../core/workflow/workflow-engine.service.js";

const COLLECTION_REQUESTS = "tz_requests";
const COLLECTION_REQUEST_TRANSITIONS = "tz_request_transitions";
const COLLECTION_APARTMENT_LOCKS = "tz_apartment_locks";
const COLLECTION_PROJECT_WORKFLOW_SETTINGS = "tz_project_workflow_settings";
const COLLECTION_WORKFLOWS = "tz_workflows";
const COLLECTION_STATES = "tz_workflow_states";

type RequestType = "rent" | "sell";

async function run() {
  await connectDb();
  const db = getDb();
  const requestsColl = db.collection(COLLECTION_REQUESTS);
  const transitionsColl = db.collection(COLLECTION_REQUEST_TRANSITIONS);
  const locksColl = db.collection(COLLECTION_APARTMENT_LOCKS);
  const projectSettingsColl = db.collection(COLLECTION_PROJECT_WORKFLOW_SETTINGS);
  const workflowsColl = db.collection(COLLECTION_WORKFLOWS);
  const statesColl = db.collection(COLLECTION_STATES);

  const requests = await requestsColl.find({}).toArray();

  let requestsNormalized = 0;
  let requestsDeletedNoWorkflow = 0;
  let requestsDeletedInvalidState = 0;
  let transitionsDeleted = 0;

  for (const req of requests) {
    const requestId = req._id instanceof ObjectId ? req._id.toHexString() : String(req._id);
    const workspaceId = typeof req.workspaceId === "string" ? req.workspaceId : "";
    const projectId = typeof req.projectId === "string" ? req.projectId : "";
    const type = (req.type === "rent" || req.type === "sell" ? req.type : "sell") as RequestType;
    const status = typeof req.status === "string" ? req.status : "new";

    const workflowDetail = await getWorkflowForWorkspaceAndType(workspaceId, type, projectId);
    if (!workflowDetail) {
      await requestsColl.deleteOne({ _id: req._id });
      const trRes = await transitionsColl.deleteMany({ requestId });
      transitionsDeleted += trRes.deletedCount ?? 0;
      requestsDeletedNoWorkflow += 1;
      continue;
    }

    const state = getStateByCode(workflowDetail, status);
    if (!state) {
      await requestsColl.deleteOne({ _id: req._id });
      const trRes = await transitionsColl.deleteMany({ requestId });
      transitionsDeleted += trRes.deletedCount ?? 0;
      requestsDeletedInvalidState += 1;
      continue;
    }

    await requestsColl.updateOne(
      { _id: req._id },
      {
        $set: {
          workflowId: workflowDetail.workflow._id,
          currentStateId: state._id,
          updatedAt: new Date().toISOString(),
        },
      }
    );
    requestsNormalized += 1;
  }

  const [workflowIds, stateIds] = await Promise.all([
    workflowsColl.find({}, { projection: { _id: 1 } }).toArray(),
    statesColl.find({}, { projection: { _id: 1 } }).toArray(),
  ]);

  const validWorkflowIds = new Set(
    workflowIds.map((d) => (d._id instanceof ObjectId ? d._id.toHexString() : String(d._id)))
  );
  const validStateIds = new Set(
    stateIds.map((d) => (d._id instanceof ObjectId ? d._id.toHexString() : String(d._id)))
  );

  const projectSettings = await projectSettingsColl.find({}).toArray();
  let projectOverridesDeleted = 0;
  for (const setting of projectSettings) {
    const workflowId = typeof setting.workflowId === "string" ? setting.workflowId : "";
    if (!validWorkflowIds.has(workflowId)) {
      const res = await projectSettingsColl.deleteOne({ _id: setting._id });
      projectOverridesDeleted += res.deletedCount ?? 0;
    }
  }

  const locks = await locksColl.find({}).toArray();
  let orphanLocksDeleted = 0;
  for (const lock of locks) {
    const stateId = typeof lock.workflowStateId === "string" ? lock.workflowStateId : "";
    if (!validStateIds.has(stateId)) {
      const res = await locksColl.deleteOne({ _id: lock._id });
      orphanLocksDeleted += res.deletedCount ?? 0;
    }
  }

  console.log("[hard-cut-workflow-legacy] done");
  console.log(`- requests normalized: ${requestsNormalized}`);
  console.log(`- requests deleted (no workflow): ${requestsDeletedNoWorkflow}`);
  console.log(`- requests deleted (invalid state): ${requestsDeletedInvalidState}`);
  console.log(`- request transitions deleted: ${transitionsDeleted}`);
  console.log(`- project overrides deleted: ${projectOverridesDeleted}`);
  console.log(`- orphan apartment locks deleted: ${orphanLocksDeleted}`);
}

run()
  .catch((err) => {
    console.error("[hard-cut-workflow-legacy] failed", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb();
  });
