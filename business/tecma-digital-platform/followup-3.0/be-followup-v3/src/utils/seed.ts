import { connectDb } from "../config/db.js";

const seed = async () => {
  const db = await connectDb();

  // Workspace test (tz_workspaces)
  const wsColl = db.collection("tz_workspaces");
  const wpColl = db.collection("tz_workspace_projects");
  const aiColl = db.collection("tz_additional_infos");

  const existingWs = await wsColl.findOne({ name: "Test Workspace" });
  let workspaceId: string;
  if (existingWs) {
    workspaceId = String(existingWs._id);
  } else {
    const now = new Date().toISOString();
    const insert = await wsColl.insertOne({
      name: "Test Workspace",
      createdAt: now,
      updatedAt: now,
    });
    workspaceId = insert.insertedId.toHexString();
  }

  // Associa progetti al workspace (tz_workspace_projects)
  const projectIds = ["project-sell-01", "project-rent-01"];
  for (const pid of projectIds) {
    const exists = await wpColl.findOne({ workspaceId, projectId: pid });
    if (!exists) {
      await wpColl.insertOne({
        workspaceId,
        projectId: pid,
        createdAt: new Date().toISOString(),
      });
    }
  }

  // Additional infos di esempio (tz_additional_infos)
  const defaultInfos = [
    { name: "budget", type: "text", label: "Budget", subSection: "Cosa Desidera", position: 1 },
    { name: "tranquillo", type: "radio", label: "Tranquillo", options: ["Sì", "No", "Indifferente"], subSection: "Cosa Cerca", position: 2 },
    { name: "portineria", type: "radio", label: "Portineria", options: ["Sì", "No", "Indifferente"], subSection: "Cosa Cerca", position: 3 },
  ];
  for (const info of defaultInfos) {
    const exists = await aiColl.findOne({ workspaceId, name: info.name });
    if (!exists) {
      const now = new Date().toISOString();
      await aiColl.insertOne({
        workspaceId,
        name: info.name,
        type: info.type,
        label: info.label,
        path: "additionalInfo",
        options: info.options,
        subSection: info.subSection,
        position: info.position,
        required: false,
        active: true,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  // Usa workspaceId per i dati esistenti (dev-1 per retrocompatibilità)
  const dataWorkspaceId = "dev-1";
  await db.collection("calendar_events").deleteMany({ workspaceId: dataWorkspaceId });
  await db.collection("clients").deleteMany({ workspaceId: dataWorkspaceId });
  await db.collection("apartments").deleteMany({ workspaceId: dataWorkspaceId });

  await db.collection("calendar_events").insertMany([
    {
      workspaceId: dataWorkspaceId,
      projectId: "project-sell-01",
      title: "Visita cliente Rossi",
      startsAt: "2026-03-03T09:00:00.000Z",
      endsAt: "2026-03-03T10:00:00.000Z",
      source: "FOLLOWUP_SELL"
    },
    {
      workspaceId: dataWorkspaceId,
      projectId: "project-rent-01",
      title: "Reminder rinnovo contratto",
      startsAt: "2026-03-03T11:00:00.000Z",
      endsAt: "2026-03-03T11:30:00.000Z",
      source: "FOLLOWUP_RENT"
    }
  ]);

  await db.collection("clients").insertMany([
    {
      workspaceId: dataWorkspaceId,
      projectId: "project-sell-01",
      fullName: "Mario Rossi",
      email: "mario.rossi@example.com",
      phone: "+39333111222",
      status: "NEGOTIATION",
      updatedAt: "2026-03-02T11:00:00.000Z"
    },
    {
      workspaceId: dataWorkspaceId,
      projectId: "project-rent-01",
      fullName: "Laura Bianchi",
      email: "laura.bianchi@example.com",
      phone: "+39333999888",
      status: "CONTACTED",
      updatedAt: "2026-03-02T10:00:00.000Z"
    }
  ]);

  await db.collection("apartments").insertMany([
    {
      workspaceId: dataWorkspaceId,
      projectId: "project-sell-01",
      code: "S-A12",
      name: "Attico A12",
      status: "AVAILABLE",
      mode: "SELL",
      surfaceMq: 124,
      rawPrice: { mode: "SELL", amount: 420000, currency: "EUR" },
      updatedAt: "2026-03-02T11:30:00.000Z"
    },
    {
      workspaceId: dataWorkspaceId,
      projectId: "project-rent-01",
      code: "R-B07",
      name: "Bilocale B07",
      status: "AVAILABLE",
      mode: "RENT",
      surfaceMq: 58,
      rawPrice: { mode: "RENT", amount: 1350, currency: "EUR", cadence: "MONTH" },
      updatedAt: "2026-03-02T09:30:00.000Z"
    }
  ]);

  // eslint-disable-next-line no-console
  console.log("Seed completed. Workspace test:", workspaceId, "| Data workspace:", dataWorkspaceId);
  process.exit(0);
};

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
