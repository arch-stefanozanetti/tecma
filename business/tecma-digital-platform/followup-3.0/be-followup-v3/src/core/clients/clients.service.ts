import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ListQuerySchema, type ListQueryInput, buildPagination } from "../shared/list-query.js";
import { PaginatedResponse } from "../../types/http.js";

/** Coniuge/familiare del cliente (legacy). */
export interface ClientConiuge {
  nome?: string;
  cognome?: string;
  mail?: string;
  indirizzo?: string;
  tel?: string;
}

/** Famiglia del cliente (legacy). */
export interface ClientFamily {
  adulti?: number | null;
  bambini?: number | null;
  animali?: number | null;
}

/** Appartamento selezionato/interessato (legacy). */
export interface ClientSelectedApartment {
  appartment?: ObjectId | string;
  status?: string;
  _id?: ObjectId | string;
  createdOn?: Date | string;
}

/** Azione/timeline del cliente (legacy). */
export interface ClientAction {
  actionName?: string;
  actionDate?: Date | string;
  vendor?: ObjectId | string;
  note?: string | null;
  quote?: ObjectId | string | null;
  category?: string;
  deleted?: boolean;
  _id?: ObjectId | string;
  createdOn?: Date | string;
  eventId?: ObjectId | string;
}

export interface ClientRow {
  _id: string;
  workspaceId?: string;
  projectId: string;
  fullName: string;
  email?: string;
  phone?: string;
  status: string;
  createdAt?: string;
  updatedAt: string;
  source?: string;
  city?: string;
  myhomeVersion?: string;
  createdBy?: string;
  /** Dati enterprise (da legacy client.clients). */
  coniuge?: ClientConiuge;
  family?: ClientFamily;
  budget?: number | string | null;
  motivazione?: string;
  note?: string;
  profilazione?: boolean;
  trattamento?: boolean;
  marketing?: boolean;
  selectedAppartments?: ClientSelectedApartment[];
  interestedAppartments?: ClientSelectedApartment[];
  actions?: ClientAction[];
  activityState?: string;
  activityStateHistory?: Array<{ date?: Date | string; activityState?: string; reason?: string; movement?: ObjectId | string | null }>;
  additionalInfo?: Record<string, unknown>;
  nProposals?: number;
  nReserved?: number;
}

const buildMatch = (q: ListQueryInput) => {
  const conditions: Record<string, unknown>[] = [
    {
      workspaceId: q.workspaceId,
      projectId: { $in: q.projectIds }
    }
  ];

  const status = q.filters?.status;
  if (Array.isArray(status) && status.length > 0) {
    conditions.push({ status: { $in: status } });
  }

  const source = q.filters?.source;
  if (Array.isArray(source) && source.length > 0) {
    conditions.push({ source: { $in: source } });
  }

  const city = q.filters?.city;
  if (Array.isArray(city) && city.length > 0) {
    conditions.push({ city: { $in: city } });
  }

  const dateFrom = q.filters?.dateFrom;
  const dateTo = q.filters?.dateTo;
  if (typeof dateFrom === "string" || typeof dateTo === "string") {
    const range: Record<string, unknown> = {};
    if (typeof dateFrom === "string" && dateFrom) range.$gte = new Date(dateFrom);
    if (typeof dateTo === "string" && dateTo) range.$lte = new Date(dateTo);
    conditions.push({ updatedAt: range });
  }

  if (q.searchText && q.searchText.trim()) {
    const safe = q.searchText.trim();
    conditions.push({
      $or: [
        { fullName: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        { phone: { $regex: safe, $options: "i" } }
      ]
    });
  }

  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
};

const sortable: Record<string, 1> = {
  fullName: 1,
  status: 1,
  updatedAt: 1,
  projectId: 1
};

const queryPrimaryClients = async (input: ListQueryInput): Promise<PaginatedResponse<ClientRow>> => {
  const db = getDb();
  const collection = db.collection("tz_clients");

  const match = buildMatch(input);
  const { page, perPage } = input;
  const { skip, limit } = buildPagination(page, perPage);
  const sortField = input.sort?.field && sortable[input.sort.field] ? input.sort.field : "updatedAt";
  const sortDirection = input.sort?.direction ?? -1;

  const [rawData, total] = await Promise.all([
    collection
      .find(match)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit)
      .project({
        _id: 1,
        projectId: 1,
        workspaceId: 1,
        fullName: 1,
        email: 1,
        phone: 1,
        status: 1,
        source: 1,
        city: 1,
        myhomeVersion: 1,
        createdBy: 1,
        updatedAt: 1,
        createdAt: 1
      })
      .toArray(),
    collection.countDocuments(match)
  ]);

  const data: ClientRow[] = rawData.map((item) => ({
    _id: String(item._id ?? ""),
    projectId: typeof item.projectId === "string" ? item.projectId : "",
    fullName: typeof item.fullName === "string" && item.fullName.trim() ? item.fullName : "-",
    email: typeof item.email === "string" ? item.email : undefined,
    phone: typeof item.phone === "string" ? item.phone : undefined,
    status: typeof item.status === "string" ? item.status : "lead",
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
    updatedAt: String(item.updatedAt || item.createdAt || new Date(0).toISOString()),
    source: typeof item.source === "string" ? item.source : undefined,
    city: typeof item.city === "string" ? item.city : undefined,
    myhomeVersion: typeof item.myhomeVersion === "string" ? item.myhomeVersion : undefined,
    createdBy: typeof item.createdBy === "string" ? item.createdBy : undefined
  }));

  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage)
    }
  };
};

export const queryClients = async (rawInput: unknown): Promise<PaginatedResponse<ClientRow>> => {
  const input = ListQuerySchema.parse(rawInput);
  return queryPrimaryClients(input);
};

const mapDocToClientRow = (item: Record<string, unknown>): ClientRow => ({
  _id: String(item._id ?? ""),
  workspaceId: typeof item.workspaceId === "string" ? item.workspaceId : undefined,
  projectId: typeof item.projectId === "string" ? item.projectId : "",
  fullName: typeof item.fullName === "string" && item.fullName.trim() ? item.fullName : "-",
  email: typeof item.email === "string" ? item.email : undefined,
  phone: typeof item.phone === "string" ? item.phone : undefined,
  status: typeof item.status === "string" ? item.status : "lead",
  createdAt: item.createdAt ? String(item.createdAt) : undefined,
  updatedAt: String(item.updatedAt || item.createdAt || new Date(0).toISOString()),
  source: typeof item.source === "string" ? item.source : undefined,
  city: typeof item.city === "string" ? item.city : undefined,
  myhomeVersion: typeof item.myhomeVersion === "string" ? item.myhomeVersion : undefined,
  createdBy: typeof item.createdBy === "string" ? item.createdBy : undefined,
});

export const getClientById = async (rawId: unknown): Promise<{ client: ClientRow }> => {
  const id = z.string().min(1).parse(rawId);
  const _id = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!_id) {
    const err = new Error("Client not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const db = getDb();
  const doc = await db.collection("tz_clients").findOne({ _id });
  if (!doc) {
    const err = new Error("Client not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const client = mapDocToClientRow(doc as Record<string, unknown>);
  return { client };
};

const CLIENT_STATUSES = ["lead", "prospect", "client", "contacted", "negotiation", "won", "lost"] as const;

export interface ClientCreateInput {
  workspaceId: string;
  projectId: string;
  fullName: string;
  email?: string;
  phone?: string;
  status?: string;
  city?: string;
}

export interface ClientUpdateInput {
  fullName?: string;
  email?: string;
  phone?: string;
  status?: string;
  city?: string;
}

const ClientCreateSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  fullName: z.string().min(1, "Nome obbligatorio"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["lead", "prospect", "client", "contacted", "negotiation", "won", "lost"]).optional().default("lead"),
  city: z.string().optional(),
});

const ClientUpdateSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["lead", "prospect", "client", "contacted", "negotiation", "won", "lost"]).optional(),
  city: z.string().optional(),
});

export const createClient = async (rawInput: unknown): Promise<{ client: ClientRow }> => {
  const input = ClientCreateSchema.parse(rawInput) as ClientCreateInput;
  const db = getDb();
  const collection = db.collection("tz_clients");
  const now = new Date().toISOString();
  const doc = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    fullName: (input.fullName || "").trim(),
    email: (input.email || "").trim() || undefined,
    phone: (input.phone || "").trim() || undefined,
    status: CLIENT_STATUSES.includes(input.status as (typeof CLIENT_STATUSES)[number]) ? input.status : "lead",
    city: (input.city || "").trim() || undefined,
    updatedAt: now,
    createdAt: now,
  };
  const result = await collection.insertOne(doc);
  const _id = result.insertedId.toHexString();
  const client: ClientRow = {
    _id,
    projectId: input.projectId,
    fullName: doc.fullName,
    email: doc.email,
    phone: doc.phone,
    status: doc.status ?? "lead",
    updatedAt: doc.updatedAt ?? now,
    createdAt: doc.createdAt,
    city: doc.city,
  };
  return { client };
};

export const updateClient = async (
  clientId: string,
  rawInput: unknown
): Promise<{ client: ClientRow; workspaceId?: string }> => {
  const input = ClientUpdateSchema.parse(rawInput) as ClientUpdateInput;
  const db = getDb();
  const collection = db.collection("tz_clients");
  const _id = ObjectId.isValid(clientId) ? new ObjectId(clientId) : null;
  if (!_id) {
    const err = new Error("Client not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const existing = await collection.findOne({ _id });
  if (!existing) {
    const err = new Error("Client not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const updateDoc: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.fullName !== undefined) updateDoc.fullName = (input.fullName || "").trim();
  if (input.email !== undefined) updateDoc.email = (input.email || "").trim() || undefined;
  if (input.phone !== undefined) updateDoc.phone = (input.phone || "").trim() || undefined;
  if (input.status !== undefined && CLIENT_STATUSES.includes(input.status as (typeof CLIENT_STATUSES)[number]))
    updateDoc.status = input.status;
  if (input.city !== undefined) updateDoc.city = (input.city || "").trim() || undefined;
  await collection.updateOne({ _id }, { $set: updateDoc });
  const updated = await collection.findOne({ _id });
  const row: ClientRow = {
    _id: String(updated!._id),
    projectId: String(updated!.projectId ?? existing.projectId),
    fullName: String(updated!.fullName ?? existing.fullName),
    email: typeof updated!.email === "string" ? updated!.email : undefined,
    phone: typeof updated!.phone === "string" ? updated!.phone : undefined,
    status: String(updated!.status ?? existing.status),
    updatedAt: String(updated!.updatedAt),
    createdAt: updated!.createdAt ? String(updated!.createdAt) : undefined,
    city: typeof updated!.city === "string" ? updated!.city : undefined,
  };
  const workspaceId = String(existing.workspaceId ?? "");
  return { client: row, workspaceId };
};
