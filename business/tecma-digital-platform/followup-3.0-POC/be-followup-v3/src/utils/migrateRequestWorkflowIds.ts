/**
 * Migrazione Fase 3: per ogni request in tz_requests senza workflowId/currentStateId,
 * mappa status allo stato del workflow del workspace (stesso type) e imposta workflowId e currentStateId.
 * Esegui dopo aver creato almeno un workflow con stati per workspace: npm run migrate:request-workflow
 */
import { ObjectId } from "mongodb";
import { connectDb, getDb } from "../config/db.js";

const COLLECTION_WORKFLOWS = "tz_workflows";
const COLLECTION_STATES = "tz_workflow_states";
const COLLECTION_REQUESTS = "tz_requests";

async function run() {
  await connectDb();
  const db = getDb();
  const requestsColl = db.collection(COLLECTION_REQUESTS);
  const workflowsColl = db.collection(COLLECTION_WORKFLOWS);
  const statesColl = db.collection(COLLECTION_STATES);

  const requests = await requestsColl.find({}).toArray();
  let updated = 0;
  let skipped = 0;
  let noWorkflow = 0;

  for (const req of requests) {
    if (req.workflowId != null && String(req.workflowId).trim() !== "") {
      skipped += 1;
      continue;
    }
    const workspaceId = typeof req.workspaceId === "string" ? req.workspaceId : "";
    const type = req.type === "rent" || req.type === "sell" ? req.type : "sell";
    const status = typeof req.status === "string" && req.status ? req.status : "new";

    const wf = await workflowsColl.findOne({ workspaceId, type });
    if (!wf) {
      noWorkflow += 1;
      continue;
    }
    const wfId = wf._id instanceof ObjectId ? wf._id.toHexString() : String(wf._id);
    const stateDoc = await statesColl.findOne({ workflowId: wfId, code: status });
    if (!stateDoc) {
      skipped += 1;
      continue;
    }
    const stateId = stateDoc._id instanceof ObjectId ? stateDoc._id.toHexString() : String(stateDoc._id);
    await requestsColl.updateOne(
      { _id: req._id },
      { $set: { workflowId: wfId, currentStateId: stateId, updatedAt: new Date().toISOString() } }
    );
    updated += 1;
  }

  console.log("Migrazione request workflowId/currentStateId:");
  console.log("  Aggiornate:", updated);
  console.log("  Saltate (già valorizzate o stato non trovato):", skipped);
  console.log("  Nessun workflow per workspace/type:", noWorkflow);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
