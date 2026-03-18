/**
 * Prezzo corrente per unit: da SalePrice / MonthlyRent (legacy rawPrice rimosso).
 */
import { getCurrentSalePrice } from "../sale-prices/sale-prices.service.js";
import { getCurrentMonthlyRent } from "../monthly-rents/monthly-rents.service.js";

export type CurrentPriceSource = "sale_price" | "monthly_rent";

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

  return null;
};
