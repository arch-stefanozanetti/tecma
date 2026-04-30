/**
 * Rate Plan: piano tariffario collegato al commercial model.
 * pricing_model: fixed_sale | monthly_rent | nightly_dynamic.
 * Collection tz_rate_plans.
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";

const COLLECTION = "tz_rate_plans";
export type PricingModel = "fixed_sale" | "monthly_rent" | "nightly_dynamic";

let indexEnsured = false;
async function ensureIndex(): Promise<void> {
  if (indexEnsured) return;
  const db = getDb();
  await db.collection(COLLECTION).createIndex({ commercialModelId: 1 });
  indexEnsured = true;
}

export interface RatePlanRow {
  _id: string;
  commercialModelId: string;
  name: string;
  pricingModel: PricingModel;
  createdAt: string;
}

function toRow(d: { _id: ObjectId; commercialModelId?: string; name?: string; pricingModel?: string; createdAt?: unknown }): RatePlanRow {
  const pm = d.pricingModel as PricingModel;
  return {
    _id: d._id instanceof ObjectId ? d._id.toHexString() : String(d._id),
    commercialModelId: d.commercialModelId ?? "",
    name: d.name ?? "Default",
    pricingModel: pm === "monthly_rent" || pm === "nightly_dynamic" ? pm : "fixed_sale",
    createdAt: typeof d.createdAt === "string" ? d.createdAt : (d.createdAt instanceof Date ? d.createdAt.toISOString() : ""),
  };
}

export const listRatePlansByCommercialModelId = async (commercialModelId: string): Promise<RatePlanRow[]> => {
  if (!commercialModelId?.trim()) return [];
  await ensureIndex();
  const db = getDb();
  const docs = await db.collection(COLLECTION).find({ commercialModelId }).toArray();
  return (docs as unknown as Parameters<typeof toRow>[0][]).map(toRow);
};

export const createRatePlan = async (
  commercialModelId: string,
  name: string,
  pricingModel: PricingModel
): Promise<RatePlanRow> => {
  if (!commercialModelId?.trim()) {
    throw new HttpError("commercialModelId obbligatorio", 400);
  }
  await ensureIndex();
  const db = getDb();
  const now = new Date().toISOString();
  const doc = { commercialModelId, name: name || "Default", pricingModel, createdAt: now, _id: new ObjectId() };
  await db.collection(COLLECTION).insertOne(doc);
  return toRow(doc as Parameters<typeof toRow>[0]);
};

export const getFirstRatePlanForUnit = async (unitId: string): Promise<RatePlanRow | null> => {
  const { getCommercialModelByUnitId } = await import("../commercial-models/commercial-models.service.js");
  const cm = await getCommercialModelByUnitId(unitId);
  if (!cm) return null;
  const plans = await listRatePlansByCommercialModelId(cm._id);
  return plans[0] ?? null;
};
