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

  // Associa progetti fake al workspace (tz_workspace_projects)
  const projectIds = ["fake-sell-01", "fake-rent-01"];
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

  // Usa il workspace di test anche come workspace dati per i dummy (clienti, appartamenti, calendario)
  const dataWorkspaceId = workspaceId;
  await db.collection("tz_calendar_events").deleteMany({ workspaceId: dataWorkspaceId });
  await db.collection("tz_clients").deleteMany({ workspaceId: dataWorkspaceId });
  await db.collection("tz_apartments").deleteMany({ workspaceId: dataWorkspaceId });

  await db.collection("tz_calendar_events").insertMany([
    {
      workspaceId: dataWorkspaceId,
      projectId: "fake-sell-01",
      title: "Visita cliente Rossi",
      startsAt: "2026-03-03T09:00:00.000Z",
      endsAt: "2026-03-03T10:00:00.000Z",
      source: "FOLLOWUP_SELL"
    },
    {
      workspaceId: dataWorkspaceId,
      projectId: "fake-rent-01",
      title: "Reminder rinnovo contratto",
      startsAt: "2026-03-03T11:00:00.000Z",
      endsAt: "2026-03-03T11:30:00.000Z",
      source: "FOLLOWUP_RENT"
    }
  ]);

  const baseClients = [
    {
      workspaceId: dataWorkspaceId,
      projectId: "fake-sell-01",
      firstName: "Mario",
      lastName: "Rossi",
      fullName: "Mario Rossi",
      email: "mario.rossi@example.com",
      phone: "+39333111222",
      status: "NEGOTIATION",
      updatedAt: "2026-03-02T11:00:00.000Z"
    },
    {
      workspaceId: dataWorkspaceId,
      projectId: "fake-rent-01",
      firstName: "Laura",
      lastName: "Bianchi",
      fullName: "Laura Bianchi",
      email: "laura.bianchi@example.com",
      phone: "+39333999888",
      status: "CONTACTED",
      updatedAt: "2026-03-02T10:00:00.000Z"
    }
  ];

  const extraClients = Array.from({ length: 10 }).map((_, idx) => {
    const n = idx + 1;
    const isSell = n % 2 === 1;
    return {
      workspaceId: dataWorkspaceId,
      projectId: isSell ? "fake-sell-01" : "fake-rent-01",
      firstName: "Cliente",
      lastName: `Demo ${String(n).padStart(2, "0")}`,
      fullName: `Cliente Demo ${String(n).padStart(2, "0")}`,
      email: `cliente.demo${n}@example.com`,
      phone: `+39333111${String(200 + n).padStart(3, "0")}`,
      status: isSell ? "lead" : "prospect",
      updatedAt: `2026-03-01T0${(n % 9) + 1}:00:00.000Z`
    };
  });

  const allClients = [...baseClients, ...extraClients];
  const clientsResult = await db.collection("tz_clients").insertMany(allClients);

  const baseApartments = [
    {
      workspaceId: dataWorkspaceId,
      projectId: "fake-sell-01",
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
      projectId: "fake-rent-01",
      code: "R-B07",
      name: "Bilocale B07",
      status: "AVAILABLE",
      mode: "RENT",
      surfaceMq: 58,
      rawPrice: { mode: "RENT", amount: 1350, currency: "EUR", cadence: "MONTH" },
      updatedAt: "2026-03-02T09:30:00.000Z"
    }
  ];

  const extraApartments = Array.from({ length: 10 }).map((_, idx) => {
    const n = idx + 1;
    const isSell = n % 2 === 1;
    return {
      workspaceId: dataWorkspaceId,
      projectId: isSell ? "fake-sell-01" : "fake-rent-01",
      code: `${isSell ? "S" : "R"}-EX${String(n).padStart(2, "0")}`,
      name: isSell ? `Appartamento Vendita ${n}` : `Appartamento Affitto ${n}`,
      status: "AVAILABLE",
      mode: isSell ? "SELL" : "RENT",
      surfaceMq: 50 + n * 5,
      rawPrice: {
        mode: isSell ? "SELL" : "RENT",
        amount: isSell ? 250000 + n * 15000 : 900 + n * 50,
        currency: "EUR",
        ...(isSell ? {} : { cadence: "MONTH" as const })
      },
      updatedAt: `2026-03-01T1${(n % 9) + 1}:30:00.000Z`
    };
  });

  const allApartments = [...baseApartments, ...extraApartments];
  const apartmentsResult = await db.collection("tz_apartments").insertMany(allApartments);

  // Seed di esempio per tz_requests (trattative) collegando i dummy sopra
  const requestsColl = db.collection("tz_requests");
  await requestsColl.deleteMany({ workspaceId: dataWorkspaceId });

  const marioId = String(clientsResult.insertedIds["0"]);
  const lauraId = String(clientsResult.insertedIds["1"]);
  const atticoId = String(apartmentsResult.insertedIds["0"]);
  const bilocaleId = String(apartmentsResult.insertedIds["1"]);

  const requestsToInsert: Array<Record<string, unknown>> = [
    {
      workspaceId: dataWorkspaceId,
      projectId: "fake-sell-01",
      clientId: marioId,
      apartmentId: atticoId,
      type: "sell",
      status: "new",
      createdAt: "2026-03-02T12:00:00.000Z",
      updatedAt: "2026-03-02T12:00:00.000Z",
    },
    {
      workspaceId: dataWorkspaceId,
      projectId: "fake-rent-01",
      clientId: lauraId,
      apartmentId: bilocaleId,
      type: "rent",
      status: "contacted",
      createdAt: "2026-03-02T12:30:00.000Z",
      updatedAt: "2026-03-02T13:00:00.000Z",
    },
  ];

  // Aggiungi trattative per i 10 clienti/appartamenti extra
  for (let i = 0; i < extraClients.length; i += 1) {
    const clientIndex = 2 + i;
    const aptIndex = 2 + i;
    const clientDef = allClients[clientIndex];
    const aptDef = allApartments[aptIndex];
    const clientDbId = String((clientsResult.insertedIds as Record<number, unknown>)[clientIndex]);
    const aptDbId = String((apartmentsResult.insertedIds as Record<number, unknown>)[aptIndex]);
    const isRent = clientDef.projectId === "fake-rent-01";
    const statusCycle = ["new", "contacted", "viewing", "quote", "offer", "won", "lost"] as const;
    const status = statusCycle[i % statusCycle.length];

    requestsToInsert.push({
      workspaceId: dataWorkspaceId,
      projectId: clientDef.projectId,
      clientId: clientDbId,
      apartmentId: aptDbId,
      type: isRent ? "rent" : "sell",
      status,
      createdAt: aptDef.updatedAt,
      updatedAt: aptDef.updatedAt,
    });
  }

  await requestsColl.insertMany(requestsToInsert);

  // eslint-disable-next-line no-console
  console.log("Seed completed. Workspace test:", workspaceId, "| Data workspace:", dataWorkspaceId);
  process.exit(0);
};

seed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
