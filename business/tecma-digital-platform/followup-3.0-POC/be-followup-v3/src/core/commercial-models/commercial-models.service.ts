/**
 * Commercial Model: come si vende l'unit (sell | rent_long | rent_short).
 * Collection tz_commercial_models. Una unit può avere un modello (o più in futuro).
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_commercial_models";
export type BusinessType = "sell" | "rent_long" | "rent_short";

let indexEnsured = false;
async function ensureIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = getDb();
  await db.collection(COLLECTION).createIndex({ unitId: 1 });
  await db.collection(COLLECTION).createIndex({ workspaceId: 1 });
  indexEnsured = true;
}

export interface CommercialModelRow {
  _id: string;
  unitId: string;
  workspaceId: string;
  businessType: BusinessType;
  createdAt: string;
}

function toRow(d: { _id: ObjectId; unitId?: string; workspaceId?: string; businessType?: string; createdAt?: unknown }): CommercialModelRow {
  const bt = d.businessType as BusinessType;
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    unitId: d.unitId ?? "",
    workspaceId: d.workspaceId ?? "",
    businessType: bt === "rent_long" || bt === "rent_short" ? bt : "sell",
    createdAt: typeof d.createdAt === "string" ? d.createdAt : (d.createdAt instanceof Date ? d.createdAt.toISOString() : ""),
  };
}

export const getCommercialModelByUnitId = async (unitId: string): Promise<CommercialModelRow | null> => {
  if (!unitId?.trim()) return null;
  await ensureIndex();
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ unitId });
  if (!doc) return null;
  return toRow(doc as Parameters<typeof toRow>[0]);
};

export const upsertCommercialModel = async (
  unitId: string,
  workspaceId: string,
  businessType: BusinessType
): Promise<CommercialModelRow> => {
  if (!unitId?.trim() || !workspaceId?.trim()) {
    throw new HttpError("unitId e workspaceId obbligatori", 400);
  }
  await ensureIndex();
  const db = getDb();
  const now = new Date().toISOString();
  const coll = db.collection(COLLECTION);
  const existing = await coll.findOne({ unitId });
  const doc = { unitId, workspaceId, businessType, createdAt: now };
  if (existing) {
    await coll.updateOne({ unitId }, { $set: { businessType, updatedAt: now } });
    return toRow({ ...(existing as Record<string, unknown>), businessType } as Parameters<typeof toRow>[0]);
  }
  const res = await coll.insertOne({ ...doc, _id: new ObjectId() });
  return toRow({ _id: res.insertedId, ...doc } as Parameters<typeof toRow>[0]);
};
