import { getDb } from "../../config/db.js";
import { getClientById } from "../clients/clients.service.js";
import { getApartmentById } from "../apartments/apartments.service.js";

const DEFAULT_SCORE = 80;
const DEFAULT_REASONS = ["Stesso progetto"];

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

  const db = getDb();
  const cursor = db
    .collection("tz_apartments")
    .find({ projectId })
    .project({ _id: 1, code: 1, name: 1, status: 1, mode: 1, surfaceMq: 1 });

  const docs = await cursor.toArray();
  const data: CandidateEntry<ApartmentCandidateItem>[] = docs.map((d) => {
    const raw = d as Record<string, unknown>;
    return {
      item: {
        _id: String(raw._id ?? ""),
        code: String(raw.code ?? ""),
        name: typeof raw.name === "string" ? raw.name : undefined,
        status: String(raw.status ?? "AVAILABLE"),
        mode: String(raw.mode ?? "SELL"),
        surfaceMq: Number(raw.surfaceMq) || 0,
      },
      score: DEFAULT_SCORE,
      reasons: [...DEFAULT_REASONS],
    };
  });

  return { data };
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

  const db = getDb();
  const cursor = db
    .collection("tz_clients")
    .find({ projectId })
    .project({ _id: 1, fullName: 1, email: 1, status: 1 });

  const docs = await cursor.toArray();
  const data: CandidateEntry<ClientCandidateItem>[] = docs.map((d) => {
    const raw = d as Record<string, unknown>;
    return {
      item: {
        _id: String(raw._id ?? ""),
        fullName: String(raw.fullName ?? "-"),
        email: typeof raw.email === "string" && raw.email ? raw.email : undefined,
        status: String(raw.status ?? "lead"),
      },
      score: DEFAULT_SCORE,
      reasons: [...DEFAULT_REASONS],
    };
  });

  return { data };
}
