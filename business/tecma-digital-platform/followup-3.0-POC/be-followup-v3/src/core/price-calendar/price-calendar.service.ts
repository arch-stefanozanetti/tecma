/**
 * Prezzi per data (short stay / dinamici). MVP: struttura pronta, uso differito.
 * Collection tz_price_calendar. unit_id, date, price, min_stay, availability.
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";

const COLLECTION = "tz_price_calendar";

let indexEnsured = false;
async function ensureIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = getDb();
  await db.collection(COLLECTION).createIndex({ unitId: 1, date: 1 }, { unique: true });
  indexEnsured = true;
}

export interface PriceCalendarRow {
  _id: string;
  unitId: string;
  date: string; // YYYY-MM-DD
  price: number;
  minStay?: number;
  availability?: "available" | "blocked" | "reserved";
  createdAt?: string;
}

export const listPriceCalendarByUnitAndRange = async (
  unitId: string,
  fromDate: string,
  toDate: string
): Promise<PriceCalendarRow[]> => {
  if (!unitId?.trim()) return [];
  await ensureIndex();
  const db = getDb();
  const docs = await db
    .collection(COLLECTION)
    .find({ unitId, date: { $gte: fromDate, $lte: toDate } })
    .sort({ date: 1 })
    .toArray();
  return (docs as unknown as Array<Record<string, unknown>>).map((d) => ({
    _id: d._id instanceof ObjectId ? (d._id as ObjectId).toHexString() : String(d._id),
    unitId: String(d.unitId ?? ""),
    date: String(d.date ?? ""),
    price: Number(d.price ?? 0),
    minStay: typeof d.minStay === "number" ? d.minStay : undefined,
    availability: d.availability as PriceCalendarRow["availability"],
    createdAt: typeof d.createdAt === "string" ? d.createdAt : undefined,
  }));
};

export const upsertPriceCalendarEntry = async (params: {
  unitId: string;
  date: string;
  price: number;
  minStay?: number;
  availability?: PriceCalendarRow["availability"];
}): Promise<void> => {
  if (!params.unitId?.trim() || !params.date?.trim()) return;
  await ensureIndex();
  const db = getDb();
  const now = new Date().toISOString();
  await db.collection(COLLECTION).updateOne(
    { unitId: params.unitId, date: params.date },
    {
      $set: {
        unitId: params.unitId,
        date: params.date,
        price: params.price,
        ...(params.minStay != null ? { minStay: params.minStay } : {}),
        ...(params.availability != null ? { availability: params.availability } : {}),
        updatedAt: now,
      },
    },
    { upsert: true }
  );
};
