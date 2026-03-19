/**
 * Script che crea 4 progetti fake (2 sell, 2 rent) in tz_projects (main DB) e li associa al Test Workspace.
 * Esegui: npm run seed:fake-projects
 */
import { connectDb, getDb } from "../config/db.js";

interface FakeProject {
  _id: string;
  id: string;
  name: string;
  code: string;
  displayName: string;
  hostKey: string;
  assetKey: string;
  feVendorKey: string;
  mode: "rent" | "sell";
  broker: null;
  isCommercialDemo: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

const now = new Date().toISOString();

const FAKE_PROJECTS: FakeProject[] = [
  {
    _id: "fake-sell-01",
    id: "fake-sell-01",
    name: "Residenze Centro",
    code: "residenze-centro",
    displayName: "Residenze Centro (Sell)",
    hostKey: "fake-sell-01",
    assetKey: "fake-sell-01",
    feVendorKey: "residenze-centro-sell",
    mode: "sell",
    broker: null,
    isCommercialDemo: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: "fake-sell-02",
    id: "fake-sell-02",
    name: "Villa Verde",
    code: "villa-verde",
    displayName: "Villa Verde (Sell)",
    hostKey: "fake-sell-02",
    assetKey: "fake-sell-02",
    feVendorKey: "villa-verde-sell",
    mode: "sell",
    broker: null,
    isCommercialDemo: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: "fake-rent-01",
    id: "fake-rent-01",
    name: "Appartamenti Nord",
    code: "appartamenti-nord",
    displayName: "Appartamenti Nord (Rent)",
    hostKey: "fake-rent-01",
    assetKey: "fake-rent-01",
    feVendorKey: "appartamenti-nord-rent",
    mode: "rent",
    broker: null,
    isCommercialDemo: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  },
  {
    _id: "fake-rent-02",
    id: "fake-rent-02",
    name: "Residence Via Roma",
    code: "residence-via-roma",
    displayName: "Residence Via Roma (Rent)",
    hostKey: "fake-rent-02",
    assetKey: "fake-rent-02",
    feVendorKey: "residence-via-roma-rent",
    mode: "rent",
    broker: null,
    isCommercialDemo: false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  },
];

const seedFakeProjects = async () => {
  await connectDb();

  const mainDb = getDb();
  const projectsColl = mainDb.collection("tz_projects");
  const wsColl = mainDb.collection("tz_workspaces");
  const wpColl = mainDb.collection("tz_workspace_projects");

  // 1. Crea o aggiorna i 4 progetti in tz_projects (main DB)
  for (const proj of FAKE_PROJECTS) {
    const filter = { _id: proj._id } as never;
    const exists = await projectsColl.findOne(filter);
    if (exists) {
      await projectsColl.updateOne(
        filter,
        {
          $set: {
            name: proj.name,
            displayName: proj.displayName,
            code: proj.code,
            hostKey: proj.hostKey,
            assetKey: proj.assetKey,
            feVendorKey: proj.feVendorKey,
            mode: proj.mode,
            archived: false,
            updatedAt: new Date().toISOString(),
          },
        }
      );
      // eslint-disable-next-line no-console
      console.log("Progetto aggiornato:", proj._id);
    } else {
      await projectsColl.insertOne(proj as never);
      // eslint-disable-next-line no-console
      console.log("Progetto creato:", proj._id);
    }
  }

  // 2. Ottieni o crea Test Workspace
  const existingWs = await wsColl.findOne({ name: "Test Workspace" });
  let workspaceId: string;
  if (existingWs) {
    workspaceId = String(existingWs._id);
    // eslint-disable-next-line no-console
    console.log("Workspace esistente:", workspaceId);
  } else {
    const tsNow = new Date().toISOString();
    const insert = await wsColl.insertOne({
      name: "Test Workspace",
      createdAt: tsNow,
      updatedAt: tsNow,
    });
    workspaceId = insert.insertedId.toHexString();
    // eslint-disable-next-line no-console
    console.log("Workspace creato:", workspaceId);
  }

  // 3. Associa i 4 progetti al workspace
  for (const proj of FAKE_PROJECTS) {
    const pid = String(proj._id);
    const exists = await wpColl.findOne({ workspaceId, projectId: pid });
    if (!exists) {
      await wpColl.insertOne({
        workspaceId,
        projectId: pid,
        createdAt: new Date().toISOString(),
      });
      // eslint-disable-next-line no-console
      console.log("Associato al workspace:", pid);
    } else {
      // eslint-disable-next-line no-console
      console.log("Già associato:", pid);
    }
  }

  // eslint-disable-next-line no-console
  console.log("\nSeed completato. 4 progetti fake (2 sell, 2 rent) creati e associati a Test Workspace.");
  process.exit(0);
};

seedFakeProjects().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
