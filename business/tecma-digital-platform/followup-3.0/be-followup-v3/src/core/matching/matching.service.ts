import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { getClientById } from "../clients/clients.service.js";
import type { ClientSelectedApartment } from "../clients/clients.service.js";
import { namesFromDoc } from "../clients/client-name.util.js";
import { getApartmentById } from "../apartments/apartments.service.js";
import type { RawPrice } from "../pricing/price-normalizer.js";
import { scoreApartmentForClient, scoreClientForApartment } from "./matching-score.util.js";

export interface ClientCandidateItem {
  _id: string;
  fullName: string;
  email?: string;
  status: string;
}

export interface ApartmentCandidateItem {
  _id: string;
  code: string;
  name?: string;
  status: string;
  mode: string;
  surfaceMq: number;
}

export interface CandidateEntry<T> {
  item: T;
  score: number;
  reasons: string[];
}

/** Ordine stabile: score decrescente, poi `_id` crescente. */
function sortByScoreDesc<T extends { _id: string }>(entries: CandidateEntry<T>[]): CandidateEntry<T>[] {
  return [...entries].sort((a, b) => {
    const byScore = b.score - a.score;
    if (byScore !== 0) return byScore;
    return a.item._id.localeCompare(b.item._id);
  });
}

function rawPriceFromDoc(raw: Record<string, unknown>): RawPrice | undefined {
  const rp = raw.rawPrice;
  if (!rp || typeof rp !== "object") return undefined;
  const o = rp as Record<string, unknown>;
  const mode = o.mode === "RENT" ? "RENT" : "SELL";
  const amt = o.amount;
  const amount = typeof amt === "number" ? amt : parseFloat(String(amt ?? ""));
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  const out: RawPrice = { mode, amount };
  if (typeof o.currency === "string" && o.currency.trim()) out.currency = o.currency.trim();
  if (o.cadence === "YEAR") out.cadence = "YEAR";
  return out;
}

function medianSurface(values: number[]): number {
  if (values.length === 0) return 0;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  if (v.length % 2 === 1) return v[mid]!;
  return (v[mid - 1]! + v[mid]!) / 2;
}

async function loadClientMatchingFields(clientId: string): Promise<{
  budget?: unknown;
  interestedAppartments?: ClientSelectedApartment[];
  selectedAppartments?: ClientSelectedApartment[];
}> {
  const _id = ObjectId.isValid(clientId) ? new ObjectId(clientId) : null;
  if (!_id) return {};
  const db = getDb();
  const doc = await db.collection("tz_clients").findOne(
    { _id },
    { projection: { budget: 1, interestedAppartments: 1, selectedAppartments: 1 } }
  );
  if (!doc) return {};
  const rec = doc as Record<string, unknown>;
  return {
    budget: rec.budget,
    interestedAppartments: Array.isArray(rec.interestedAppartments)
      ? (rec.interestedAppartments as ClientSelectedApartment[])
      : undefined,
    selectedAppartments: Array.isArray(rec.selectedAppartments)
      ? (rec.selectedAppartments as ClientSelectedApartment[])
      : undefined,
  };
}

/**
 * Restituisce gli appartamenti candidati per un cliente (stesso projectId).
 * Usato nella tab "Appartamenti papabili" della scheda cliente.
 */
export async function getClientCandidates(
  clientId: string,
  _workspaceId: string,
  _projectIds: string[]
): Promise<{ data: CandidateEntry<ApartmentCandidateItem>[] }> {
  const { client } = await getClientById(clientId);
  const projectId = client.projectId;
  if (!projectId) return { data: [] };

  const extra = await loadClientMatchingFields(clientId);
  const db = getDb();
  const cursor = db
    .collection("tz_apartments")
    .find({ projectId })
    .project({ _id: 1, code: 1, name: 1, status: 1, mode: 1, surfaceMq: 1, rawPrice: 1 });

  const docs = await cursor.toArray();
  const surfaces = docs.map((d) => {
    const raw = d as Record<string, unknown>;
    return Number(raw.surfaceMq) || 0;
  });
  const medianMq = medianSurface(surfaces);

  const data: CandidateEntry<ApartmentCandidateItem>[] = docs.map((d) => {
    const raw = d as Record<string, unknown>;
    const hexId = String(raw._id ?? "");
    const apartmentHex = ObjectId.isValid(hexId) ? new ObjectId(hexId).toHexString() : hexId;
    const surfaceMq = Number(raw.surfaceMq) || 0;
    const status = String(raw.status ?? "AVAILABLE");
    const mode = String(raw.mode ?? "SELL");
    const price = rawPriceFromDoc(raw);

    const { score, reasons } = scoreApartmentForClient({
      apartmentHexId: apartmentHex,
      surfaceMq,
      status,
      rawPrice: price,
      medianSurfaceMq: medianMq,
      clientBudget: extra.budget,
      interestedAppartments: extra.interestedAppartments,
      selectedAppartments: extra.selectedAppartments,
    });

    return {
      item: {
        _id: apartmentHex,
        code: String(raw.code ?? ""),
        name: typeof raw.name === "string" ? raw.name : undefined,
        status,
        mode,
        surfaceMq,
      },
      score,
      reasons,
    };
  });

  return { data: sortByScoreDesc(data) };
}

/**
 * Restituisce i clienti candidati per un appartamento (stesso projectId).
 * Usato nella tab "Clienti papabili" della scheda appartamento.
 */
export async function getApartmentCandidates(
  apartmentId: string,
  _workspaceId: string,
  _projectIds: string[]
): Promise<{ data: CandidateEntry<ClientCandidateItem>[] }> {
  const { apartment } = await getApartmentById(apartmentId);
  const projectId = apartment.projectId;
  if (!projectId) return { data: [] };

  const apartmentHex =
    typeof apartment._id === "string" && ObjectId.isValid(apartmentId)
      ? new ObjectId(apartmentId).toHexString()
      : String(apartment._id);

  const rawPrice =
    apartment.rawPrice && typeof apartment.rawPrice === "object"
      ? (apartment.rawPrice as RawPrice)
      : undefined;

  const db = getDb();
  const cursor = db.collection("tz_clients").find({ projectId }).project({
    _id: 1,
    fullName: 1,
    firstName: 1,
    lastName: 1,
    email: 1,
    status: 1,
    budget: 1,
    interestedAppartments: 1,
    selectedAppartments: 1,
  });

  const docs = await cursor.toArray();
  const data: CandidateEntry<ClientCandidateItem>[] = docs.map((d) => {
    const raw = d as Record<string, unknown>;
    const n = namesFromDoc(raw);
    const idHex = String(raw._id ?? "");
    const clientIdHex = ObjectId.isValid(idHex) ? new ObjectId(idHex).toHexString() : idHex;

    const { score, reasons } = scoreClientForApartment({
      apartmentHexId: apartmentHex,
      apartmentRawPrice: rawPrice,
      clientBudget: raw.budget,
      interestedAppartments: Array.isArray(raw.interestedAppartments)
        ? (raw.interestedAppartments as ClientSelectedApartment[])
        : undefined,
      selectedAppartments: Array.isArray(raw.selectedAppartments)
        ? (raw.selectedAppartments as ClientSelectedApartment[])
        : undefined,
      clientStatus: String(raw.status ?? "lead"),
    });

    return {
      item: {
        _id: clientIdHex,
        fullName: n.fullName,
        email: typeof raw.email === "string" && raw.email ? raw.email : undefined,
        status: String(raw.status ?? "lead"),
      },
      score,
      reasons,
    };
  });

  return { data: sortByScoreDesc(data) };
}
