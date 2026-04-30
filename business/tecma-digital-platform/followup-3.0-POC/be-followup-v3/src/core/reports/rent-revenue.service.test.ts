import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const apartmentsChain = {
    countDocuments: vi.fn(),
    aggregate: vi.fn().mockReturnValue({ toArray: vi.fn() }),
  };
  const requestsChain = {
    find: vi.fn(),
    aggregate: vi.fn().mockReturnValue({ toArray: vi.fn() }),
  };
  const quotesChain = {
    find: vi.fn(),
  };
  return { apartmentsChain, requestsChain, quotesChain };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_apartments") return mocks.apartmentsChain;
      if (name === "tz_requests") return mocks.requestsChain;
      if (name === "tz_quotes") return mocks.quotesChain;
      return { countDocuments: vi.fn(), aggregate: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) };
    },
  }),
}));

import { getRentRevenueSummary } from "./rent-revenue.service.js";

describe("rent-revenue.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const qid = new ObjectId();
    mocks.apartmentsChain.countDocuments.mockImplementation(async (filter: Record<string, unknown>) => {
      if (filter.status === "RENTED") return 3;
      return 10;
    });
    mocks.apartmentsChain.aggregate.mockReturnValue({
      toArray: vi.fn().mockResolvedValue([{ mrr: 2400 }]),
    });
    mocks.requestsChain.find
      .mockReturnValueOnce({
        toArray: () =>
          Promise.resolve([
            {
              _id: new ObjectId(),
              quoteId: qid.toHexString(),
              quoteTotalPrice: 4500,
              quoteExpiryOn: "2025-01-31T00:00:00.000Z",
              updatedAt: "2025-01-15T10:00:00.000Z",
              apartmentId: "apt-1",
            },
            {
              _id: new ObjectId(),
              quoteId: "",
              budget: 500,
              updatedAt: "2025-01-20T10:00:00.000Z",
              apartmentId: "apt-2",
            },
          ]),
      })
      .mockReturnValueOnce({
        toArray: () =>
          Promise.resolve([
            { quoteId: qid.toHexString(), quoteTotalPrice: 4500 },
            { quoteId: "", budget: 500 },
          ]),
      });
    mocks.quotesChain.find.mockReturnValue({
      toArray: () => Promise.resolve([{ _id: qid, totalPrice: 5000, expiryOn: "2025-01-31T00:00:00.000Z" }]),
    });
    mocks.requestsChain.aggregate.mockReturnValue({
      toArray: () => Promise.resolve([{ deals: 4, value: 8000 }]),
    });
  });

  it("returns summary with MRR from apartments aggregate", async () => {
    const { data } = await getRentRevenueSummary({
      workspaceId: "ws1",
      projectIds: ["p1"],
      dateFrom: "2025-01-01",
      dateTo: "2025-01-31",
    });

    expect(data.rentUnitsListed).toBe(10);
    expect(data.rentUnitsRented).toBe(3);
    expect(data.estimatedMrr).toBe(2400);
    expect(data.monthsInPeriod).toBeGreaterThanOrEqual(1);
    expect(data.periodWonDealsValue).toBe(5500);
    expect(data.periodWonDealsCount).toBe(2);
    expect(data.cumulativeWonDealsValue).toBe(5500);
    expect(data.cumulativeWonDealsCount).toBe(2);
    expect(data.openRentPipelineDeals).toBe(4);
    expect(data.monthly.some((m) => m.month === "2025-01")).toBe(true);
    expect(data.dataQuality.wonDealsWithoutQuoteLink).toBe(1);
    expect(data.methodology.length).toBeGreaterThan(20);
  });

  it("rejects invalid input", async () => {
    await expect(getRentRevenueSummary({ workspaceId: "", projectIds: ["p1"] })).rejects.toMatchObject({ statusCode: 400 });
  });
});
