/**
 * Inventory: stato disponibilità per unit (1:1 con unit/apartment).
 * Collection tz_inventory. inventory_status: available | locked | reserved | sold.
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_inventory";
export type InventoryStatus = "available" | "locked" | "reserved" | "sold";

let indexEnsured = false;
async function ensureIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = getDb();
  await db.collection(COLLECTION).createIndex({ unitId: 1 }, { unique: true });
  await db.collection(COLLECTION).createIndex({ workspaceId: 1 });
  indexEnsured = true;
}

export interface InventoryRow {
  _id: string;
  unitId: string;
  workspaceId: string;
  inventoryStatus: InventoryStatus;
  requestId?: string;
  updatedAt: string;
}

function toRow(d: { _id: ObjectId; unitId?: string; workspaceId?: string; inventoryStatus?: string; requestId?: string; updatedAt?: unknown }): InventoryRow {
  const status = d.inventoryStatus as InventoryStatus;
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    unitId: d.unitId ?? "",
    workspaceId: d.workspaceId ?? "",
    inventoryStatus: status === "locked" || status === "reserved" || status === "sold" ? status : "available",
    requestId: d.requestId,
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : (d.updatedAt instanceof Date ? d.updatedAt.toISOString() : ""),
  };
}

export const getInventoryByUnitId = async (unitId: string): Promise<InventoryRow | null> => {
  if (!unitId?.trim() || !ObjectId.isValid(unitId)) return null;
  await ensureIndex();
  const db = getDb();
  const doc = await db.collection(COLLECTION).findOne({ unitId });
  if (!doc) return null;
  return toRow(doc as Parameters<typeof toRow>[0]);
};

export const setInventoryStatus = async (
  unitId: string,
  workspaceId: string,
  inventoryStatus: InventoryStatus,
  requestId?: string
): Promise<InventoryRow> => {
  if (!unitId?.trim() || !workspaceId?.trim()) {
    throw new HttpError("unitId e workspaceId obbligatori", 400);
  }
  await ensureIndex();
  const db = getDb();
  const now = new Date().toISOString();
  const coll = db.collection(COLLECTION);
  const existing = await coll.findOne({ unitId });
  const doc = {
    unitId,
    workspaceId,
    inventoryStatus,
    ...(requestId != null ? { requestId } : {}),
    updatedAt: now,
  };
  if (existing) {
    await coll.updateOne({ unitId }, { $set: doc });
    return toRow({ _id: existing._id as ObjectId, ...doc });
  }
  const res = await coll.insertOne({ ...doc, _id: new ObjectId() });
  return toRow({ _id: res.insertedId, ...doc });
};

export const createInventoryForUnit = async (unitId: string, workspaceId: string, initialStatus: InventoryStatus = "available"): Promise<InventoryRow> => {
  return setInventoryStatus(unitId, workspaceId, initialStatus);
};

export const upsertInventoryFromApartmentStatus = async (
  unitId: string,
  workspaceId: string,
  apartmentStatus: "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED"
): Promise<InventoryRow> => {
  const map: Record<string, InventoryStatus> = {
    AVAILABLE: "available",
    RESERVED: "reserved",
    SOLD: "sold",
    RENTED: "reserved",
  };
  return setInventoryStatus(unitId, workspaceId, map[apartmentStatus] ?? "available");
};
