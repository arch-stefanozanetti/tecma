import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ListQuerySchema, type ListQueryInput, buildPagination } from "../shared/list-query.js";
import { normalizePrice, type RawPrice } from "../pricing/price-normalizer.js";
import { HttpError, PaginatedResponse } from "../../types/http.js";
import { emitDomainEvent } from "../events/event-log.service.js";

const ObjectIdLikeSchema = z.string().min(1);

export const ApartmentCreateSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  price: z.number().nonnegative(),
  floor: z.number().int(),
  mode: z.enum(["RENT", "SELL"]).default("SELL"),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "RENTED"]).default("AVAILABLE"),
  surfaceMq: z.number().nonnegative().default(0),
  planimetryUrl: z.string().min(1),
  deposit: z.number().nonnegative().optional(),
});

export const ApartmentUpdateSchema = ApartmentCreateSchema.partial().extend({
  apartmentId: ObjectIdLikeSchema,
});

export type RawApartment = {
  _id: ObjectId;
  workspaceId: string;
  projectId: string;
  code: string;
  name: string;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED";
  mode: "RENT" | "SELL";
  surfaceMq: number;
  rawPrice: { mode: "RENT" | "SELL"; amount: number };
  planimetryUrl: string;
  updatedAt: string;
  createdAt: string;
};

const toObjectId = (value: string): ObjectId => {
  if (!ObjectId.isValid(value)) throw new Error(`Invalid ObjectId: ${value}`);
  return new ObjectId(value);
};

const mapApartment = (apartment: RawApartment) => ({
  _id: apartment._id.toHexString(),
  workspaceId: apartment.workspaceId,
  projectId: apartment.projectId,
  code: apartment.code,
  name: apartment.name,
  status: apartment.status,
  mode: apartment.mode,
  surfaceMq: apartment.surfaceMq,
  rawPrice: apartment.rawPrice,
  planimetryUrl: apartment.planimetryUrl,
  updatedAt: apartment.updatedAt,
  createdAt: apartment.createdAt,
});

const LEGACY_APARTMENTS_VIEW = "apartments_view";

type LegacyPlanTypology = { _id?: ObjectId; name?: string };
type LegacyPlanModel = { _id?: ObjectId; name?: string };
type LegacyPlanDimension = { _id?: ObjectId; name?: string };
type LegacyPlanMainFeatures = { rooms?: number; bathroom?: number; bedroom?: number; openPlanKitchen?: boolean };
type LegacyPlanSurfaceArea = {
  total?: number;
  commercial?: number;
  apartment?: number;
  balcony?: number;
  garden?: number;
  loggia?: number;
  terrace?: number;
  penthouse?: number;
};
type LegacyBuilding = {
  _id?: ObjectId;
  name?: string;
  address?: string | null;
  floors?: number;
  code?: string;
  zone?: string | null;
  complex?: string;
  geo?: { lat?: number; lon?: number };
};
type LegacySide = { _id?: ObjectId; name?: string };

type LegacyApartmentDetailDoc = {
  _id?: ObjectId | unknown;
  project_id?: ObjectId | string;
  code?: string;
  name?: string;
  status?: string;
  availability?: { value?: string };
  price?: number;
  floor?: number;
  updatedOn?: Date | string;
  createdOn?: Date | string;
  plan?: {
    _id?: ObjectId;
    name?: string;
    typology?: LegacyPlanTypology;
    model?: LegacyPlanModel;
    dimension?: LegacyPlanDimension;
    surfaceArea?: LegacyPlanSurfaceArea;
    mainFeatures?: LegacyPlanMainFeatures;
  };
  building?: LegacyBuilding;
  sides?: LegacySide[];
  extraInfo?: Record<string, unknown>;
};

const toIsoDateLegacy = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

const normalizeLegacyStatusDetail = (status?: string, availability?: { value?: string }): RawApartment["status"] => {
  const normalized = String(status || "").toLowerCase();
  const availabilityValue = String(availability?.value || "").toUpperCase();
  if (normalized === "rogitato") return "SOLD";
  if (normalized === "locato") return "RENTED";
  if (availabilityValue === "AVAILABLE" || normalized === "libero") return "AVAILABLE";
  return "RESERVED";
};

const resolveSurfaceDetail = (doc: LegacyApartmentDetailDoc): number => {
  const sa = doc.plan?.surfaceArea;
  if (!sa) return 0;
  const total = sa.total;
  const commercial = sa.commercial;
  const apartment = sa.apartment;
  if (typeof total === "number" && total > 0) return total;
  if (typeof commercial === "number" && commercial > 0) return commercial;
  if (typeof apartment === "number" && apartment > 0) return apartment;
  return 0;
};

const inferListingModeDetail = (doc: LegacyApartmentDetailDoc): RawApartment["mode"] => {
  const status = String(doc.status || "").toLowerCase();
  if (status.includes("loca") || status.includes("affit")) return "RENT";
  return "SELL";
};

const mapLegacyApartmentToDetail = (
  doc: LegacyApartmentDetailDoc
): ReturnType<typeof mapApartment> & {
  plan?: LegacyApartmentDetailDoc["plan"];
  building?: LegacyBuilding;
  sides?: LegacySide[];
  floor?: number;
  extraInfo?: Record<string, unknown>;
} => {
  const mode = inferListingModeDetail(doc);
  const amount = typeof doc.price === "number" ? doc.price : 0;
  const projectId =
    doc.project_id instanceof ObjectId ? doc.project_id.toHexString() : typeof doc.project_id === "string" ? doc.project_id : "";
  const updatedAt = toIsoDateLegacy(doc.updatedOn ?? doc.createdOn);
  const base = {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? ""),
    workspaceId: "legacy",
    projectId,
    code: typeof doc.code === "string" && doc.code.trim() ? doc.code : "-",
    name: typeof doc.name === "string" && doc.name.trim() ? doc.name : "-",
    status: normalizeLegacyStatusDetail(doc.status, doc.availability),
    mode,
    surfaceMq: resolveSurfaceDetail(doc),
    rawPrice: { mode, amount },
    planimetryUrl: "",
    updatedAt,
    createdAt: toIsoDateLegacy(doc.createdOn),
  };
  const enriched = { ...base };
  if (doc.plan && typeof doc.plan === "object") (enriched as Record<string, unknown>).plan = doc.plan;
  if (doc.building && typeof doc.building === "object") (enriched as Record<string, unknown>).building = doc.building;
  if (Array.isArray(doc.sides)) (enriched as Record<string, unknown>).sides = doc.sides;
  if (typeof doc.floor === "number") (enriched as Record<string, unknown>).floor = doc.floor;
  if (doc.extraInfo && typeof doc.extraInfo === "object") (enriched as Record<string, unknown>).extraInfo = doc.extraInfo;
  return enriched;
};

export interface ApartmentRow {
  _id: string;
  workspaceId: string;
  projectId: string;
  code: string;
  name: string;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED";
  mode: "RENT" | "SELL";
  surfaceMq: number;
  rawPrice: RawPrice;
  updatedAt: string;
}

export interface ApartmentListRow extends Omit<ApartmentRow, "rawPrice"> {
  normalizedPrice: ReturnType<typeof normalizePrice>;
}

const buildMatch = (q: ListQueryInput) => {
  const match: Record<string, unknown> = {
    workspaceId: q.workspaceId,
    projectId: { $in: q.projectIds }
  };

  const status = q.filters?.status;
  if (Array.isArray(status) && status.length > 0) {
    match.status = { $in: status };
  }

  const mode = q.filters?.mode;
  if (Array.isArray(mode) && mode.length > 0) {
    match.mode = { $in: mode };
  }

  if (q.searchText && q.searchText.trim()) {
    const safe = q.searchText.trim();
    match.$or = [
      { name: { $regex: safe, $options: "i" } },
      { code: { $regex: safe, $options: "i" } }
    ];
  }

  return match;
};

const sortable: Record<string, 1> = {
  code: 1,
  name: 1,
  status: 1,
  mode: 1,
  surfaceMq: 1,
  updatedAt: 1
};

/* c8 ignore start - legacy view mapping kept for migration support, not used in tz_* runtime paths */
type LegacyAvailability = {
  value?: string;
};

type LegacyApartmentDoc = {
  _id?: ObjectId | string;
  project_id?: ObjectId | string;
  code?: string;
  name?: string;
  status?: string;
  availability?: LegacyAvailability;
  available?: boolean;
  spaceType?: string;
  price?: number;
  floor?: number;
  updatedOn?: Date | string;
  createdOn?: Date | string;
  plan?: {
    surfaceArea?: {
      total?: number;
      commercial?: number;
      apartment?: number;
    };
  };
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

const normalizeLegacyStatus = (status?: string, availability?: LegacyAvailability): ApartmentRow["status"] => {
  const normalized = String(status || "").toLowerCase();
  const availabilityValue = String(availability?.value || "").toUpperCase();

  if (normalized === "rogitato") return "SOLD";
  if (normalized === "locato") return "RENTED";
  if (availabilityValue === "AVAILABLE" || normalized === "libero") return "AVAILABLE";
  return "RESERVED";
};

const resolveSurface = (doc: LegacyApartmentDoc): number => {
  const total = doc.plan?.surfaceArea?.total;
  const commercial = doc.plan?.surfaceArea?.commercial;
  const apartment = doc.plan?.surfaceArea?.apartment;
  if (typeof total === "number" && total > 0) return total;
  if (typeof commercial === "number" && commercial > 0) return commercial;
  if (typeof apartment === "number" && apartment > 0) return apartment;
  return 0;
};

const inferListingMode = (doc: LegacyApartmentDoc): ApartmentRow["mode"] => {
  const status = String(doc.status || "").toLowerCase();
  if (status.includes("loca") || status.includes("affit")) return "RENT";
  return "SELL";
};

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

const buildLegacyMatch = (q: ListQueryInput) => {
  const { objectIds, asStrings } = parseProjectIdsForLegacy(q.projectIds);
  const projectConditionValues: Array<ObjectId | string> = [...objectIds, ...asStrings];
  const conditions: Record<string, unknown>[] = [{ project_id: { $in: projectConditionValues } }];

  const status = q.filters?.status;
  if (Array.isArray(status) && status.length > 0) {
    const requested = new Set(status.map((s) => String(s).toUpperCase()));
    const legacyStatuses: string[] = [];
    if (requested.has("AVAILABLE")) legacyStatuses.push("libero");
    if (requested.has("RESERVED")) legacyStatuses.push("proposta", "interesse", "opzionato", "compromesso");
    if (requested.has("SOLD")) legacyStatuses.push("rogitato");
    if (requested.has("RENTED")) legacyStatuses.push("locato", "affittato");
    conditions.push({ status: { $in: legacyStatuses } });
  }

  const mode = q.filters?.mode;
  if (Array.isArray(mode) && mode.length > 0) {
    const normalized = new Set(mode.map((item) => String(item).toUpperCase()));
    if (normalized.has("SELL") && !normalized.has("RENT")) {
      conditions.push({ status: { $nin: ["locato", "affittato"] } });
    }
    if (!normalized.has("SELL") && normalized.has("RENT")) {
      conditions.push({ status: { $in: ["locato", "affittato"] } });
    }
  }

  if (q.searchText && q.searchText.trim()) {
    const safe = q.searchText.trim();
    conditions.push({
      $or: [
        { name: { $regex: safe, $options: "i" } },
        { code: { $regex: safe, $options: "i" } }
      ]
    });
  }

  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
};

const legacySortFieldByInput: Record<string, string> = {
  code: "code",
  name: "name",
  status: "status",
  mode: "status",
  surfaceMq: "plan.surfaceArea.total",
  updatedAt: "updatedOn"
};

const mapLegacyToListRow = (doc: LegacyApartmentDoc): ApartmentListRow => {
  const mode = inferListingMode(doc);
  const amount = typeof doc.price === "number" ? doc.price : 0;
  const rawPrice: RawPrice = {
    mode,
    amount,
    currency: "EUR",
    cadence: mode === "RENT" ? "MONTH" : undefined
  };
  const projectId = doc.project_id instanceof ObjectId ? doc.project_id.toHexString() : typeof doc.project_id === "string" ? doc.project_id : "";

  return {
    _id: String(doc._id ?? ""),
    workspaceId: "legacy",
    projectId,
    code: typeof doc.code === "string" && doc.code.trim() ? doc.code : "-",
    name: typeof doc.name === "string" && doc.name.trim() ? doc.name : "-",
    status: normalizeLegacyStatus(doc.status, doc.availability),
    mode,
    surfaceMq: resolveSurface(doc),
    updatedAt: toIsoDate(doc.updatedOn ?? doc.createdOn),
    normalizedPrice: normalizePrice(rawPrice)
  };
};
/* c8 ignore stop */

const TZ_APARTMENTS_COLLECTION = "tz_apartments";

const queryPrimaryApartments = async (input: ListQueryInput): Promise<PaginatedResponse<ApartmentListRow>> => {
  const db = getDb();
  const collection = db.collection<ApartmentRow>(TZ_APARTMENTS_COLLECTION);

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
      .toArray(),
    collection.countDocuments(match)
  ]);

  const data: ApartmentListRow[] = rawData.map(({ rawPrice, ...rest }) => ({
    ...rest,
    normalizedPrice: normalizePrice(rawPrice)
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

/* c8 ignore start - legacy query fallback not used in current runtime */
const queryLegacyApartments = async (input: ListQueryInput): Promise<PaginatedResponse<ApartmentListRow>> => {
  const db = getDb();
  const collection = db.collection<LegacyApartmentDoc>("apartments_view");

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
        code: 1,
        name: 1,
        status: 1,
        availability: 1,
        available: 1,
        spaceType: 1,
        price: 1,
        floor: 1,
        plan: 1,
        updatedOn: 1,
        createdOn: 1
      })
      .toArray(),
    collection.countDocuments(match)
  ]);

  return {
    data: rawData.map(mapLegacyToListRow),
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage)
    }
  };
};
/* c8 ignore stop */

export const queryApartments = async (rawInput: unknown): Promise<PaginatedResponse<ApartmentListRow>> => {
  const input = ListQuerySchema.parse(rawInput);
  return queryPrimaryApartments(input);
};

export const getApartmentById = async (rawApartmentId: unknown): Promise<{ apartment: ReturnType<typeof mapApartment> }> => {
  const apartmentId = toObjectId(z.string().parse(rawApartmentId));
  const db = getDb();
  const tzDoc = await db.collection<RawApartment>(TZ_APARTMENTS_COLLECTION).findOne({ _id: apartmentId });
  if (tzDoc) {
    const apartment = mapApartment(tzDoc);
    return { apartment };
  }
  throw new HttpError("Apartment not found", 404);
};

export const createApartment = async (rawInput: unknown) => {
  const input = ApartmentCreateSchema.parse(rawInput);
  const db = getDb();
  const collection = db.collection<RawApartment>(TZ_APARTMENTS_COLLECTION);

  const duplicate = await collection.findOne({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    name: { $regex: `^${input.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
  });
  if (duplicate) throw new HttpError("Apartment name already exists for project", 409);

  const now = new Date().toISOString();
  const doc: Omit<RawApartment, "_id"> = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    code: input.code,
    name: input.name,
    status: input.status,
    mode: input.mode,
    surfaceMq: input.surfaceMq,
    rawPrice: { mode: input.mode, amount: input.price },
    planimetryUrl: input.planimetryUrl,
    updatedAt: now,
    createdAt: now,
  };
  const insertedId = new ObjectId();
  await collection.insertOne({ _id: insertedId, ...doc });
  const apartmentId = insertedId.toHexString();
  const invStatus =
    input.status === "RESERVED" ? "reserved" : input.status === "SOLD" ? "sold" : input.status === "RENTED" ? "reserved" : "available";
  const { createInventoryForUnit } = await import("../inventory/inventory.service.js");
  const { upsertCommercialModel } = await import("../commercial-models/commercial-models.service.js");
  const { createRatePlan } = await import("../rate-plans/rate-plans.service.js");
  const { createSalePrice } = await import("../sale-prices/sale-prices.service.js");
  const { createMonthlyRent } = await import("../monthly-rents/monthly-rents.service.js");
  await createInventoryForUnit(apartmentId, input.workspaceId, invStatus);
  const cm = await upsertCommercialModel(apartmentId, input.workspaceId, input.mode === "RENT" ? "rent_long" : "sell");
  await createRatePlan(cm._id, "Default", input.mode === "RENT" ? "monthly_rent" : "fixed_sale");
  if (input.price > 0) {
    if (input.mode === "RENT") {
      await createMonthlyRent({
        unitId: apartmentId,
        workspaceId: input.workspaceId,
        pricePerMonth: input.price,
        validFrom: now,
        ...(input.deposit != null ? { deposit: input.deposit } : {}),
      });
    } else {
      await createSalePrice({ unitId: apartmentId, workspaceId: input.workspaceId, price: input.price, validFrom: now });
    }
  }
  await emitDomainEvent({
    type: "apartment.created",
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    entityId: apartmentId,
    payload: { code: input.code, name: input.name, mode: input.mode, status: input.status },
  });
  return { apartmentId, apartment: mapApartment({ _id: insertedId, ...doc }) };
};

export const updateApartment = async (rawInput: unknown) => {
  const input = ApartmentUpdateSchema.parse(rawInput);
  const collection = getDb().collection<RawApartment>(TZ_APARTMENTS_COLLECTION);
  const apartmentId = toObjectId(input.apartmentId);

  const updateDoc: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (input.name !== undefined) updateDoc.name = input.name;
  if (input.code !== undefined) updateDoc.code = input.code;
  if (input.status !== undefined) updateDoc.status = input.status;
  if (input.mode !== undefined) updateDoc.mode = input.mode;
  if (input.surfaceMq !== undefined) updateDoc.surfaceMq = input.surfaceMq;
  if (input.planimetryUrl !== undefined) updateDoc.planimetryUrl = input.planimetryUrl;
  if (input.price !== undefined || input.mode !== undefined) {
    const existing = await collection.findOne({ _id: apartmentId });
    if (!existing) throw new HttpError("Apartment not found", 404);
    updateDoc.rawPrice = {
      mode: input.mode ?? existing.mode,
      amount: input.price ?? existing.rawPrice.amount,
    };
  }

  const current = await collection.findOne({ _id: apartmentId });
  if (!current) throw new HttpError("Apartment not found", 404);

  await collection.updateOne({ _id: apartmentId }, { $set: updateDoc });
  const updated = await collection.findOne({ _id: apartmentId });
  if (!updated) throw new HttpError("Apartment not found", 404);

  return { apartment: mapApartment(updated) };
};
