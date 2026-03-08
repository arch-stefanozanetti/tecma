export type ListingMode = "RENT" | "SELL";

export interface RawPrice {
  mode: ListingMode;
  amount: number;
  currency?: string;
  cadence?: "MONTH" | "YEAR";
}

export interface NormalizedPrice {
  mode: ListingMode;
  amountCents: number;
  currency: string;
  cadence: "ONCE" | "MONTH" | "YEAR";
  display: string;
}

export const normalizePrice = (raw: RawPrice): NormalizedPrice => {
  const currency = raw.currency ?? "EUR";
  const amountCents = Math.round(raw.amount * 100);
  const cadence = raw.mode === "SELL" ? "ONCE" : raw.cadence ?? "MONTH";

  const formatter = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  const base = formatter.format(raw.amount);
  const suffix = cadence === "ONCE" ? "" : cadence === "MONTH" ? "/mese" : "/anno";

  return {
    mode: raw.mode,
    amountCents,
    currency,
    cadence,
    display: `${base}${suffix}`
  };
};
