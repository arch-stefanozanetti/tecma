/**
 * Prezzo corrente per unit: da SalePrice / MonthlyRent con fallback a tz_apartments.rawPrice (backward compatibility).
 */
import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { getCurrentSalePrice } from "../sale-prices/sale-prices.service.js";
import { getCurrentMonthlyRent } from "../monthly-rents/monthly-rents.service.js";

export type CurrentPriceSource = "sale_price" | "monthly_rent" | "rawPrice";

export interface CurrentPriceResult {
  source: CurrentPriceSource;
  amount: number;
  currency: string;
  mode: "SELL" | "RENT";
  validFrom?: string;
  validTo?: string;
  deposit?: number;
}

export const getCurrentPriceForUnit = async (unitId: string): Promise<CurrentPriceResult | null> => {
  if (!unitId?.trim()) return null;

  const sale = await getCurrentSalePrice(unitId);
  if (sale && sale.price > 0) {
    return {
      source: "sale_price",
      amount: sale.price,
      currency: sale.currency,
      mode: "SELL",
      validFrom: sale.validFrom,
      validTo: sale.validTo,
    };
  }

  const rent = await getCurrentMonthlyRent(unitId);
  if (rent && rent.pricePerMonth > 0) {
    return {
      source: "monthly_rent",
      amount: rent.pricePerMonth,
      currency: rent.currency,
      mode: "RENT",
      validFrom: rent.validFrom,
      validTo: rent.validTo,
      deposit: rent.deposit,
    };
  }

  const db = getDb();
  if (!ObjectId.isValid(unitId)) return null;
  const apt = await db.collection("tz_apartments").findOne({ _id: new ObjectId(unitId) });
  if (!apt) return null;
  const raw = (apt as { rawPrice?: { mode?: string; amount?: number } }).rawPrice;
  if (raw && typeof raw.amount === "number") {
    return {
      source: "rawPrice",
      amount: raw.amount,
      currency: "EUR",
      mode: (raw.mode === "RENT" ? "RENT" : "SELL") as "SELL" | "RENT",
    };
  }

  return null;
};
