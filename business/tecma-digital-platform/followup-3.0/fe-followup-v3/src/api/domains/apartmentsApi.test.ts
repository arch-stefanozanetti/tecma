import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  patchJson: vi.fn(),
  putJson: vi.fn(),
}));

vi.mock("../http", () => ({
  getJson: mocks.getJson,
  postJson: mocks.postJson,
  patchJson: mocks.patchJson,
  putJson: mocks.putJson,
}));

import { apartmentsApi } from "./apartmentsApi";

describe("apartmentsApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("query/update/get by id", () => {
    apartmentsApi.queryApartments({ workspaceId: "ws1", projectIds: ["p1"], page: 1, perPage: 10 } as never);
    apartmentsApi.updateApartment("a1", { name: "APT" });
    apartmentsApi.getApartmentById("a1", "ws1");

    expect(mocks.postJson).toHaveBeenCalledWith(
      "/apartments/query",
      expect.objectContaining({ workspaceId: "ws1", projectIds: ["p1"] })
    );
    expect(mocks.patchJson).toHaveBeenCalledWith("/apartments/a1", { name: "APT" });
    expect(mocks.getJson).toHaveBeenCalledWith("/apartments/a1?workspaceId=ws1");
  });

  it("requests/prices/inventory endpoints", () => {
    apartmentsApi.getApartmentRequests("a/1", "ws 1", ["p1", "p/2"], 2, 15);
    apartmentsApi.getApartmentPrices("a1", "ws1");
    apartmentsApi.getApartmentInventory("a1", "ws1");
    apartmentsApi.updateApartmentInventory("a1", { workspaceId: "ws1", inventoryStatus: "reserved" });
    apartmentsApi.upsertApartmentPriceCalendar("a1", "ws1", {
      date: "2026-01-01",
      price: 1000,
      minStay: 2,
      availability: "available",
    });

    expect(mocks.getJson).toHaveBeenCalledWith(
      "/apartments/a/1/requests?workspaceId=ws%201&projectIds=p1,p%2F2&page=2&perPage=15"
    );
    expect(mocks.getJson).toHaveBeenCalledWith("/apartments/a1/prices?workspaceId=ws1");
    expect(mocks.getJson).toHaveBeenCalledWith("/apartments/a1/inventory?workspaceId=ws1");
    expect(mocks.patchJson).toHaveBeenCalledWith("/apartments/a1/inventory", {
      workspaceId: "ws1",
      inventoryStatus: "reserved",
    });
    expect(mocks.putJson).toHaveBeenCalledWith("/apartments/a1/prices/calendar?workspaceId=ws1", {
      date: "2026-01-01",
      price: 1000,
      minStay: 2,
      availability: "available",
    });
  });
});
