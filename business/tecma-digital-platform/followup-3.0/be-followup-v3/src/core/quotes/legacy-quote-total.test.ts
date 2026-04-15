import { describe, expect, it } from "vitest";
import { extractLegacyQuoteTotalPrice } from "./legacy-quote-total.js";

describe("extractLegacyQuoteTotalPrice", () => {
  it("returns top-level totalPrice when set", () => {
    expect(extractLegacyQuoteTotalPrice({ totalPrice: 123.45 })).toBe(123.45);
  });

  it("returns customQuote.totalPrice when top-level missing", () => {
    expect(
      extractLegacyQuoteTotalPrice({
        customQuote: { totalPrice: 99 },
      })
    ).toBe(99);
  });

  it("returns customQuote.total as fallback", () => {
    expect(
      extractLegacyQuoteTotalPrice({
        customQuote: { total: 50 },
      })
    ).toBe(50);
  });

  it("returns undefined when no usable number", () => {
    expect(extractLegacyQuoteTotalPrice({})).toBeUndefined();
    expect(extractLegacyQuoteTotalPrice({ customQuote: {} })).toBeUndefined();
  });
});
