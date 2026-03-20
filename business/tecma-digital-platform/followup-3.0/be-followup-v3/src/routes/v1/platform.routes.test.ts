import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { platformRoutes } from "./platform.routes.js";

vi.mock("../../config/env.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../config/env.js")>();
  return {
    ...actual,
    ENV: {
      ...actual.ENV,
      PLATFORM_API_KEYS: JSON.stringify({
        "k-test": {
          workspaceId: "ws-1",
          projectIds: ["p1", "p2"],
          label: "test",
          scopes: [
            "platform.capabilities.read",
            "platform.listings.read",
            "platform.reports.read",
            "platform.clients.read",
          ],
        },
      }),
    },
  };
});

const queryApartmentsMock = vi.fn();
const queryClientsLiteMock = vi.fn();
const runKpiSummaryReportMock = vi.fn();

vi.mock("../../core/apartments/apartments.service.js", () => ({
  queryApartments: (...args: unknown[]) => queryApartmentsMock(...args),
}));

vi.mock("../../core/future/future.service.js", () => ({
  queryClientsLite: (...args: unknown[]) => queryClientsLiteMock(...args),
}));

vi.mock("../../core/reports/reports.service.js", () => ({
  runKpiSummaryReport: (...args: unknown[]) => runKpiSummaryReportMock(...args),
}));

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      findOneAndUpdate: vi.fn().mockResolvedValue({ count: 1 }),
    }),
  }),
}));

describe("platform.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryApartmentsMock.mockResolvedValue({ data: [], paginationInfo: {} });
    queryClientsLiteMock.mockResolvedValue([{ id: "c1" }]);
    runKpiSummaryReportMock.mockResolvedValue({ ok: true });
  });

  it("POST /clients/lite/query usa workspace della chiave e interseca projectIds", async () => {
    const app = express();
    app.use(express.json());
    app.use("/v1/platform", platformRoutes);

    const res = await request(app)
      .post("/v1/platform/clients/lite/query")
      .set("x-api-key", "k-test")
      .send({ projectIds: ["p1"] });

    expect(res.status).toBe(200);
    expect(queryClientsLiteMock).toHaveBeenCalledWith("ws-1", ["p1"]);
    expect(res.body).toEqual({ data: [{ id: "c1" }] });
  });

  it("POST /clients/lite/query 403 se projectIds fuori scope", async () => {
    const app = express();
    app.use(express.json());
    app.use("/v1/platform", platformRoutes);

    const res = await request(app)
      .post("/v1/platform/clients/lite/query")
      .set("x-api-key", "k-test")
      .send({ projectIds: ["other"] });

    expect(res.status).toBe(403);
    expect(queryClientsLiteMock).not.toHaveBeenCalled();
  });
});
