import { ObjectId, type Document } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { escapeRegex } from "../../utils/escapeRegex.js";
import { ListQuerySchema, type ListQueryInput, buildPagination } from "../shared/list-query.js";
import { isNoAccessProjectIds, emptyListResult } from "../access/listQueryContext.js";
import { HttpError, PaginatedResponse } from "../../types/http.js";
import { joinClientFullName, namesFromDoc, splitLegacyFullName } from "./client-name.util.js";
import { listEntityAssignments } from "../workspaces/entity-assignments.service.js";
import {
  shouldApplyEntityAssignmentListFilter,
  useStrictEntityAssignmentOnly,
  viewerAssignmentUserId,
  type EntityAssignmentListViewer,
} from "../workspaces/entity-assignment-query.util.js";
import {
  MarketingAttributionInputSchema,
  type MarketingAttributionDoc,
  normalizeTouchPartial,
  touchHasSignal,
  isMarketingAttributionDoc,
} from "../marketing/marketing-attribution.schema.js";

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
  /** Nome di battesimo. */
  firstName: string;
  /** Cognome. */
  lastName: string;
  /** Nome completo (derivato o legacy), utile per ricerca e compatibilità. */
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
  /** Attribuzione marketing (gclid/fbclid/UTM) per Big Data / offline conversion. */
  marketingAttribution?: MarketingAttributionDoc;
  /** Ultimo stato verifica AML/KYC (normalizzato). */
  amlStatus?: string;
  /** Id ultimo check AML interno (tz_aml_checks). */
  amlCheckId?: string;
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
    const safe = escapeRegex(q.searchText.trim());
    conditions.push({
      $or: [
        { fullName: { $regex: safe, $options: "i" } },
        { firstName: { $regex: safe, $options: "i" } },
        { lastName: { $regex: safe, $options: "i" } },
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

const queryPrimaryClients = async (
  input: ListQueryInput,
  viewer?: EntityAssignmentListViewer
): Promise<PaginatedResponse<ClientRow>> => {
  const db = getDb();
  const collection = db.collection("tz_clients");

  const match = buildMatch(input);
  const { page, perPage } = input;
  const { skip, limit } = buildPagination(page, perPage);
  const sortField = input.sort?.field && sortable[input.sort.field] ? input.sort.field : "updatedAt";
  const sortDirection = input.sort?.direction ?? -1;

  const projectFields = {
    _id: 1,
    projectId: 1,
    workspaceId: 1,
    fullName: 1,
    firstName: 1,
    lastName: 1,
    email: 1,
    phone: 1,
    status: 1,
    source: 1,
    city: 1,
    myhomeVersion: 1,
    createdBy: 1,
    updatedAt: 1,
    createdAt: 1,
    marketingAttribution: 1,
    amlStatus: 1,
    amlCheckId: 1,
  };

  if (shouldApplyEntityAssignmentListFilter(viewer)) {
    const wid = input.workspaceId;
    const viewerId = viewerAssignmentUserId(viewer!);
    const strict = useStrictEntityAssignmentOnly(viewer);
    const lookupAndVisibility: Document[] = [
      {
        $lookup: {
          from: "tz_entity_assignments",
          let: { cid: { $toString: "$_id" } },
          pipeline: [
            {
              $match: {
                workspaceId: wid,
                entityType: "client",
                $expr: { $eq: ["$entityId", "$$cid"] },
              },
            },
          ],
          as: "__ea",
        },
      },
      {
        $match: strict
          ? { "__ea.0.userId": viewerId }
          : { $or: [{ __ea: { $size: 0 } }, { "__ea.0.userId": viewerId }] },
      },
    ];

    const basePipeline: Document[] = [{ $match: match }, ...lookupAndVisibility];

    const [rawData, countArr] = await Promise.all([
      collection
        .aggregate([
          ...basePipeline,
          { $sort: { [sortField]: sortDirection } },
          { $skip: skip },
          { $limit: limit },
          { $project: { __ea: 0 } },
        ])
        .toArray(),
      collection.aggregate([...basePipeline, { $count: "total" }]).toArray(),
    ]);
    const total = typeof countArr[0]?.total === "number" ? countArr[0].total : 0;

    const data: ClientRow[] = rawData.map((item) => {
      const rec = item as Record<string, unknown>;
      const n = namesFromDoc(rec);
      return {
        _id: String(item._id ?? ""),
        projectId: typeof item.projectId === "string" ? item.projectId : "",
        firstName: n.firstName,
        lastName: n.lastName,
        fullName: n.fullName,
        email: typeof item.email === "string" ? item.email : undefined,
        phone: typeof item.phone === "string" ? item.phone : undefined,
        status: typeof item.status === "string" ? item.status : "lead",
        createdAt: item.createdAt ? String(item.createdAt) : undefined,
        updatedAt: String(item.updatedAt || item.createdAt || new Date(0).toISOString()),
        source: typeof item.source === "string" ? item.source : undefined,
        city: typeof item.city === "string" ? item.city : undefined,
        myhomeVersion: typeof item.myhomeVersion === "string" ? item.myhomeVersion : undefined,
        createdBy: typeof item.createdBy === "string" ? item.createdBy : undefined,
        ...(isMarketingAttributionDoc(rec.marketingAttribution)
          ? { marketingAttribution: rec.marketingAttribution }
          : {}),
        ...(typeof rec.amlStatus === "string" ? { amlStatus: rec.amlStatus } : {}),
        ...(typeof rec.amlCheckId === "string" ? { amlCheckId: rec.amlCheckId } : {}),
      };
    });

    return {
      data,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    };
  }

  const [rawData, total] = await Promise.all([
    collection
      .find(match)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit)
      .project(projectFields)
      .toArray(),
    collection.countDocuments(match),
  ]);

  const data: ClientRow[] = rawData.map((item) => {
    const rec = item as Record<string, unknown>;
    const n = namesFromDoc(rec);
    return {
      _id: String(item._id ?? ""),
      projectId: typeof item.projectId === "string" ? item.projectId : "",
      firstName: n.firstName,
      lastName: n.lastName,
      fullName: n.fullName,
      email: typeof item.email === "string" ? item.email : undefined,
      phone: typeof item.phone === "string" ? item.phone : undefined,
      status: typeof item.status === "string" ? item.status : "lead",
      createdAt: item.createdAt ? String(item.createdAt) : undefined,
      updatedAt: String(item.updatedAt || item.createdAt || new Date(0).toISOString()),
      source: typeof item.source === "string" ? item.source : undefined,
      city: typeof item.city === "string" ? item.city : undefined,
      myhomeVersion: typeof item.myhomeVersion === "string" ? item.myhomeVersion : undefined,
      createdBy: typeof item.createdBy === "string" ? item.createdBy : undefined,
      ...(isMarketingAttributionDoc((item as Record<string, unknown>).marketingAttribution)
        ? { marketingAttribution: (item as Record<string, unknown>).marketingAttribution as MarketingAttributionDoc }
        : {}),
      ...(typeof rec.amlStatus === "string" ? { amlStatus: rec.amlStatus } : {}),
      ...(typeof rec.amlCheckId === "string" ? { amlCheckId: rec.amlCheckId } : {}),
    };
  });

  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage),
    },
  };
};

export const queryClients = async (
  rawInput: unknown,
  viewer?: EntityAssignmentListViewer
): Promise<PaginatedResponse<ClientRow>> => {
  const input = ListQuerySchema.parse(rawInput);
  if (isNoAccessProjectIds(input.projectIds)) {
    return emptyListResult(input.page, input.perPage);
  }
  return queryPrimaryClients(input, viewer);
};

const mapDocToClientRow = (item: Record<string, unknown>): ClientRow => {
  const n = namesFromDoc(item);
  const row: ClientRow = {
    _id: String(item._id ?? ""),
    workspaceId: typeof item.workspaceId === "string" ? item.workspaceId : undefined,
    projectId: typeof item.projectId === "string" ? item.projectId : "",
    firstName: n.firstName,
    lastName: n.lastName,
    fullName: n.fullName,
    email: typeof item.email === "string" ? item.email : undefined,
    phone: typeof item.phone === "string" ? item.phone : undefined,
    status: typeof item.status === "string" ? item.status : "lead",
    createdAt: item.createdAt ? String(item.createdAt) : undefined,
    updatedAt: String(item.updatedAt || item.createdAt || new Date(0).toISOString()),
    source: typeof item.source === "string" ? item.source : undefined,
    city: typeof item.city === "string" ? item.city : undefined,
    myhomeVersion: typeof item.myhomeVersion === "string" ? item.myhomeVersion : undefined,
    createdBy: typeof item.createdBy === "string" ? item.createdBy : undefined,
  };
  if (isMarketingAttributionDoc(item.marketingAttribution)) {
    row.marketingAttribution = item.marketingAttribution;
  }
  if (typeof item.amlStatus === "string") row.amlStatus = item.amlStatus;
  if (typeof item.amlCheckId === "string") row.amlCheckId = item.amlCheckId;
  return row;
};

export const getClientById = async (
  rawId: unknown,
  viewer?: EntityAssignmentListViewer
): Promise<{ client: ClientRow }> => {
  const id = z.string().min(1).parse(rawId);
  const _id = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!_id) {
    throw new HttpError("Client not found", 404);
  }
  const db = getDb();
  const doc = await db.collection("tz_clients").findOne({ _id });
  if (!doc) {
    throw new HttpError("Client not found", 404);
  }
  const client = mapDocToClientRow(doc as Record<string, unknown>);
  if (shouldApplyEntityAssignmentListFilter(viewer) && client.workspaceId) {
    const { data } = await listEntityAssignments(client.workspaceId, "client", client._id);
    const strict = useStrictEntityAssignmentOnly(viewer);
    if (strict) {
      if (data.length === 0 || data[0].userId !== viewerAssignmentUserId(viewer!)) {
        throw new HttpError("Client not found", 404);
      }
    } else if (data.length > 0 && data[0].userId !== viewerAssignmentUserId(viewer!)) {
      throw new HttpError("Client not found", 404);
    }
  }
  return { client };
};

const CLIENT_STATUSES = ["lead", "prospect", "client", "contacted", "negotiation", "won", "lost"] as const;

export interface ClientCreateInput {
  workspaceId: string;
  projectId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  status?: string;
  city?: string;
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
  marketingAttribution?: z.infer<typeof MarketingAttributionInputSchema>;
}

export interface ClientUpdateInput {
  firstName?: string;
  lastName?: string;
  /** @deprecated Preferire firstName + lastName; se inviato senza first/last viene splittato. */
  fullName?: string;
  email?: string;
  phone?: string;
  status?: string;
  city?: string;
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
  marketingAttribution?: z.infer<typeof MarketingAttributionInputSchema>;
}

const ClientConiugeSchema = z.object({
  nome: z.string().optional(),
  cognome: z.string().optional(),
  mail: z.string().optional(),
  indirizzo: z.string().optional(),
  tel: z.string().optional(),
});
const ClientFamilySchema = z.object({
  adulti: z.number().nullable().optional(),
  bambini: z.number().nullable().optional(),
  animali: z.number().nullable().optional(),
});
const ClientSelectedApartmentSchema = z.object({
  appartment: z.union([z.string(), z.any()]).optional(),
  status: z.string().optional(),
  _id: z.union([z.string(), z.any()]).optional(),
  createdOn: z.union([z.string(), z.date()]).optional(),
});
const ClientActionSchema = z.object({
  actionName: z.string().optional(),
  actionDate: z.union([z.string(), z.date()]).optional(),
  vendor: z.union([z.string(), z.any()]).optional(),
  note: z.string().nullable().optional(),
  quote: z.union([z.string(), z.any()]).nullable().optional(),
  category: z.string().optional(),
  deleted: z.boolean().optional(),
  _id: z.union([z.string(), z.any()]).optional(),
  createdOn: z.union([z.string(), z.date()]).optional(),
  eventId: z.union([z.string(), z.any()]).optional(),
});
const ClientActivityStateHistorySchema = z.object({
  date: z.union([z.string(), z.date()]).optional(),
  activityState: z.string().optional(),
  reason: z.string().optional(),
  movement: z.union([z.string(), z.any()]).nullable().optional(),
});

const ClientCreateSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  firstName: z.string().min(1, "Nome obbligatorio"),
  lastName: z.string().min(1, "Cognome obbligatorio"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["lead", "prospect", "client", "contacted", "negotiation", "won", "lost"]).optional().default("lead"),
  city: z.string().optional(),
  coniuge: ClientConiugeSchema.optional(),
  family: ClientFamilySchema.optional(),
  budget: z.union([z.number(), z.string(), z.null()]).optional(),
  motivazione: z.string().optional(),
  note: z.string().optional(),
  profilazione: z.boolean().optional(),
  trattamento: z.boolean().optional(),
  marketing: z.boolean().optional(),
  selectedAppartments: z.array(ClientSelectedApartmentSchema).optional(),
  interestedAppartments: z.array(ClientSelectedApartmentSchema).optional(),
  actions: z.array(ClientActionSchema).optional(),
  activityState: z.string().optional(),
  activityStateHistory: z.array(ClientActivityStateHistorySchema).optional(),
  additionalInfo: z.record(z.unknown()).optional(),
  marketingAttribution: MarketingAttributionInputSchema.optional(),
});

const ClientUpdateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  fullName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  status: z.enum(["lead", "prospect", "client", "contacted", "negotiation", "won", "lost"]).optional(),
  city: z.string().optional(),
  coniuge: ClientConiugeSchema.optional(),
  family: ClientFamilySchema.optional(),
  budget: z.union([z.number(), z.string(), z.null()]).optional(),
  motivazione: z.string().optional(),
  note: z.string().optional(),
  profilazione: z.boolean().optional(),
  trattamento: z.boolean().optional(),
  marketing: z.boolean().optional(),
  selectedAppartments: z.array(ClientSelectedApartmentSchema).optional(),
  interestedAppartments: z.array(ClientSelectedApartmentSchema).optional(),
  actions: z.array(ClientActionSchema).optional(),
  activityState: z.string().optional(),
  activityStateHistory: z.array(ClientActivityStateHistorySchema).optional(),
  additionalInfo: z.record(z.unknown()).optional(),
  marketingAttribution: MarketingAttributionInputSchema.optional(),
});

/**
 * Vincolo multi-tenant: (workspaceId, email) univoco. Stessa email in workspace diversi = due clienti diversi.
 */
async function assertClientEmailUnique(
  collection: ReturnType<ReturnType<typeof getDb>["collection"]>,
  workspaceId: string,
  email: string | undefined,
  excludeClientId?: ObjectId
): Promise<void> {
  const normalized = (email || "").trim().toLowerCase();
  if (!normalized) return;
  const filter: Record<string, unknown> = { workspaceId, email: { $regex: `^${normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" } };
  if (excludeClientId) filter._id = { $ne: excludeClientId };
  const existing = await collection.findOne(filter as never);
  if (existing) {
    throw new HttpError("Un cliente con questa email esiste già in questo workspace", 409);
  }
}

export const createClient = async (rawInput: unknown): Promise<{ client: ClientRow }> => {
  const input = ClientCreateSchema.parse(rawInput) as ClientCreateInput;
  const db = getDb();
  const collection = db.collection("tz_clients");
  const emailVal = (input.email || "").trim() || undefined;
  await assertClientEmailUnique(collection, input.workspaceId, emailVal);
  const now = new Date().toISOString();
  const firstName = (input.firstName || "").trim();
  const lastName = (input.lastName || "").trim();
  const fullName = joinClientFullName(firstName, lastName) || "-";
  const doc: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    firstName,
    lastName,
    fullName,
    email: emailVal,
    phone: (input.phone || "").trim() || undefined,
    status: CLIENT_STATUSES.includes(input.status as (typeof CLIENT_STATUSES)[number]) ? input.status : "lead",
    city: (input.city || "").trim() || undefined,
    ...(input.coniuge !== undefined && { coniuge: input.coniuge }),
    ...(input.family !== undefined && { family: input.family }),
    ...(input.budget !== undefined && { budget: input.budget }),
    ...(input.motivazione !== undefined && { motivazione: input.motivazione }),
    ...(input.note !== undefined && { note: input.note }),
    ...(input.profilazione !== undefined && { profilazione: input.profilazione }),
    ...(input.trattamento !== undefined && { trattamento: input.trattamento }),
    ...(input.marketing !== undefined && { marketing: input.marketing }),
    ...(input.selectedAppartments !== undefined && { selectedAppartments: input.selectedAppartments }),
    ...(input.interestedAppartments !== undefined && { interestedAppartments: input.interestedAppartments }),
    ...(input.actions !== undefined && { actions: input.actions }),
    ...(input.activityState !== undefined && { activityState: input.activityState }),
    ...(input.activityStateHistory !== undefined && { activityStateHistory: input.activityStateHistory }),
    ...(input.additionalInfo !== undefined && { additionalInfo: input.additionalInfo }),
    updatedAt: now,
    createdAt: now,
  };
  const touchIn = input.marketingAttribution?.touch;
  if (touchIn && touchHasSignal(touchIn)) {
    const t = normalizeTouchPartial(touchIn, now);
    doc.marketingAttribution = { firstTouch: t, lastTouch: t };
  }
  try {
    const result = await collection.insertOne(doc as never);
    const inserted = await collection.findOne({ _id: result.insertedId });
    const client = mapDocToClientRow(inserted as Record<string, unknown>);
    return { client };
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      throw new HttpError("Un cliente con questa email esiste già in questo workspace", 409);
    }
    throw err;
  }
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
    throw new HttpError("Client not found", 404);
  }
  const existing = await collection.findOne({ _id });
  if (!existing) {
    throw new HttpError("Client not found", 404);
  }
  const workspaceId = String((existing as Record<string, unknown>).workspaceId ?? "");
  if (input.email !== undefined) {
    const newEmail = (input.email || "").trim() || undefined;
    await assertClientEmailUnique(collection, workspaceId, newEmail, _id);
  }
  const updateDoc: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  const existingRec = existing as Record<string, unknown>;
  const existingNames = namesFromDoc(existingRec);
  let nextFirst = existingNames.firstName;
  let nextLast = existingNames.lastName;
  const touchedName =
    input.firstName !== undefined || input.lastName !== undefined || input.fullName !== undefined;
  if (input.fullName !== undefined && input.firstName === undefined && input.lastName === undefined) {
    const split = splitLegacyFullName(input.fullName);
    nextFirst = split.firstName;
    nextLast = split.lastName;
  } else {
    if (input.firstName !== undefined) nextFirst = input.firstName.trim();
    if (input.lastName !== undefined) nextLast = input.lastName.trim();
  }
  if (touchedName) {
    updateDoc.firstName = nextFirst;
    updateDoc.lastName = nextLast;
    updateDoc.fullName = joinClientFullName(nextFirst, nextLast) || "-";
  }
  if (input.email !== undefined) updateDoc.email = (input.email || "").trim() || undefined;
  if (input.phone !== undefined) updateDoc.phone = (input.phone || "").trim() || undefined;
  if (input.status !== undefined && CLIENT_STATUSES.includes(input.status as (typeof CLIENT_STATUSES)[number]))
    updateDoc.status = input.status;
  if (input.city !== undefined) updateDoc.city = (input.city || "").trim() || undefined;
  if (input.coniuge !== undefined) updateDoc.coniuge = input.coniuge;
  if (input.family !== undefined) updateDoc.family = input.family;
  if (input.budget !== undefined) updateDoc.budget = input.budget;
  if (input.motivazione !== undefined) updateDoc.motivazione = input.motivazione;
  if (input.note !== undefined) updateDoc.note = input.note;
  if (input.profilazione !== undefined) updateDoc.profilazione = input.profilazione;
  if (input.trattamento !== undefined) updateDoc.trattamento = input.trattamento;
  if (input.marketing !== undefined) updateDoc.marketing = input.marketing;
  if (input.selectedAppartments !== undefined) updateDoc.selectedAppartments = input.selectedAppartments;
  if (input.interestedAppartments !== undefined) updateDoc.interestedAppartments = input.interestedAppartments;
  if (input.actions !== undefined) updateDoc.actions = input.actions;
  if (input.activityState !== undefined) updateDoc.activityState = input.activityState;
  if (input.activityStateHistory !== undefined) updateDoc.activityStateHistory = input.activityStateHistory;
  if (input.additionalInfo !== undefined) updateDoc.additionalInfo = input.additionalInfo;

  const touchIn = input.marketingAttribution?.touch;
  if (touchIn && touchHasSignal(touchIn)) {
    const now = new Date().toISOString();
    const normalized = normalizeTouchPartial(touchIn, now);
    const prevAttr = existingRec.marketingAttribution;
    if (isMarketingAttributionDoc(prevAttr)) {
      updateDoc.marketingAttribution = {
        firstTouch: prevAttr.firstTouch,
        lastTouch: normalized,
      };
    } else {
      updateDoc.marketingAttribution = { firstTouch: normalized, lastTouch: normalized };
    }
  }

  try {
    await collection.updateOne({ _id }, { $set: updateDoc });
  } catch (err: unknown) {
    if (err && typeof err === "object" && "code" in err && (err as { code: number }).code === 11000) {
      throw new HttpError("Un cliente con questa email esiste già in questo workspace", 409);
    }
    throw err;
  }
  const updated = await collection.findOne({ _id });
  const row = mapDocToClientRow(updated as Record<string, unknown>);
  return { client: row, workspaceId };
};
