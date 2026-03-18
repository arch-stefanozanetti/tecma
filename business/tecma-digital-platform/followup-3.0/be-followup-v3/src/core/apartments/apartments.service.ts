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
