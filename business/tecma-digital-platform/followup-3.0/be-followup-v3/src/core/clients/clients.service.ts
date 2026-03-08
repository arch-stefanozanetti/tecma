import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb, getDbByName } from "../../config/db.js";
import { ENV } from "../../config/env.js";
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

type LegacyClientDoc = {
  _id?: ObjectId | string;
  project_id?: ObjectId | string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
  tel?: string;
  status?: string;
  source?: string;
  city?: string;
  myhome_version?: string;
  createdBy?: string;
  updatedOn?: Date | string;
  createdOn?: Date | string;
  coniuge?: ClientConiuge;
  family?: ClientFamily;
  budget?: number | string | null;
  motivazione?: string;
  note?: string;
  profilazione?: boolean;
  trattamento?: boolean;
  marketing?: boolean;
  selected_appartments?: ClientSelectedApartment[];
  interested_appartments?: ClientSelectedApartment[];
  actions?: ClientAction[];
  activityState?: string;
  activityStateHistory?: Array<{ date?: Date | string; activityState?: string; reason?: string; movement?: ObjectId | string | null }>;
  additionalInfo?: Record<string, unknown>;
  nProposals?: number;
  nReserved?: number;
};

const parseProjectIdsForLegacy = (projectIds: string[]) => {
  const objectIds: ObjectId[] = [];
  const asStrings = new Set<string>();
  for (const projectId of projectIds) {
    asStrings.add(projectId);
    if (ObjectId.isValid(projectId)) objectIds.push(new ObjectId(projectId));
  }
  return { objectIds, asStrings: [...asStrings] };
};

const buildLegacyMatch = (q: ListQueryInput) => {
  const { objectIds, asStrings } = parseProjectIdsForLegacy(q.projectIds);
  const projectConditionValues: Array<ObjectId | string> = [...objectIds, ...asStrings];
  const conditions: Record<string, unknown>[] = [{ project_id: { $in: projectConditionValues } }];

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
    conditions.push({ updatedOn: range });
  }

  if (q.searchText && q.searchText.trim()) {
    const safe = q.searchText.trim();
    conditions.push({
      $or: [
        { firstName: { $regex: safe, $options: "i" } },
        { lastName: { $regex: safe, $options: "i" } },
        { fullName: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        { tel: { $regex: safe, $options: "i" } }
      ]
    });
  }

  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
};

const legacySortFieldByInput: Record<string, string> = {
  fullName: "lastName",
  status: "status",
  updatedAt: "updatedOn",
  projectId: "project_id"
};

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

const mapLegacyClientToRow = (item: LegacyClientDoc): ClientRow => {
  const nameParts = [item.firstName, item.lastName].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
  const fullName = typeof item.fullName === "string" && item.fullName.trim() ? item.fullName : nameParts.join(" ").trim() || "-";
  const projectId = item.project_id instanceof ObjectId ? item.project_id.toHexString() : typeof item.project_id === "string" ? item.project_id : "";
  const updatedAt = toIsoDate(item.updatedOn ?? item.createdOn);

  const row: ClientRow = {
    _id: String(item._id ?? ""),
    projectId,
    fullName,
    email: typeof item.email === "string" ? item.email : undefined,
    phone: typeof item.tel === "string" ? item.tel : undefined,
    status: typeof item.status === "string" ? item.status : "lead",
    createdAt: item.createdOn ? toIsoDate(item.createdOn) : undefined,
    updatedAt,
    source: typeof item.source === "string" ? item.source : undefined,
    city: typeof item.city === "string" ? item.city : undefined,
    myhomeVersion: typeof item.myhome_version === "string" ? item.myhome_version : undefined,
    createdBy: typeof item.createdBy === "string" ? item.createdBy : undefined
  };

  if (item.coniuge && typeof item.coniuge === "object") row.coniuge = item.coniuge;
  if (item.family && typeof item.family === "object") row.family = item.family;
  if (item.budget !== undefined) row.budget = item.budget;
  if (typeof item.motivazione === "string") row.motivazione = item.motivazione;
  if (typeof item.note === "string") row.note = item.note;
  if (typeof item.profilazione === "boolean") row.profilazione = item.profilazione;
  if (typeof item.trattamento === "boolean") row.trattamento = item.trattamento;
  if (typeof item.marketing === "boolean") row.marketing = item.marketing;
  if (Array.isArray(item.selected_appartments)) row.selectedAppartments = item.selected_appartments;
  if (Array.isArray(item.interested_appartments)) row.interestedAppartments = item.interested_appartments;
  if (Array.isArray(item.actions)) row.actions = item.actions;
  if (typeof item.activityState === "string") row.activityState = item.activityState;
  if (Array.isArray(item.activityStateHistory)) row.activityStateHistory = item.activityStateHistory;
  if (item.additionalInfo && typeof item.additionalInfo === "object") row.additionalInfo = item.additionalInfo;
  if (typeof item.nProposals === "number") row.nProposals = item.nProposals;
  if (typeof item.nReserved === "number") row.nReserved = item.nReserved;

  return row;
};

const queryPrimaryClients = async (input: ListQueryInput): Promise<PaginatedResponse<ClientRow>> => {
  const db = getDb();
  const collection = db.collection("clients");

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

const queryLegacyClients = async (input: ListQueryInput): Promise<PaginatedResponse<ClientRow>> => {
  const db = getDbByName(ENV.MONGO_CLIENT_DB_NAME);
  const collection = db.collection<LegacyClientDoc>("clients");

  const match = buildLegacyMatch(input);
  const { page, perPage } = input;
  const { skip, limit } = buildPagination(page, perPage);
  const sortField = input.sort?.field && sortable[input.sort.field] ? legacySortFieldByInput[input.sort.field] : "updatedOn";
  const sortDirection = input.sort?.direction ?? -1;

  const [rawData, total] = await Promise.all([
    collection
      .find(match)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit)
      .project({
        _id: 1,
        project_id: 1,
        firstName: 1,
        lastName: 1,
        fullName: 1,
        email: 1,
        tel: 1,
        status: 1,
        source: 1,
        city: 1,
        myhome_version: 1,
        createdBy: 1,
        updatedOn: 1,
        createdOn: 1
      })
      .toArray(),
    collection.countDocuments(match)
  ]);

  return {
    data: rawData.map(mapLegacyClientToRow),
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
  const primary = await queryPrimaryClients(input);
  if (primary.pagination.total > 0) return primary;
  return queryLegacyClients(input);
};

const mapDocToClientRow = (item: Record<string, unknown>): ClientRow => ({
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
  const primaryDb = getDb();
  const doc = await primaryDb.collection("clients").findOne({ _id });
  if (doc) {
    const client = mapDocToClientRow(doc as Record<string, unknown>);
    return { client };
  }
  const legacyDb = getDbByName(ENV.MONGO_CLIENT_DB_NAME);
  const legacyDoc = await legacyDb.collection<LegacyClientDoc>("clients").findOne({ _id });
  if (!legacyDoc) {
    const err = new Error("Client not found");
    (err as Error & { statusCode?: number }).statusCode = 404;
    throw err;
  }
  const client = mapLegacyClientToRow(legacyDoc);
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
  const collection = db.collection("clients");
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
  const collection = db.collection("clients");
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
