/**
 * Profilazione clienti e appartamenti: arricchisce i documenti esistenti in tz_clients
 * e tz_apartments con dati inventati (city, email, phone, source, budget per clienti;
 * code, name, surfaceMq, rawPrice, status, mode per appartamenti) così che le tab
 * "Appartamenti papabili" (scheda cliente) e "Clienti papabili" (scheda appartamento)
 * mostrino liste leggibili dopo aver eseguito il matching.
 *
 * Eseguire dopo il seed principale (es. npm run seed o seedFullDemo):
 *   npx ts-node src/utils/seedMatchingProfile.ts
 * oppure: npm run seed:matching-profile
 */
import { connectDb } from "../config/db.js";

const CITIES = [
  "Milano",
  "Roma",
  "Torino",
  "Napoli",
  "Firenze",
  "Bologna",
  "Genova",
  "Palermo",
  "Venezia",
  "Verona",
  "Bari",
  "Padova",
  "Trieste",
  "Brescia",
  "Modena",
];

const SOURCES = ["Sito", "Passaggio", "Annuncio", "Agenzia", "Social", "Referral"];

async function seedMatchingProfile() {
  const db = await connectDb();
  const nowIso = new Date().toISOString();
  const clientsColl = db.collection("tz_clients");
  const aptColl = db.collection("tz_apartments");

  // Opzionale: filtra per workspace (primo workspace trovato)
  const wsColl = db.collection("tz_workspaces");
  const workspace = await wsColl.findOne({});
  const workspaceId = workspace ? String(workspace._id) : null;

  // ─── Clienti: city, email, phone, source, additionalInfo.budget ───────────
  const clientFilter = workspaceId ? { workspaceId } : {};
  const clients = await clientsColl.find(clientFilter).toArray();
  for (let i = 0; i < clients.length; i++) {
    const c = clients[i] as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: nowIso };
    if (!c.city || (typeof c.city === "string" && !c.city.trim())) {
      updates.city = CITIES[i % CITIES.length];
    }
    if (!c.email || (typeof c.email === "string" && !c.email.trim())) {
      updates.email = `cliente.profilo${i + 1}@demo.example.com`;
    }
    if (!c.phone || (typeof c.phone === "string" && !c.phone.trim())) {
      updates.phone = `+39333${String(1000000 + (i % 10000000)).slice(-7)}`;
    }
    if (!c.source || (typeof c.source === "string" && !c.source.trim())) {
      updates.source = SOURCES[i % SOURCES.length];
    }
    const budget = (c.additionalInfo as Record<string, unknown>)?.budget;
    if (budget == null || (typeof budget === "string" && !budget.trim())) {
      const amount = 150000 + (i % 20) * 25000;
      updates.additionalInfo = {
        ...(typeof c.additionalInfo === "object" && c.additionalInfo !== null ? (c.additionalInfo as Record<string, unknown>) : {}),
        budget: String(amount),
      };
    }
    if (Object.keys(updates).length > 1) {
      await clientsColl.updateOne({ _id: c._id as import("mongodb").ObjectId }, { $set: updates });
    }
  }

  // ─── Appartamenti: code, name, surfaceMq, rawPrice, status, mode ───────────
  const aptFilter = workspaceId ? { workspaceId } : {};
  const apartments = await aptColl.find(aptFilter).toArray();
  for (let i = 0; i < apartments.length; i++) {
    const a = apartments[i] as Record<string, unknown>;
    const updates: Record<string, unknown> = { updatedAt: nowIso };
    const mode = (a.mode as string) || (i % 2 === 0 ? "SELL" : "RENT");
    const isSell = String(mode).toUpperCase() === "SELL";

    if (!a.code || (typeof a.code === "string" && !a.code.trim())) {
      updates.code = `${isSell ? "S" : "R"}-${String(i + 1).padStart(3, "0")}`;
    }
    if (!a.name || (typeof a.name === "string" && !a.name.trim())) {
      updates.name = isSell ? `Appartamento Vendita ${i + 1}` : `Appartamento Affitto ${i + 1}`;
    }
    if (a.surfaceMq == null || Number(a.surfaceMq) === 0) {
      updates.surfaceMq = 45 + (i % 8) * 12;
    }
    if (!a.rawPrice || typeof (a.rawPrice as Record<string, unknown>)?.amount !== "number") {
      const amount = isSell ? 180000 + (i + 1) * 7000 : 750 + (i + 1) * 35;
      updates.rawPrice = {
        mode,
        amount,
        currency: "EUR",
        ...(isSell ? {} : { cadence: "MONTH" }),
      };
    }
    if (!a.status || (typeof a.status === "string" && !a.status.trim())) {
      updates.status = i % 6 === 0 ? "RESERVED" : "AVAILABLE";
    }
    if (!a.mode || (typeof a.mode === "string" && !a.mode.trim())) {
      updates.mode = mode;
    }
    if (Object.keys(updates).length > 1) {
      await aptColl.updateOne({ _id: a._id as import("mongodb").ObjectId }, { $set: updates });
    }
  }

  console.log(
    `Profilazione completata: ${clients.length} clienti, ${apartments.length} appartamenti aggiornati (workspaceId: ${workspaceId ?? "tutti"}).`
  );
}

seedMatchingProfile()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
