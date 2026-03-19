import type { ApartmentRow } from "../../types/domain";

export const STATUS_FILTER_OPTIONS: { value: ApartmentRow["status"]; label: string }[] = [
  { value: "AVAILABLE", label: "Disponibile" },
  { value: "RESERVED", label: "Riservato" },
  { value: "SOLD", label: "Venduto" },
  { value: "RENTED", label: "Affittato" },
];

export const STATUS_LABEL: Record<ApartmentRow["status"], string> = {
  AVAILABLE: "Disponibile",
  RESERVED: "Riservato",
  SOLD: "Venduto",
  RENTED: "Affittato",
};

export const MODE_LABEL: Record<ApartmentRow["mode"], string> = {
  RENT: "Affitto",
  SELL: "Vendita",
};

export const INVENTORY_STATUS_LABEL: Record<string, string> = {
  locked: "In trattativa (bloccato)",
  reserved: "Riservato",
  sold: "Venduto",
};

const DEFAULT_INVENTORY_LABEL = "Disponibile";

export function getInventoryStatusLabel(inventory: { effectiveStatus: string } | null): string {
  if (!inventory?.effectiveStatus) return DEFAULT_INVENTORY_LABEL;
  return INVENTORY_STATUS_LABEL[inventory.effectiveStatus] ?? DEFAULT_INVENTORY_LABEL;
}

export type PanoramicaPrices = {
  current: {
    source: string;
    amount: number;
    currency: string;
    mode: string;
    validFrom?: string;
    validTo?: string;
    deposit?: number;
  } | null;
  salePrices: Array<{ _id: string; price: number; currency: string; validFrom: string; validTo?: string }>;
  monthlyRents: Array<{
    _id: string;
    pricePerMonth: number;
    deposit?: number;
    currency: string;
    validFrom: string;
    validTo?: string;
  }>;
};

export function getPriceDisplay(
  apartment: ApartmentRow,
  prices: PanoramicaPrices | null
): string {
  if (prices?.current != null) {
    const fmt = (amount: number, currency: string) =>
      new Intl.NumberFormat("it-IT", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    if (prices.current.mode === "RENT") {
      return fmt(prices.current.amount, prices.current.currency) + " / mese";
    }
    return fmt(prices.current.amount, prices.current.currency);
  }
  if (
    apartment.normalizedPrice &&
    typeof apartment.normalizedPrice === "object" &&
    "display" in apartment.normalizedPrice
  ) {
    return (apartment.normalizedPrice as { display: string }).display;
  }
  if (
    apartment.rawPrice != null &&
    typeof apartment.rawPrice === "object" &&
    "amount" in apartment.rawPrice
  ) {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format((apartment.rawPrice as { amount: number }).amount);
  }
  return "—";
}
