/**
 * Canone mensile (storico). Collegati a unit o rate_plan.
 * Collection tz_monthly_rents. valid_from / valid_to per storico.
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_monthly_rents";

let indexEnsured = false;
async function ensureIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = getDb();
  await db.collection(COLLECTION).createIndex({ unitId: 1, validFrom: -1 });
  await db.collection(COLLECTION).createIndex({ ratePlanId: 1, validFrom: -1 });
  indexEnsured = true;
}

export interface MonthlyRentRow {
  _id: string;
  unitId: string;
  ratePlanId?: string;
  workspaceId: string;
  pricePerMonth: number;
  deposit?: number;
  currency: string;
  validFrom: string;
  validTo?: string;
  createdAt: string;
}

function toRow(d: {
  _id: ObjectId;
  unitId?: string;
  ratePlanId?: string;
  workspaceId?: string;
  pricePerMonth?: number;
  deposit?: number;
  currency?: string;
  validFrom?: unknown;
  validTo?: unknown;
  createdAt?: unknown;
}): MonthlyRentRow {
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    unitId: d.unitId ?? "",
    ratePlanId: d.ratePlanId,
    workspaceId: d.workspaceId ?? "",
    pricePerMonth: typeof d.pricePerMonth === "number" ? d.pricePerMonth : 0,
    deposit: typeof d.deposit === "number" ? d.deposit : undefined,
    currency: typeof d.currency === "string" ? d.currency : "EUR",
    validFrom: typeof d.validFrom === "string" ? d.validFrom : (d.validFrom instanceof Date ? d.validFrom.toISOString() : new Date().toISOString()),
    validTo: d.validTo == null ? undefined : (typeof d.validTo === "string" ? d.validTo : (d.validTo instanceof Date ? d.validTo.toISOString() : undefined)),
    createdAt: typeof d.createdAt === "string" ? d.createdAt : (d.createdAt instanceof Date ? d.createdAt.toISOString() : ""),
  };
}

export const listMonthlyRentsByUnitId = async (unitId: string): Promise<MonthlyRentRow[]> => {
  if (!unitId?.trim()) return [];
  await ensureIndex();
  const db = getDb();
  const docs = await db.collection(COLLECTION).find({ unitId }).sort({ validFrom: -1 }).toArray();
  return (docs as unknown as Parameters<typeof toRow>[0][]).map(toRow);
};

export const getCurrentMonthlyRent = async (unitId: string): Promise<MonthlyRentRow | null> => {
  const now = new Date().toISOString();
  await ensureIndex();
  const db = getDb();
  const doc = await db
    .collection(COLLECTION)
    .findOne({
      unitId,
      validFrom: { $lte: now },
      $or: [{ validTo: { $exists: false } }, { validTo: null }, { validTo: { $gte: now } }],
    });
  if (!doc) return null;
  return toRow(doc as Parameters<typeof toRow>[0]);
};

export const createMonthlyRent = async (params: {
  unitId: string;
  workspaceId: string;
  pricePerMonth: number;
  deposit?: number;
  currency?: string;
  validFrom?: string;
  validTo?: string;
  ratePlanId?: string;
}): Promise<MonthlyRentRow> => {
  if (!params.unitId?.trim() || !params.workspaceId?.trim()) {
    throw new HttpError("unitId e workspaceId obbligatori", 400);
  }
  await ensureIndex();
  const db = getDb();
  const now = new Date().toISOString();
  const doc = {
    unitId: params.unitId,
    workspaceId: params.workspaceId,
    pricePerMonth: params.pricePerMonth,
    deposit: params.deposit,
    currency: params.currency ?? "EUR",
    validFrom: params.validFrom ?? now,
    validTo: params.validTo,
    ratePlanId: params.ratePlanId,
    createdAt: now,
    _id: new ObjectId(),
  };
  await db.collection(COLLECTION).insertOne(doc);
  return toRow(doc as Parameters<typeof toRow>[0]);
};

export const updateMonthlyRent = async (
  unitId: string,
  rentId: string,
  updates: { validTo?: string; pricePerMonth?: number; deposit?: number }
): Promise<MonthlyRentRow | null> => {
  if (!unitId?.trim() || !rentId?.trim()) return null;
  await ensureIndex();
  const db = getDb();
  const _id = ObjectId.isValid(rentId) ? new ObjectId(rentId) : null;
  if (!_id) throw new HttpError("rentId non valido", 400);
  const update: Record<string, unknown> = {};
  if (updates.validTo !== undefined) update.validTo = updates.validTo;
  if (typeof updates.pricePerMonth === "number") update.pricePerMonth = updates.pricePerMonth;
  if (updates.deposit !== undefined) update.deposit = updates.deposit;
  if (Object.keys(update).length === 0) {
    const doc = await db.collection(COLLECTION).findOne({ _id, unitId });
    return doc ? toRow(doc as Parameters<typeof toRow>[0]) : null;
  }
  const result = await db.collection(COLLECTION).findOneAndUpdate(
    { _id, unitId },
    { $set: update },
    { returnDocument: "after" }
  );
  if (!result) throw new HttpError("Canone mensile non trovato o non appartiene a questo appartamento", 404);
  return toRow(result as Parameters<typeof toRow>[0]);
};
