import { describe, it, expect } from "vitest";
import { normalizePrice } from "./price-normalizer.js";

describe("normalizePrice", () => {
  it("normalizza affitto in EUR con cadence MONTH", () => {
    const result = normalizePrice({
      mode: "RENT",
      amount: 1200,
      currency: "EUR",
      cadence: "MONTH"
    });
    expect(result.mode).toBe("RENT");
    expect(result.amountCents).toBe(120000);
    expect(result.currency).toBe("EUR");
    expect(result.cadence).toBe("MONTH");
    expect(result.display).toMatch(/1200|1\.200/);
    expect(result.display).toContain("/mese");
  });

  it("normalizza vendita (SELL) con cadence ONCE", () => {
    const result = normalizePrice({
      mode: "SELL",
      amount: 250000,
      currency: "EUR"
    });
    expect(result.mode).toBe("SELL");
    expect(result.cadence).toBe("ONCE");
    expect(result.amountCents).toBe(25000000);
    expect(result.display).not.toMatch(/\/mese|\/anno/);
  });

  it("usa EUR di default se currency assente", () => {
    const result = normalizePrice({ mode: "RENT", amount: 500 });
    expect(result.currency).toBe("EUR");
    expect(result.cadence).toBe("MONTH");
  });

  it("RENT senza cadence usa MONTH", () => {
    const result = normalizePrice({ mode: "RENT", amount: 800, currency: "EUR" });
    expect(result.cadence).toBe("MONTH");
    expect(result.display).toContain("/mese");
  });

  it("RENT con cadence YEAR mostra /anno", () => {
    const result = normalizePrice({
      mode: "RENT",
      amount: 10000,
      currency: "EUR",
      cadence: "YEAR"
    });
    expect(result.cadence).toBe("YEAR");
    expect(result.display).toContain("/anno");
  });

  it("arrotonda amount a centesimi", () => {
    const result = normalizePrice({ mode: "RENT", amount: 99.994, currency: "EUR" });
    expect(result.amountCents).toBe(9999);
  });

  it("documenti legacy senza rawPrice non lancia e usa default SELL 0 EUR", () => {
    const result = normalizePrice(undefined);
    expect(result.mode).toBe("SELL");
    expect(result.amountCents).toBe(0);
    expect(result.currency).toBe("EUR");
    expect(result.cadence).toBe("ONCE");
  });

  it("amount non numerico finito usa 0", () => {
    const result = normalizePrice({ mode: "SELL", amount: NaN });
    expect(result.amountCents).toBe(0);
    expect(result.mode).toBe("SELL");
  });
});
