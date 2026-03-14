/**
 * Migrazione: da tz_apartments (rawPrice, mode, status) a tz_inventory, tz_commercial_models, tz_rate_plans, tz_sale_prices, tz_monthly_rents.
 * Idempotente: salta unità che hanno già inventory. rawPrice su tz_apartments resta per backward compatibility (sola lettura).
 *
 * Esecuzione: npx tsx src/utils/migrate-apartments-to-inventory-pricing.ts
 */
import { ObjectId } from "mongodb";
import { connectDb, getDb } from "../config/db.js";

const TZ_APARTMENTS = "tz_apartments";
const TZ_INVENTORY = "tz_inventory";
const TZ_COMMERCIAL_MODELS = "tz_commercial_models";
const TZ_RATE_PLANS = "tz_rate_plans";
const TZ_SALE_PRICES = "tz_sale_prices";
const TZ_MONTHLY_RENTS = "tz_monthly_rents";

type ApartmentStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED";
type ApartmentMode = "RENT" | "SELL";
type InventoryStatus = "available" | "locked" | "reserved" | "sold";
type BusinessType = "sell" | "rent_long" | "rent_short";
type PricingModel = "fixed_sale" | "monthly_rent" | "nightly_dynamic";

function toInventoryStatus(s: ApartmentStatus): InventoryStatus {
  const m: Record<ApartmentStatus, InventoryStatus> = { AVAILABLE: "available", RESERVED: "reserved", SOLD: "sold", RENTED: "reserved" };
  return m[s] ?? "available";
}

function toBusinessType(mode: ApartmentMode): BusinessType {
  return mode === "RENT" ? "rent_long" : "sell";
}

function toPricingModel(mode: ApartmentMode): PricingModel {
  return mode === "RENT" ? "monthly_rent" : "fixed_sale";
}

async function migrate() {
  await connectDb();
  const db = getDb();
  const apartments = db.collection(TZ_APARTMENTS);
  const inventory = db.collection(TZ_INVENTORY);
  const commercialModels = db.collection(TZ_COMMERCIAL_MODELS);
  const ratePlans = db.collection(TZ_RATE_PLANS);
  const salePrices = db.collection(TZ_SALE_PRICES);
  const monthlyRents = db.collection(TZ_MONTHLY_RENTS);

  await inventory.createIndex({ unitId: 1 }, { unique: true }).catch(() => {});
  await commercialModels.createIndex({ unitId: 1 }).catch(() => {});
  await ratePlans.createIndex({ commercialModelId: 1 }).catch(() => {});
  await salePrices.createIndex({ unitId: 1, validFrom: -1 }).catch(() => {});
  await monthlyRents.createIndex({ unitId: 1, validFrom: -1 }).catch(() => {});

  const cursor = apartments.find({});
  let processed = 0;
  let skipped = 0;
  let errors = 0;

  while (await cursor.hasNext()) {
    const apt = (await cursor.next()) as {
      _id: ObjectId;
      workspaceId?: string;
      projectId?: string;
      code?: string;
      name?: string;
      status?: ApartmentStatus;
      mode?: ApartmentMode;
      rawPrice?: { mode?: ApartmentMode; amount?: number };
      surfaceMq?: number;
      updatedAt?: string;
      createdAt?: string;
    } | null;
    if (!apt) continue;

    const unitId = apt._id instanceof ObjectId ? apt._id.toHexString() : String(apt._id);
    const workspaceId = apt.workspaceId ?? "";
    const status = (apt.status ?? "AVAILABLE") as ApartmentStatus;
    const mode = (apt.mode ?? "SELL") as ApartmentMode;
    const amount = typeof apt.rawPrice?.amount === "number" ? apt.rawPrice.amount : 0;

    try {
      const existingInv = await inventory.findOne({ unitId });
      if (existingInv) {
        skipped++;
        processed++;
        continue;
      }

      const now = new Date().toISOString();

      await inventory.insertOne({
        unitId,
        workspaceId,
        inventoryStatus: toInventoryStatus(status),
        updatedAt: now,
      });

      const existingCm = await commercialModels.findOne({ unitId });
      let commercialModelId: string;
      if (existingCm) {
        commercialModelId = existingCm._id instanceof ObjectId ? (existingCm._id as ObjectId).toHexString() : String(existingCm._id);
      } else {
        const cmRes = await commercialModels.insertOne({
          unitId,
          workspaceId,
          businessType: toBusinessType(mode),
          createdAt: now,
          _id: new ObjectId(),
        });
        commercialModelId = cmRes.insertedId.toHexString();
      }

      const existingRp = await ratePlans.findOne({ commercialModelId });
      if (!existingRp) {
        await ratePlans.insertOne({
          commercialModelId,
          name: "Default",
          pricingModel: toPricingModel(mode),
          createdAt: now,
          _id: new ObjectId(),
        });
      }

      if (mode === "SELL" && amount > 0) {
        const existingSale = await salePrices.findOne({ unitId, validFrom: { $lte: now }, $or: [{ validTo: { $exists: false } }, { validTo: null }, { validTo: { $gte: now } }] });
        if (!existingSale) {
          await salePrices.insertOne({
            unitId,
            workspaceId,
            price: amount,
            currency: "EUR",
            validFrom: apt.createdAt ?? now,
            createdAt: now,
            _id: new ObjectId(),
          });
        }
      }
      if (mode === "RENT" && amount > 0) {
        const existingRent = await monthlyRents.findOne({ unitId, validFrom: { $lte: now }, $or: [{ validTo: { $exists: false } }, { validTo: null }, { validTo: { $gte: now } }] });
        if (!existingRent) {
          await monthlyRents.insertOne({
            unitId,
            workspaceId,
            pricePerMonth: amount,
            currency: "EUR",
            validFrom: apt.createdAt ?? now,
            createdAt: now,
            _id: new ObjectId(),
          });
        }
      }

      processed++;
    } catch (e) {
      errors++;
      // eslint-disable-next-line no-console
      console.error(`Error migrating unit ${unitId}:`, e);
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Migration done. Processed: ${processed}, Skipped (already had inventory): ${skipped}, Errors: ${errors}`);
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
