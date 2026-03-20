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

export const normalizePrice = (raw: RawPrice | null | undefined): NormalizedPrice => {
  const mode: ListingMode = raw?.mode === "RENT" ? "RENT" : "SELL";
  const amount = typeof raw?.amount === "number" && Number.isFinite(raw.amount) ? raw.amount : 0;
  const currency =
    typeof raw?.currency === "string" && raw.currency.trim() ? raw.currency.trim() : "EUR";
  const amountCents = Math.round(amount * 100);
  const cadence = mode === "SELL" ? "ONCE" : raw?.cadence === "YEAR" ? "YEAR" : "MONTH";

  const formatter = new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });

  const base = formatter.format(amount);
  const suffix = cadence === "ONCE" ? "" : cadence === "MONTH" ? "/mese" : "/anno";

  return {
    mode,
    amountCents,
    currency,
    cadence,
    display: `${base}${suffix}`
  };
};
