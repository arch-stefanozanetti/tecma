import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentSalePriceMock: vi.fn(),
  getCurrentMonthlyRentMock: vi.fn(),
}));

vi.mock("../sale-prices/sale-prices.service.js", () => ({
  getCurrentSalePrice: mocks.getCurrentSalePriceMock,
}));

vi.mock("../monthly-rents/monthly-rents.service.js", () => ({
  getCurrentMonthlyRent: mocks.getCurrentMonthlyRentMock,
}));

import { getCurrentPriceForUnit } from "./unit-pricing.service.js";

describe("unit-pricing.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentSalePriceMock.mockResolvedValue(null);
    mocks.getCurrentMonthlyRentMock.mockResolvedValue(null);
  });

  it("returns null for empty unit id", async () => {
    await expect(getCurrentPriceForUnit("")).resolves.toBeNull();
    expect(mocks.getCurrentSalePriceMock).not.toHaveBeenCalled();
  });

  it("prefers sale price when available", async () => {
    mocks.getCurrentSalePriceMock.mockResolvedValueOnce({
      price: 150000,
      currency: "EUR",
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: undefined,
    });

    await expect(getCurrentPriceForUnit("u1")).resolves.toEqual(
      expect.objectContaining({ source: "sale_price", amount: 150000, mode: "SELL" })
    );
    expect(mocks.getCurrentMonthlyRentMock).not.toHaveBeenCalled();
  });

  it("falls back to monthly rent", async () => {
    mocks.getCurrentSalePriceMock.mockResolvedValueOnce({
      price: 0,
      currency: "EUR",
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: undefined,
    });
    mocks.getCurrentMonthlyRentMock.mockResolvedValueOnce({
      pricePerMonth: 950,
      deposit: 1900,
      currency: "EUR",
      validFrom: "2026-01-01T00:00:00.000Z",
      validTo: undefined,
    });

    await expect(getCurrentPriceForUnit("u1")).resolves.toEqual(
      expect.objectContaining({ source: "monthly_rent", amount: 950, mode: "RENT", deposit: 1900 })
    );
  });

  it("returns null when no positive price is present", async () => {
    mocks.getCurrentSalePriceMock.mockResolvedValueOnce({ price: 0, currency: "EUR" });
    mocks.getCurrentMonthlyRentMock.mockResolvedValueOnce({ pricePerMonth: 0, currency: "EUR" });

    await expect(getCurrentPriceForUnit("u1")).resolves.toBeNull();
  });
});
