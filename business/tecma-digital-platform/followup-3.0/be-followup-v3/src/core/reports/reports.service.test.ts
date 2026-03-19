import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const requestsAggregateToArray = vi.fn();
  const apartmentsAggregateToArray = vi.fn();
  const requestsCollection = {
    aggregate: vi.fn().mockReturnValue({ toArray: requestsAggregateToArray }),
  };
  const apartmentsCollection = {
    aggregate: vi.fn().mockReturnValue({ toArray: apartmentsAggregateToArray }),
  };
  return {
    requestsAggregateToArray,
    apartmentsAggregateToArray,
    requestsCollection,
    apartmentsCollection,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_requests") return mocks.requestsCollection;
      if (name === "tz_apartments") return mocks.apartmentsCollection;
      return { aggregate: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }) };
    },
  }),
}));

import { runKpiSummaryReport, runReport } from "./reports.service.js";

describe("reports.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestsAggregateToArray.mockResolvedValue([
      {
        totalRequests: 10,
        wonRequests: 4,
        activePipeline: 6,
        pipelineValue: 125000,
      },
    ]);
    mocks.apartmentsAggregateToArray.mockResolvedValue([
      { _id: "available", count: 3 },
      { _id: "reserved", count: 2 },
    ]);
  });

  it("returns kpi_summary with 5 metrics", async () => {
    const result = await runKpiSummaryReport({
      workspaceId: "ws1",
      projectIds: ["p1"],
    });
    expect(result.data).toHaveLength(5);
    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ metric: "pipeline_funnel", value: 6 }),
        expect.objectContaining({ metric: "conversion_rate", value: 40 }),
        expect.objectContaining({ metric: "agent_performance", value: 4 }),
        expect.objectContaining({ metric: "pipeline_value", value: 125000 }),
        expect.objectContaining({ metric: "apartments_by_status", value: 5 }),
      ])
    );
  });

  it("dispatches kpi_summary via runReport", async () => {
    const result = await runReport("kpi_summary", {
      workspaceId: "ws1",
      projectIds: ["p1"],
    });
    expect(result.data).toHaveLength(5);
  });
});

