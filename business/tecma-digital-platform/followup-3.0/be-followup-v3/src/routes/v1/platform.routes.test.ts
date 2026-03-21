import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";
import express from "express";
import { closeStable, listenStable, stableRequest } from "../../test/stableHttpServer.js";
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
      findOne: vi.fn().mockResolvedValue(null),
    }),
  }),
}));

const platformApp = express();
platformApp.use(express.json());
platformApp.use("/v1/platform", platformRoutes);

describe("platform.routes", () => {
  let server: Server;
  let origin: string;

  beforeAll(async () => {
    const x = await listenStable(platformApp);
    server = x.server;
    origin = x.origin;
  });

  afterAll(async () => {
    await closeStable(server);
  });

  const st = () => stableRequest(origin);

  beforeEach(() => {
    vi.clearAllMocks();
    queryApartmentsMock.mockResolvedValue({ data: [], paginationInfo: {} });
    queryClientsLiteMock.mockResolvedValue([{ id: "c1" }]);
    runKpiSummaryReportMock.mockResolvedValue({ ok: true });
  });

  it("POST /clients/lite/query usa workspace della chiave e interseca projectIds", async () => {
    const res = await st()
      .post("/v1/platform/clients/lite/query")
      .set("x-api-key", "k-test")
      .send({ projectIds: ["p1"] });

    expect(res.status).toBe(200);
    expect(queryClientsLiteMock).toHaveBeenCalledWith("ws-1", ["p1"]);
    expect(res.body).toEqual({ data: [{ id: "c1" }] });
  });

  it("POST /clients/lite/query 403 se projectIds fuori scope", async () => {
    const res = await st()
      .post("/v1/platform/clients/lite/query")
      .set("x-api-key", "k-test")
      .send({ projectIds: ["other"] });

    expect(res.status).toBe(403);
    expect(queryClientsLiteMock).not.toHaveBeenCalled();
  });
});
