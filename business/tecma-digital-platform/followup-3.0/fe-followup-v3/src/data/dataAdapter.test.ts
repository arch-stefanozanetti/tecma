import { describe, it, expect, vi, beforeEach } from "vitest";
import { dataAdapter } from "./dataAdapter";

vi.mock("../api/followupApi", () => ({
  followupApi: {
    queryClients: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, perPage: 25, total: 0, totalPages: 1 },
    }),
    queryApartments: vi.fn().mockResolvedValue({
      data: [],
      pagination: { page: 1, perPage: 25, total: 0, totalPages: 1 },
    }),
  },
}));

describe("dataAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getCockpitFeed ritorna items e kpis", async () => {
    const result = await dataAdapter.getCockpitFeed({
      workspaceId: "w",
      projectIds: ["p"],
    });
    expect(result).toHaveProperty("items");
    expect(Array.isArray(result.items)).toBe(true);
    expect(result).toHaveProperty("kpis");
    expect(result.kpis).toMatchObject({
      pipelineValue: expect.any(Number),
      clientsHot: expect.any(Number),
      openActions: expect.any(Number),
      conversionRisk: expect.any(Number),
    });
  });

  it("getClients ritorna data e pagination", async () => {
    const result = await dataAdapter.getClients({
      workspaceId: "w",
      projectIds: ["p"],
      page: 1,
      perPage: 25,
      searchText: "",
      sort: { field: "updatedAt", direction: -1 },
      filters: {},
    });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
    expect(result.pagination).toMatchObject({
      page: 1,
      perPage: 25,
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it("getApartments ritorna data e pagination", async () => {
    const result = await dataAdapter.getApartments({
      workspaceId: "w",
      projectIds: ["p"],
      page: 1,
      perPage: 25,
      searchText: "",
      sort: { field: "updatedAt", direction: -1 },
      filters: {},
    });
    expect(result).toHaveProperty("data");
    expect(result.pagination.total).toBeGreaterThanOrEqual(0);
  });

  it("runQuickAction ritorna ok e message", async () => {
    const result = await dataAdapter.runQuickAction({
      intent: "create_task",
      title: "Test",
    });
    expect(result.ok).toBe(true);
    expect(result.message).toBeDefined();
    expect(typeof result.message).toBe("string");
  });

  it("getClients con filtri status e searchText applica filtri", async () => {
    const result = await dataAdapter.getClients({
      workspaceId: "w",
      projectIds: ["proj-alpha"],
      page: 1,
      perPage: 10,
      searchText: "Cliente 1",
      sort: { field: "updatedAt", direction: -1 },
      filters: { status: ["lead"] },
    });
    expect(result.data.length).toBeLessThanOrEqual(10);
    expect(result.pagination.total).toBeGreaterThanOrEqual(0);
  });

  it("getClients con filtri source, city, dateFrom, dateTo, onlyMyHome", async () => {
    const from = new Date(Date.now() - 30 * 86400000).toISOString();
    const to = new Date().toISOString();
    const result = await dataAdapter.getClients({
      workspaceId: "w",
      projectIds: ["proj-alpha"],
      page: 1,
      perPage: 25,
      searchText: "",
      sort: { field: "updatedAt", direction: -1 },
      filters: {
        source: ["Meta Ads"],
        city: ["Milano"],
        dateFrom: from,
        dateTo: to,
        onlyMyHome: true,
      },
    });
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("pagination");
  });

  it("getApartments con filtri status e mode", async () => {
    const result = await dataAdapter.getApartments({
      workspaceId: "w",
      projectIds: ["proj-beta"],
      page: 2,
      perPage: 5,
      searchText: "Unit",
      sort: { field: "updatedAt", direction: -1 },
      filters: { status: ["AVAILABLE"], mode: ["SELL"] },
    });
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.pagination).toMatchObject({
      page: expect.any(Number),
      perPage: expect.any(Number),
      total: expect.any(Number),
      totalPages: expect.any(Number),
    });
  });

  it("getClients con page e perPage ritorna struttura paginazione valida", async () => {
    const result = await dataAdapter.getClients({
      workspaceId: "w",
      projectIds: [],
      page: 3,
      perPage: 10,
      searchText: "",
      sort: { field: "updatedAt", direction: -1 },
      filters: {},
    });
    expect(result.pagination.page).toBeGreaterThanOrEqual(1);
    expect(result.pagination.perPage).toBeGreaterThanOrEqual(1);
    expect(result.pagination.totalPages).toBeGreaterThanOrEqual(1);
  });
});
