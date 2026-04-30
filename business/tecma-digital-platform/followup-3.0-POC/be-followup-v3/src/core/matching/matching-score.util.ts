import { ObjectId } from "mongodb";
import type { RawPrice } from "../pricing/price-normalizer.js";
import type { ClientSelectedApartment } from "../clients/clients.service.js";

const clamp = (n: number, min: number, max: number): number => Math.max(min, Math.min(max, n));

/** Converte budget legacy (numero o stringa) in EUR positivi. */
export function parseClientBudget(budget: unknown): number | null {
  if (budget == null) return null;
  if (typeof budget === "number" && Number.isFinite(budget) && budget > 0) return budget;
  if (typeof budget === "string") {
    const cleaned = budget.replace(/\s/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
}

/** Estrae ObjectId hex da riferimenti legacy (stringa o ObjectId). */
export function refToApartmentHex(ref: unknown): string | null {
  if (ref == null) return null;
  try {
    if (typeof ref === "string") {
      if (!ObjectId.isValid(ref)) return null;
      return new ObjectId(ref).toHexString();
    }
    return new ObjectId(ref as ObjectId).toHexString();
  } catch {
    return null;
  }
}

export function clientListsMentionApartment(
  apartmentHexId: string,
  interested?: ClientSelectedApartment[],
  selected?: ClientSelectedApartment[]
): boolean {
  const lists = [...(interested ?? []), ...(selected ?? [])];
  for (const entry of lists) {
    const a = refToApartmentHex(entry.appartment ?? entry._id);
    if (a && a === apartmentHexId) return true;
  }
  return false;
}

/** Punteggio 0–22 da allineamento prezzo vs budget (stessa unità del listino). */
export function budgetFitPoints(budgetEur: number | null, rawPrice: RawPrice | null | undefined): { pts: number; reason?: string } {
  const hasBudget = budgetEur != null && budgetEur > 0;
  const hasPrice =
    rawPrice != null &&
    typeof rawPrice.amount === "number" &&
    Number.isFinite(rawPrice.amount) &&
    rawPrice.amount > 0;

  if (!hasBudget && !hasPrice) {
    return {
      pts: 11,
      reason: "Budget cliente e prezzo listino non disponibili: confronto economico neutro (compila budget e verifica il listino)",
    };
  }
  if (!hasBudget) {
    return { pts: 11, reason: "Budget cliente non indicato: confronto prezzo neutro" };
  }
  if (!hasPrice) {
    return { pts: 11, reason: "Prezzo listino non disponibile: confronto budget neutro" };
  }

  const price = rawPrice.amount;
  if (price <= budgetEur) {
    const ratio = price / budgetEur;
    const pts = Math.round(8 + 14 * ratio);
    return { pts: clamp(pts, 8, 22), reason: "Prezzo entro budget" };
  }
  const overRatio = (price - budgetEur) / budgetEur;
  const pts = Math.round(22 * Math.max(0, 1 - Math.min(1, overRatio * 1.5)));
  if (overRatio <= 0.1) return { pts: clamp(pts, 12, 18), reason: "Leggermente sopra budget" };
  return { pts: clamp(pts, 0, 18), reason: "Fuori budget" };
}

const APARTMENT_STATUS_WEIGHT: Record<string, number> = {
  AVAILABLE: 13,
  RESERVED: 9,
  SOLD: 4,
  RENTED: 4,
};

export function apartmentStatusPoints(status: string): { pts: number; reason: string } {
  const u = String(status || "").toUpperCase();
  const pts = APARTMENT_STATUS_WEIGHT[u] ?? 6;
  const reason =
    u === "AVAILABLE" ? "Disponibile" : u === "RESERVED" ? "Riservato" : u === "SOLD" || u === "RENTED" ? "Non disponibile" : "Stato immobile";
  return { pts, reason };
}

/** Vicinanza alla mediana mq nel progetto (0–10). */
export function surfaceProximityPoints(surfaceMq: number, medianMq: number): { pts: number; reason: string } {
  if (!Number.isFinite(surfaceMq) || surfaceMq < 0) return { pts: 5, reason: "Superficie non indicata" };
  if (!Number.isFinite(medianMq) || medianMq <= 0) {
    return { pts: Math.min(10, 5 + Math.round(surfaceMq / 40)), reason: "Superficie" };
  }
  const rel = Math.abs(surfaceMq - medianMq) / medianMq;
  const pts = Math.round(10 * (1 - Math.min(1, rel)));
  return {
    pts: clamp(pts, 0, 10),
    reason: rel < 0.15 ? "Metratura vicina alla media del progetto" : "Metratura diversa dalla media",
  };
}

export interface ApartmentScoreInput {
  apartmentHexId: string;
  surfaceMq: number;
  status: string;
  rawPrice: RawPrice | null | undefined;
  medianSurfaceMq: number;
  clientBudget: unknown;
  interestedAppartments?: ClientSelectedApartment[];
  selectedAppartments?: ClientSelectedApartment[];
}

/**
 * Score 0–100 per un appartamento rispetto al cliente (stesso progetto già filtrato a monte).
 */
export function scoreApartmentForClient(input: ApartmentScoreInput): { score: number; reasons: string[] } {
  const reasons: string[] = ["Stesso progetto"];
  let total = 25;

  const budget = parseClientBudget(input.clientBudget);
  const interest = clientListsMentionApartment(
    input.apartmentHexId,
    input.interestedAppartments,
    input.selectedAppartments
  );
  if (interest) {
    total += 30;
    reasons.push("Presente tra gli immobili di interesse del cliente");
  }

  const { pts: bPts, reason: bReason } = budgetFitPoints(budget, input.rawPrice);
  total += bPts;
  if (bReason) reasons.push(bReason);

  const { pts: stPts, reason: stReason } = apartmentStatusPoints(input.status);
  total += stPts;
  reasons.push(stReason);

  const { pts: surfPts, reason: surfReason } = surfaceProximityPoints(input.surfaceMq, input.medianSurfaceMq);
  total += surfPts;
  reasons.push(surfReason);

  const score = clamp(Math.round(total), 0, 100);
  return { score, reasons };
}

const CLIENT_STATUS_WEIGHT: Record<string, number> = {
  negotiation: 23,
  prospect: 14,
  contacted: 13,
  client: 15,
  lead: 11,
  won: 10,
  lost: 5,
};

export function clientLeadStatusPoints(status: string): { pts: number; reason: string } {
  const s = String(status || "lead").toLowerCase();
  const pts = CLIENT_STATUS_WEIGHT[s] ?? 11;
  return { pts, reason: `Stato cliente: ${s}` };
}

export interface ClientScoreInput {
  apartmentHexId: string;
  apartmentRawPrice: RawPrice | null | undefined;
  clientBudget: unknown;
  interestedAppartments?: ClientSelectedApartment[];
  selectedAppartments?: ClientSelectedApartment[];
  clientStatus: string;
}

/**
 * Score 0–100 per un cliente rispetto all'appartamento (lista "clienti papabili").
 */
export function scoreClientForApartment(input: ClientScoreInput): { score: number; reasons: string[] } {
  const reasons: string[] = ["Stesso progetto"];
  let total = 25;

  const budget = parseClientBudget(input.clientBudget);
  const interest = clientListsMentionApartment(
    input.apartmentHexId,
    input.interestedAppartments,
    input.selectedAppartments
  );
  if (interest) {
    total += 30;
    reasons.push("Cliente ha questo immobile tra gli interessi");
  }

  const { pts: bPts, reason: bReason } = budgetFitPoints(budget, input.apartmentRawPrice);
  total += bPts;
  if (bReason) reasons.push(bReason);

  const { pts: stPts, reason: stReason } = clientLeadStatusPoints(input.clientStatus);
  total += stPts;
  reasons.push(stReason);

  const score = clamp(Math.round(total), 0, 100);
  return { score, reasons };
}
