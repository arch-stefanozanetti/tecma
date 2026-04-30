/**
 * Best-effort importo totale da documento quote legacy (`asset.quotes`).
 * Allinea opzionalmente `tz_quotes.totalPrice` al flusso digitale quando presente in legacy.
 */
export function extractLegacyQuoteTotalPrice(q: Record<string, unknown>): number | undefined {
  const direct = q.totalPrice;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  const cq = q.customQuote;
  if (cq && typeof cq === "object" && cq !== null) {
    const o = cq as Record<string, unknown>;
    const tp = o.totalPrice ?? o.total;
    if (typeof tp === "number" && Number.isFinite(tp)) return tp;
  }
  return undefined;
}
