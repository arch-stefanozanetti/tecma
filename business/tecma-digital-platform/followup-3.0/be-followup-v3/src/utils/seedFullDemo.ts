/**
 * Seed completo per test-zanetti: popola tutte le collection tz_* con dati dummy coerenti
 * (workspace, progetti, clienti, appartamenti, trattative, transizioni, azioni, calendario,
 * audit log, associazioni, quote, task, ecc.) così che Followup risulti popolato in modo realistico.
 */
import { ObjectId } from "mongodb";
import { connectDb, getDb } from "../config/db.js";

const WORKSPACE_NAME = "Test Workspace";
const N_CLIENTS = 28;
const N_APARTMENTS = 32;
const N_CALENDAR_EVENTS = 18;
const N_AUDIT_RECORDS = 40;
const N_ASSOCIATIONS = 12;
const N_REQUEST_ACTIONS = 20;
const N_TASKS = 6;

const REQUEST_STATUSES = ["new", "contacted", "viewing", "quote", "offer", "won", "lost"] as const;
const ACTION_TYPES = ["note", "call", "email", "meeting", "other"] as const;
const ASSOCIATION_STATUSES = ["proposta", "compromesso", "rogito"] as const;

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function seed() {
  const db = await connectDb();
  const nowIso = new Date().toISOString();

  // ─── Workspace e progetti ─────────────────────────────────────────────────
  const wsColl = db.collection("tz_workspaces");
  const wpColl = db.collection("tz_workspace_projects");
  const projectsColl = db.collection("tz_projects");

  let workspace =
    (await wsColl.findOne({ name: WORKSPACE_NAME })) ?? (await wsColl.findOne({}));
  if (!workspace) {
    const insert = await wsColl.insertOne({
      name: WORKSPACE_NAME,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    workspace = {
      _id: insert.insertedId,
      name: WORKSPACE_NAME,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }
  const workspaceId = String(workspace._id);

  let projectIds: string[] = (await wpColl.find({ workspaceId }).toArray()).map((d) => String(d.projectId));
  if (projectIds.length === 0) {
    const projs = await projectsColl.find({}).project({ _id: 1 }).limit(10).toArray();
    projectIds = projs.map((p) => (p._id instanceof ObjectId ? p._id.toHexString() : String(p._id)));
  }
  if (projectIds.length === 0) {
    projectIds = ["fake-sell-01", "fake-rent-01"];
    for (const pid of projectIds) {
      await wpColl.updateOne(
        { workspaceId, projectId: pid },
        { $setOnInsert: { workspaceId, projectId: pid, createdAt: nowIso } },
        { upsert: true }
      );
    }
  }

  // Assicura che i progetti esistano in tz_projects (nome, displayName, mode)
  const fakeProjects = [
    { _id: "fake-sell-01", name: "Residenze Centro", displayName: "Residenze Centro (Vendita)", mode: "sell" },
    { _id: "fake-rent-01", name: "Appartamenti Nord", displayName: "Appartamenti Nord (Affitto)", mode: "rent" },
  ];
  for (const p of fakeProjects) {
    const exists = await projectsColl.findOne({ _id: p._id });
    if (!exists) {
      await projectsColl.insertOne({
        _id: p._id,
        name: p.name,
        displayName: p.displayName,
        mode: p.mode,
        code: p._id,
        archived: false,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
  }

  const projectIdSell = projectIds[0] ?? "fake-sell-01";
  const projectIdRent = projectIds[1] ?? projectIds[0];

  // ─── Additional infos ──────────────────────────────────────────────────────
  const aiColl = db.collection("tz_additional_infos");
  const defaultInfos = [
    { name: "budget", type: "text", label: "Budget", subSection: "Cosa Desidera", position: 1 },
    { name: "tranquillo", type: "radio", label: "Tranquillo", options: ["Sì", "No", "Indifferente"], subSection: "Cosa Cerca", position: 2 },
    { name: "portineria", type: "radio", label: "Portineria", options: ["Sì", "No", "Indifferente"], subSection: "Cosa Cerca", position: 3 },
  ];
  for (const info of defaultInfos) {
    await aiColl.updateOne(
      { workspaceId, name: info.name },
      {
        $setOnInsert: {
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
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      },
      { upsert: true }
    );
  }

  // ─── Clienti ──────────────────────────────────────────────────────────────
  const clientsColl = db.collection("tz_clients");
  await clientsColl.deleteMany({ workspaceId });

  const clientDocs: Array<Record<string, unknown>> = [];
  const firstNames = ["Mario", "Laura", "Giuseppe", "Anna", "Luca", "Elena", "Paolo", "Francesca", "Andrea", "Chiara"];
  const lastNames = ["Rossi", "Bianchi", "Verdi", "Ferrari", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Conti"];
  for (let i = 0; i < N_CLIENTS; i++) {
    const n = i + 1;
    const isSell = n % 2 === 1;
    clientDocs.push({
      workspaceId,
      projectId: isSell ? projectIdSell : projectIdRent,
      fullName: `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]} ${n > 10 ? n : ""}`.trim(),
      email: `cliente.${n}@demo.example.com`,
      phone: `+39333${String(1000000 + n).slice(-7)}`,
      status: ["lead", "prospect", "client", "contacted", "negotiation"][i % 5],
      updatedAt: addDays(nowIso, -i),
      createdAt: addDays(nowIso, -n * 2),
    });
  }
  const clientResult = await clientsColl.insertMany(clientDocs);
  const clientIds = Object.values(clientResult.insertedIds).map((id) => String(id));

  // ─── Appartamenti ─────────────────────────────────────────────────────────
  const aptColl = db.collection("tz_apartments");
  await aptColl.deleteMany({ workspaceId });

  const aptDocs: Array<Record<string, unknown>> = [];
  for (let i = 0; i < N_APARTMENTS; i++) {
    const n = i + 1;
    const isSell = n % 2 === 1;
    const mode = isSell ? "SELL" : "RENT";
    const amount = isSell ? 180000 + n * 7000 : 750 + n * 35;
    aptDocs.push({
      workspaceId,
      projectId: isSell ? projectIdSell : projectIdRent,
      code: `${mode === "SELL" ? "S" : "R"}-${String(n).padStart(3, "0")}`,
      name: isSell ? `Appartamento Vendita ${n}` : `Appartamento Affitto ${n}`,
      status: i % 6 === 0 ? "RESERVED" : "AVAILABLE",
      mode,
      surfaceMq: 45 + (n % 8) * 12,
      rawPrice: {
        mode,
        amount,
        currency: "EUR",
        ...(mode === "RENT" ? { cadence: "MONTH" as const } : {}),
      },
      updatedAt: addDays(nowIso, -i),
    });
  }
  const aptResult = await aptColl.insertMany(aptDocs);
  const apartmentIds = Object.values(aptResult.insertedIds).map((id) => String(id));

  // ─── Trattative (requests) ────────────────────────────────────────────────
  const requestsColl = db.collection("tz_requests");
  await requestsColl.deleteMany({ workspaceId });

  const requestDocs: Array<Record<string, unknown>> = [];
  for (let i = 0; i < N_APARTMENTS; i++) {
    const status = REQUEST_STATUSES[i % REQUEST_STATUSES.length];
    const isRent = (i + 1) % 2 === 0;
    requestDocs.push({
      workspaceId,
      projectId: isRent ? projectIdRent : projectIdSell,
      clientId: clientIds[i % clientIds.length],
      apartmentId: apartmentIds[i],
      type: isRent ? "rent" : "sell",
      status,
      createdAt: addDays(nowIso, -i - 5),
      updatedAt: addDays(nowIso, -i),
    });
  }
  const reqResult = await requestsColl.insertMany(requestDocs);
  const requestIds = Object.values(reqResult.insertedIds).map((id) => String(id));

  // ─── Transizioni di stato (timeline trattative) ───────────────────────────
  const transitionsColl = db.collection("tz_request_transitions");
  if (requestIds.length > 0) {
    await transitionsColl.deleteMany({ requestId: { $in: requestIds } });
  }

  const transitions: Array<Record<string, unknown>> = [];
  const seq = ["new", "contacted", "viewing", "quote", "offer"] as const;
  for (let r = 0; r < Math.min(15, requestIds.length); r++) {
    const reqId = requestIds[r];
    const steps = 2 + (r % 3);
    for (let s = 0; s < steps && s < seq.length - 1; s++) {
      transitions.push({
        requestId: reqId,
        fromState: seq[s],
        toState: seq[s + 1],
        event: `TRANSITION_TO_${seq[s + 1].toUpperCase()}`,
        reason: s === 0 ? "Contatto iniziale" : "Avanzamento trattativa",
        createdAt: addDays(nowIso, -r * 2 - s),
      });
    }
  }
  if (transitions.length > 0) await transitionsColl.insertMany(transitions);

  // ─── Azioni trattative (note, call, email) ────────────────────────────────
  const actionsColl = db.collection("tz_request_actions");
  await actionsColl.deleteMany({ workspaceId });

  const actionTitles = [
    "Chiamata di follow-up",
    "Email inviata con scheda immobile",
    "Nota: cliente interessato a visita",
    "Riunione in ufficio",
    "Promemoria richiesta documenti",
  ];
  const actionDocs: Array<Record<string, unknown>> = [];
  for (let i = 0; i < N_REQUEST_ACTIONS; i++) {
    const reqIdx = i % requestIds.length;
    actionDocs.push({
      workspaceId,
      requestIds: [requestIds[reqIdx], ...(reqIdx + 1 < requestIds.length ? [requestIds[reqIdx + 1]] : [])],
      type: ACTION_TYPES[i % ACTION_TYPES.length],
      title: actionTitles[i % actionTitles.length],
      description: `Azione demo ${i + 1} per trattativa.`,
      createdAt: addDays(nowIso, -i),
      updatedAt: addDays(nowIso, -i),
    });
  }
  await actionsColl.insertMany(actionDocs);

  // ─── Calendario ───────────────────────────────────────────────────────────
  const calendarColl = db.collection("tz_calendar_events");
  await calendarColl.deleteMany({ workspaceId });

  const calendarDocs: Array<Record<string, unknown>> = [];
  const eventTitles = [
    "Visita immobile - Cliente Rossi",
    "Reminder rinnovo contratto",
    "Chiamata con cliente",
    "Incontro in agenzia",
    "Visita appartamento Via Roma",
  ];
  for (let i = 0; i < N_CALENDAR_EVENTS; i++) {
    const day = addDays(nowIso, i % 14 - 2);
    const start = day.slice(0, 11) + `${(9 + (i % 4))}:00:00.000Z`;
    const end = day.slice(0, 11) + `${(10 + (i % 4))}:00:00.000Z`;
    calendarDocs.push({
      workspaceId,
      projectId: i % 2 === 0 ? projectIdSell : projectIdRent,
      title: eventTitles[i % eventTitles.length] + (i > 5 ? ` #${i}` : ""),
      startsAt: start,
      endsAt: end,
      source: i % 2 === 0 ? "FOLLOWUP_SELL" : "FOLLOWUP_RENT",
      ...(i % 3 === 0 && clientIds[i % clientIds.length] ? { clientId: clientIds[i % clientIds.length] } : {}),
      ...(i % 4 === 0 && apartmentIds[i % apartmentIds.length] ? { apartmentId: apartmentIds[i % apartmentIds.length] } : {}),
    });
  }
  await calendarColl.insertMany(calendarDocs);

  // ─── Audit log ────────────────────────────────────────────────────────────
  const auditColl = db.collection("tz_audit_log");
  await auditColl.deleteMany({ workspaceId });

  const auditDocs: Array<Record<string, unknown>> = [];
  const actions = ["client.created", "client.updated", "apartment.created", "request.created", "request.status_changed", "calendar.event_created"];
  for (let i = 0; i < N_AUDIT_RECORDS; i++) {
    const action = actions[i % actions.length];
    const entityType = action.split(".")[0];
    const entityId =
      entityType === "client" ? clientIds[i % clientIds.length]
      : entityType === "apartment" ? apartmentIds[i % apartmentIds.length]
      : entityType === "request" ? requestIds[i % requestIds.length]
      : new ObjectId().toHexString();
    auditDocs.push({
      at: new Date(addDays(nowIso, -i)),
      action,
      workspaceId,
      projectId: i % 2 === 0 ? projectIdSell : projectIdRent,
      entityType,
      entityId,
      actor: { type: "user" as const, email: "demo@tecma.demo" },
      payload: i % 3 === 0 ? { note: "Seed demo" } : undefined,
    });
  }
  await auditColl.insertMany(auditDocs);

  // ─── Associazione appartamento-cliente ─────────────────────────────────────
  const assocColl = db.collection("tz_apartment_client_associations");
  await assocColl.deleteMany({ workspaceId });

  const assocDocs: Array<Record<string, unknown>> = [];
  for (let i = 0; i < N_ASSOCIATIONS; i++) {
    const status = ASSOCIATION_STATUSES[i % ASSOCIATION_STATUSES.length];
    assocDocs.push({
      workspaceId,
      projectId: i % 2 === 0 ? projectIdSell : projectIdRent,
      apartmentId: apartmentIds[i % apartmentIds.length],
      clientId: clientIds[i % clientIds.length],
      status,
      active: true,
      updatedAt: addDays(nowIso, -i),
      createdAt: addDays(nowIso, -i - 2),
    });
  }
  await assocColl.insertMany(assocDocs);

  // ─── Quote (collegate a una trattativa) ───────────────────────────────────
  const quotesColl = db.collection("tz_quotes");
  const quoteId1 = new ObjectId();
  const quoteId2 = new ObjectId();
  await quotesColl.deleteMany({ _id: { $in: [quoteId1, quoteId2] } });
  await quotesColl.insertMany([
    {
      _id: quoteId1,
      status: "sent",
      quoteNumber: "Q-2026-001",
      expiryOn: addDays(nowIso, 30),
      customQuote: { totalPrice: 195000 },
    },
    {
      _id: quoteId2,
      status: "accepted",
      quoteNumber: "Q-2026-002",
      expiryOn: addDays(nowIso, 14),
      customQuote: { totalPrice: 1250 },
    },
  ]);
  if (requestIds.length >= 2) {
    await requestsColl.updateOne(
      { _id: new ObjectId(requestIds[0]) },
      { $set: { quoteId: String(quoteId1), quoteStatus: "sent", quoteNumber: "Q-2026-001", quoteExpiryOn: addDays(nowIso, 30), quoteTotalPrice: 195000, updatedAt: nowIso } }
    );
    await requestsColl.updateOne(
      { _id: new ObjectId(requestIds[1]) },
      { $set: { quoteId: String(quoteId2), quoteStatus: "accepted", quoteNumber: "Q-2026-002", updatedAt: nowIso } }
    );
  }

  // ─── Task ─────────────────────────────────────────────────────────────────
  const tasksColl = db.collection("tz_tasks");
  await tasksColl.deleteMany({ workspaceId });

  const taskTitles = [
    "Richiedere documenti al cliente",
    "Prenotare visita notarile",
    "Inviare preventivo personalizzato",
    "Follow-up post visita",
    "Verificare disponibilità immobile",
    "Aggiornare scheda cliente",
  ];
  const taskDocs: Array<Record<string, unknown>> = [];
  for (let i = 0; i < N_TASKS; i++) {
    taskDocs.push({
      workspaceId,
      projectId: i % 2 === 0 ? projectIdSell : projectIdRent,
      title: taskTitles[i],
      description: `Task demo ${i + 1}.`,
      status: i % 3 === 0 ? "done" : "open",
      dueAt: addDays(nowIso, i + 2),
      createdAt: addDays(nowIso, -i),
      updatedAt: addDays(nowIso, -i),
    });
  }
  await tasksColl.insertMany(taskDocs);

  // ─── AI suggestions (opzionale) ────────────────────────────────────────────
  const aiSuggestionsColl = db.collection("tz_ai_suggestions");
  await aiSuggestionsColl.deleteMany({ workspaceId });

  await aiSuggestionsColl.insertMany([
    {
      workspaceId,
      projectIds,
      title: "Proposta ferma da 7 giorni",
      reason: "Nessun avanzamento su proposta cliente Bianchi",
      recommendedAction: "Contattare cliente e aggiornare status",
      risk: "high",
      requiresApproval: true,
      status: "pending",
      score: 88,
      createdAt: nowIso,
    },
    {
      workspaceId,
      projectIds,
      title: "Cliente inattivo da 20 giorni",
      reason: "Nessun update su cliente Rossi",
      recommendedAction: "Creare task reminder follow-up",
      risk: "medium",
      requiresApproval: true,
      status: "pending",
      score: 72,
      createdAt: nowIso,
    },
    {
      workspaceId,
      projectIds,
      title: "Unità disponibile senza match",
      reason: "Appartamento S-005 senza associazioni attive",
      recommendedAction: "Avviare matching clienti caldi",
      risk: "low",
      requiresApproval: true,
      status: "pending",
      score: 55,
      createdAt: nowIso,
    },
  ]);

  // ─── Domain events (opzionale) ─────────────────────────────────────────────
  const domainEventsColl = db.collection("tz_domain_events");
  const existingEvents = await domainEventsColl.countDocuments({});
  if (existingEvents === 0) {
    await domainEventsColl.insertMany([
      {
        type: "workspace.seeded",
        workspaceId,
        projectId: projectIdSell,
        entityId: workspaceId,
        payload: { source: "seedFullDemo", at: nowIso },
        actor: { type: "system" as const },
        createdAt: nowIso,
      },
      {
        type: "request.bulk_created",
        workspaceId,
        projectId: projectIdSell,
        entityId: requestIds[0],
        payload: { count: requestIds.length },
        actor: { type: "system" as const },
        createdAt: nowIso,
      },
    ]);
  }

  // eslint-disable-next-line no-console
  console.log("Seed full demo completato in test-zanetti:");
  // eslint-disable-next-line no-console
  console.log(`  workspaceId=${workspaceId}`);
  // eslint-disable-next-line no-console
  console.log(`  progetti=${projectIds.length}, clienti=${clientIds.length}, appartamenti=${apartmentIds.length}`);
  // eslint-disable-next-line no-console
  console.log(`  trattative=${requestIds.length}, transizioni=${transitions.length}, azioni=${actionDocs.length}`);
  // eslint-disable-next-line no-console
  console.log(`  calendario=${calendarDocs.length}, audit=${auditDocs.length}, associazioni=${assocDocs.length}`);
  // eslint-disable-next-line no-console
  console.log(`  task=${taskDocs.length}, ai_suggestions=3`);
  process.exit(0);
}

seed().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
