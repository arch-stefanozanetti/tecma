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

/** ISO 4217 a 3 lettere; altrimenti Intl può lanciare RangeError su dati legacy. */
function sanitizeCurrencyCode(raw: string | undefined): string {
  const c = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : "EUR";
}

function formatPriceDisplay(amount: number, currencyCode: string, cadence: NormalizedPrice["cadence"]): string {
  const safeCurrency = sanitizeCurrencyCode(currencyCode);
  let base: string;
  try {
    const formatter = new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: safeCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    base = formatter.format(amount);
  } catch {
    const formatterEur = new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    base = formatterEur.format(amount);
  }
  const suffix = cadence === "ONCE" ? "" : cadence === "MONTH" ? "/mese" : "/anno";
  return `${base}${suffix}`;
}

export const normalizePrice = (raw: RawPrice | null | undefined): NormalizedPrice => {
  const mode: ListingMode = raw?.mode === "RENT" ? "RENT" : "SELL";
  const amount = typeof raw?.amount === "number" && Number.isFinite(raw.amount) ? raw.amount : 0;
  const currencyRaw =
    typeof raw?.currency === "string" && raw.currency.trim() ? raw.currency.trim() : "EUR";
  const currency = sanitizeCurrencyCode(currencyRaw);
  const amountCents = Math.round(amount * 100);
  const cadence = mode === "SELL" ? "ONCE" : raw?.cadence === "YEAR" ? "YEAR" : "MONTH";

  const display = formatPriceDisplay(amount, currency, cadence);

  return {
    mode,
    amountCents,
    currency,
    cadence,
    display,
  };
};
