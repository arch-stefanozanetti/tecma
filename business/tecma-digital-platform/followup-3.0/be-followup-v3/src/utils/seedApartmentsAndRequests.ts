/**
 * Seed: 30-40 appartamenti nel Test Workspace + trattative (tz_requests) collegate.
 * Usa solo il DB principale (test-zanetti).
 */
import { ObjectId } from "mongodb";
import { connectDb, getDb } from "../config/db.js";

const APARTMENT_COUNT = 35; // 30-40
const REQUEST_STATUSES = ["new", "contacted", "viewing", "quote", "offer", "won", "lost"] as const;

const seed = async () => {
  const db = await connectDb();
  const wsColl = db.collection("tz_workspaces");
  const wpColl = db.collection("tz_workspace_projects");
  const projectsColl = db.collection("tz_projects");
  const aptColl = db.collection("tz_apartments");
  const clientsColl = db.collection("tz_clients");
  const requestsColl = db.collection("tz_requests");

  // Workspace di test (nome "Test Workspace" o primo disponibile)
  let workspace =
    (await wsColl.findOne({ name: "Test Workspace" })) ?? (await wsColl.findOne({}));
  if (!workspace) {
    const now = new Date().toISOString();
    const insert = await wsColl.insertOne({
      name: "Test Workspace",
      createdAt: now,
      updatedAt: now,
    });
    workspace = { _id: insert.insertedId, name: "Test Workspace", createdAt: now, updatedAt: now };
  }
  const workspaceId = String(workspace._id);

  // Progetti associati al workspace
  const wpDocs = await wpColl.find({ workspaceId }).toArray();
  let projectIds: string[] = wpDocs.map((d) => String(d.projectId)).filter(Boolean);
  if (projectIds.length === 0) {
    const projs = await projectsColl.find({}).project({ _id: 1 }).limit(20).toArray();
    projectIds = projs.map((p) => (p._id instanceof ObjectId ? p._id.toHexString() : String(p._id)));
  }
  if (projectIds.length === 0) {
    projectIds = ["fake-sell-01", "fake-rent-01"];
    for (const pid of projectIds) {
      await wpColl.updateOne(
        { workspaceId, projectId: pid },
        { $setOnInsert: { workspaceId, projectId: pid, createdAt: new Date().toISOString() } },
        { upsert: true }
      );
    }
  }

  const nowIso = new Date().toISOString();

  // Clienti: ne servono almeno quanto le trattative (riuso per più trattative)
  const existingClients = await clientsColl.find({ workspaceId }).limit(APARTMENT_COUNT + 5).toArray();
  let clientIds: string[] = existingClients.map((c) => String(c._id));
  if (clientIds.length < APARTMENT_COUNT) {
    const toInsert = Array.from({ length: APARTMENT_COUNT - clientIds.length }, (_, i) => {
      const n = clientIds.length + i + 1;
      const isSell = n % 2 === 1;
      return {
        workspaceId,
        projectId: isSell ? projectIds[0] : projectIds[projectIds.length - 1] ?? projectIds[0],
        firstName: "Cliente",
        lastName: `Seed ${String(n).padStart(2, "0")}`,
        fullName: `Cliente Seed ${String(n).padStart(2, "0")}`,
        email: `cliente.seed${n}@example.com`,
        phone: `+39333111${String(300 + n).padStart(3, "0")}`,
        status: "lead",
        updatedAt: nowIso,
      };
    });
    const inserted = await clientsColl.insertMany(toInsert);
    clientIds = [...clientIds, ...Object.values(inserted.insertedIds).map((id) => String(id))];
  }

  // 30-40 appartamenti distribuiti sui progetti
  const apartmentsToInsert: Array<Record<string, unknown>> = [];
  for (let i = 0; i < APARTMENT_COUNT; i++) {
    const n = i + 1;
    const isSell = n % 2 === 1;
    const projectId = projectIds[i % projectIds.length] ?? projectIds[0];
    const mode = isSell ? "SELL" : "RENT";
    const amount = isSell ? 180000 + n * 8000 : 800 + n * 30;
    apartmentsToInsert.push({
      workspaceId,
      projectId,
      code: `${mode === "SELL" ? "S" : "R"}-${String(n).padStart(3, "0")}`,
      name: mode === "SELL" ? `Appartamento Vendita ${n}` : `Appartamento Affitto ${n}`,
      status: i % 5 === 0 ? "RESERVED" : "AVAILABLE",
      mode,
      surfaceMq: 45 + (n % 6) * 15,
      rawPrice: {
        mode,
        amount,
        currency: "EUR",
        ...(mode === "RENT" ? { cadence: "MONTH" as const } : {}),
      },
      updatedAt: nowIso,
    });
  }

  await aptColl.deleteMany({ workspaceId });
  const aptResult = await aptColl.insertMany(apartmentsToInsert);
  const apartmentIds = Object.values(aptResult.insertedIds).map((id) => String(id));

  // Trattative: una per appartamento, cliente a rotazione
  await requestsColl.deleteMany({ workspaceId });
  const requestsToInsert: Array<Record<string, unknown>> = [];
  for (let i = 0; i < apartmentIds.length; i++) {
    const status = REQUEST_STATUSES[i % REQUEST_STATUSES.length];
    const isRent = (i + 1) % 2 === 0;
    const projectId = projectIds[i % projectIds.length] ?? projectIds[0];
    requestsToInsert.push({
      workspaceId,
      projectId,
      clientId: clientIds[i % clientIds.length],
      apartmentId: apartmentIds[i],
      type: isRent ? "rent" : "sell",
      status,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
  }
  await requestsColl.insertMany(requestsToInsert);

  // eslint-disable-next-line no-console
  console.log(
    `Seed completato: workspaceId=${workspaceId}, progetti=${projectIds.length}, ` +
      `appartamenti=${apartmentIds.length}, trattative=${requestsToInsert.length}`
  );
  process.exit(0);
};

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
