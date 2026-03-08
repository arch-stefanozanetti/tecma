import type { ApartmentRow, ClientRow } from "../types/domain";
import type { CockpitFeedItem } from "./types";

export const mockClients: ClientRow[] = Array.from({ length: 64 }).map((_, index) => ({
  _id: `client-${index + 1}`,
  projectId: index % 2 === 0 ? "proj-alpha" : "proj-beta",
  fullName: `Cliente ${index + 1} Demo`,
  email: `cliente${index + 1}@example.com`,
  phone: `+39 333 10${String(index).padStart(3, "0")}`,
  status: index % 3 === 0 ? "lead" : index % 3 === 1 ? "prospect" : "client",
  updatedAt: new Date(Date.now() - index * 86400000).toISOString(),
  source: index % 2 === 0 ? "Meta Ads" : "Referral",
  city: index % 2 === 0 ? "Milano" : "Roma",
  myhomeVersion: index % 2 === 0 ? "v3" : "v2",
  createdBy: index % 2 === 0 ? "team-sales" : "team-marketing"
}));

export const mockApartments: ApartmentRow[] = Array.from({ length: 54 }).map((_, index) => ({
  _id: `apt-${index + 1}`,
  projectId: index % 2 === 0 ? "proj-alpha" : "proj-beta",
  code: `A-${100 + index}`,
  name: `Unit ${100 + index}`,
  status: (index % 4 === 0 ? "AVAILABLE" : index % 4 === 1 ? "RESERVED" : index % 4 === 2 ? "SOLD" : "RENTED") as
    | "AVAILABLE"
    | "RESERVED"
    | "SOLD"
    | "RENTED",
  mode: (index % 2 === 0 ? "SELL" : "RENT") as "RENT" | "SELL",
  surfaceMq: 45 + (index % 8) * 10,
  normalizedPrice: {
    display: index % 2 === 0 ? `EUR ${(180000 + index * 3200).toLocaleString("it-IT")}` : `EUR ${(900 + index * 24).toLocaleString("it-IT")}/mese`
  },
  updatedAt: new Date(Date.now() - index * 43200000).toISOString()
}));

export const mockCockpitFeed: CockpitFeedItem[] = [
  {
    id: "risk-1",
    title: "3 trattative ferme da oltre 7 giorni",
    summary: "Compromessi in attesa di follow-up commerciale.",
    category: "risk",
    priority: "high",
    cta: "Crea batch reminder"
  },
  {
    id: "opp-1",
    title: "9 clienti caldi senza proposta",
    summary: "Matching suggerito su unità disponibili con alta conversione.",
    category: "opportunity",
    priority: "medium",
    cta: "Apri suggerimenti AI"
  },
  {
    id: "fu-1",
    title: "Reminder giornata",
    summary: "12 attività da chiudere entro le 18:00.",
    category: "followup",
    priority: "low",
    cta: "Apri task board"
  }
];
