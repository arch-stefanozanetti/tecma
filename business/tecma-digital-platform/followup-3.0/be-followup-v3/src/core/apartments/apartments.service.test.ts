import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { HttpError } from "../../types/http.js";

const {
  findOneMock,
  insertOneMock,
  updateOneMock,
  countDocumentsMock,
  toArrayMock,
  projectMock,
  limitMock,
  skipMock,
  sortMock,
  findMock,
  createInventoryForUnitMock,
  upsertCommercialModelMock,
  createRatePlanMock,
  createSalePriceMock,
  createMonthlyRentMock,
  emitDomainEventMock,
} = vi.hoisted(() => {
  const toArrayMock = vi.fn();
  const projectMock = vi.fn(() => ({ toArray: toArrayMock }));
  const limitMock = vi.fn(() => ({ project: projectMock, toArray: toArrayMock }));
  const skipMock = vi.fn(() => ({ limit: limitMock, project: projectMock, toArray: toArrayMock }));
  const sortMock = vi.fn(() => ({ skip: skipMock, limit: limitMock, project: projectMock, toArray: toArrayMock }));
  const findMock = vi.fn(() => ({ sort: sortMock, skip: skipMock, limit: limitMock, project: projectMock, toArray: toArrayMock }));
  return {
    findOneMock: vi.fn(),
    insertOneMock: vi.fn(),
    updateOneMock: vi.fn(),
    countDocumentsMock: vi.fn(),
    toArrayMock,
    projectMock,
    limitMock,
    skipMock,
    sortMock,
    findMock,
    createInventoryForUnitMock: vi.fn(),
    upsertCommercialModelMock: vi.fn(),
    createRatePlanMock: vi.fn(),
    createSalePriceMock: vi.fn(),
    createMonthlyRentMock: vi.fn(),
    emitDomainEventMock: vi.fn(),
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      find: findMock,
      findOne: findOneMock,
      insertOne: insertOneMock,
      updateOne: updateOneMock,
      countDocuments: countDocumentsMock,
    }),
  }),
}));

vi.mock("../events/event-log.service.js", () => ({
  emitDomainEvent: emitDomainEventMock,
}));

vi.mock("../inventory/inventory.service.js", () => ({
  createInventoryForUnit: createInventoryForUnitMock,
}));

vi.mock("../commercial-models/commercial-models.service.js", () => ({
  upsertCommercialModel: upsertCommercialModelMock,
}));

vi.mock("../rate-plans/rate-plans.service.js", () => ({
  createRatePlan: createRatePlanMock,
}));

vi.mock("../sale-prices/sale-prices.service.js", () => ({
  createSalePrice: createSalePriceMock,
}));

vi.mock("../monthly-rents/monthly-rents.service.js", () => ({
  createMonthlyRent: createMonthlyRentMock,
}));

import { createApartment, getApartmentById, queryApartments, updateApartment } from "./apartments.service.js";

describe("apartments.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitDomainEventMock.mockResolvedValue(undefined);
    upsertCommercialModelMock.mockResolvedValue({ _id: "cm-1" });
    createInventoryForUnitMock.mockResolvedValue(undefined);
    createRatePlanMock.mockResolvedValue(undefined);
    createSalePriceMock.mockResolvedValue(undefined);
    createMonthlyRentMock.mockResolvedValue(undefined);
  });

  it("queryApartments returns paginated data from tz_apartments", async () => {
    const now = new Date().toISOString();
    toArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(),
        workspaceId: "ws1",
        projectId: "p1",
        code: "A-101",
        name: "Apt 101",
        status: "AVAILABLE",
        mode: "SELL",
        surfaceMq: 88,
        rawPrice: { mode: "SELL", amount: 120000 },
        planimetryUrl: "https://cdn/x",
        updatedAt: now,
        createdAt: now,
      },
    ]);
    countDocumentsMock.mockResolvedValueOnce(1);

    const result = await queryApartments({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 25,
      sort: { field: "updatedAt", direction: -1 },
      filters: {},
    });

    expect(result.pagination.total).toBe(1);
    expect(result.data[0].code).toBe("A-101");
  });

  it("createApartment returns 409 when duplicate name exists", async () => {
    findOneMock.mockResolvedValueOnce({ _id: new ObjectId(), name: "Apt 101" });

    await expect(
      createApartment({
        workspaceId: "ws1",
        projectId: "p1",
        name: "Apt 101",
        code: "A-101",
        price: 1000,
        floor: 1,
        mode: "SELL",
        status: "AVAILABLE",
        surfaceMq: 80,
        planimetryUrl: "https://cdn/plan",
      })
    ).rejects.toMatchObject({ statusCode: 409 } as Partial<HttpError>);
  });

  it("getApartmentById returns 404 when apartment does not exist", async () => {
    findOneMock.mockResolvedValueOnce(null);
    const id = new ObjectId().toHexString();

    await expect(getApartmentById(id)).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);
  });

  it("updateApartment returns updated row", async () => {
    const id = new ObjectId();
    const now = new Date().toISOString();
    const existing = {
      _id: id,
      workspaceId: "ws1",
      projectId: "p1",
      code: "A-101",
      name: "Apt 101",
      status: "AVAILABLE",
      mode: "SELL",
      surfaceMq: 80,
      rawPrice: { mode: "SELL", amount: 1000 },
      planimetryUrl: "https://cdn/plan",
      updatedAt: now,
      createdAt: now,
    };
    const updated = { ...existing, name: "Apt 101 Updated" };
    findOneMock.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

    const result = await updateApartment({ apartmentId: id.toHexString(), name: "Apt 101 Updated" });

    expect(updateOneMock).toHaveBeenCalledOnce();
    expect(result.apartment.name).toBe("Apt 101 Updated");
  });

  it("getApartmentById returns mapped apartment", async () => {
    const id = new ObjectId();
    const now = new Date().toISOString();
    findOneMock.mockResolvedValueOnce({
      _id: id,
      workspaceId: "ws1",
      projectId: "p1",
      code: "A-200",
      name: "Apt 200",
      status: "RESERVED",
      mode: "SELL",
      surfaceMq: 91,
      rawPrice: { mode: "SELL", amount: 210000 },
      planimetryUrl: "https://cdn/p",
      updatedAt: now,
      createdAt: now,
    });

    const result = await getApartmentById(id.toHexString());
    expect(result.apartment._id).toBe(id.toHexString());
    expect(result.apartment.code).toBe("A-200");
  });

  it("createApartment creates SELL apartment and sale price", async () => {
    findOneMock.mockResolvedValueOnce(null);
    insertOneMock.mockResolvedValueOnce({ acknowledged: true });

    const result = await createApartment({
      workspaceId: "ws1",
      projectId: "p1",
      name: "Apt 301",
      code: "A-301",
      price: 300000,
      floor: 3,
      mode: "SELL",
      status: "AVAILABLE",
      surfaceMq: 110,
      planimetryUrl: "https://cdn/plan",
    });

    expect(result.apartmentId).toBeTruthy();
    expect(createInventoryForUnitMock).toHaveBeenCalledWith(result.apartmentId, "ws1", "available");
    expect(upsertCommercialModelMock).toHaveBeenCalledWith(result.apartmentId, "ws1", "sell");
    expect(createRatePlanMock).toHaveBeenCalledWith("cm-1", "Default", "fixed_sale");
    expect(createSalePriceMock).toHaveBeenCalledTimes(1);
    expect(createMonthlyRentMock).not.toHaveBeenCalled();
    expect(emitDomainEventMock).toHaveBeenCalledTimes(1);
  });

  it("createApartment creates RENT apartment and monthly rent with deposit", async () => {
    findOneMock.mockResolvedValueOnce(null);
    insertOneMock.mockResolvedValueOnce({ acknowledged: true });

    const result = await createApartment({
      workspaceId: "ws1",
      projectId: "p1",
      name: "Apt 401",
      code: "A-401",
      price: 1400,
      floor: 4,
      mode: "RENT",
      status: "RENTED",
      surfaceMq: 70,
      planimetryUrl: "https://cdn/plan",
      deposit: 2800,
    });

    expect(createInventoryForUnitMock).toHaveBeenCalledWith(result.apartmentId, "ws1", "reserved");
    expect(upsertCommercialModelMock).toHaveBeenCalledWith(result.apartmentId, "ws1", "rent_long");
    expect(createRatePlanMock).toHaveBeenCalledWith("cm-1", "Default", "monthly_rent");
    expect(createMonthlyRentMock).toHaveBeenCalledTimes(1);
    expect(createSalePriceMock).not.toHaveBeenCalled();
  });

  it("createApartment skips price services when price is zero", async () => {
    findOneMock.mockResolvedValueOnce(null);
    insertOneMock.mockResolvedValueOnce({ acknowledged: true });

    await createApartment({
      workspaceId: "ws1",
      projectId: "p1",
      name: "Apt 000",
      code: "A-000",
      price: 0,
      floor: 0,
      mode: "SELL",
      status: "SOLD",
      surfaceMq: 10,
      planimetryUrl: "https://cdn/plan",
    });

    expect(createInventoryForUnitMock).toHaveBeenCalledWith(expect.any(String), "ws1", "sold");
    expect(createSalePriceMock).not.toHaveBeenCalled();
    expect(createMonthlyRentMock).not.toHaveBeenCalled();
  });

  it("updateApartment returns 404 when apartment does not exist for rawPrice branch", async () => {
    const id = new ObjectId().toHexString();
    findOneMock.mockResolvedValueOnce(null);

    await expect(updateApartment({ apartmentId: id, price: 999 })).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);
  });

  it("updateApartment returns 404 when current apartment is missing", async () => {
    const id = new ObjectId().toHexString();
    const existing = {
      _id: new ObjectId(id),
      workspaceId: "ws1",
      projectId: "p1",
      code: "A-101",
      name: "Apt 101",
      status: "AVAILABLE",
      mode: "SELL",
      surfaceMq: 80,
      rawPrice: { mode: "SELL", amount: 1000 },
      planimetryUrl: "https://cdn/plan",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    findOneMock.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);

    await expect(updateApartment({ apartmentId: id, price: 1200 })).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);
  });

  it("updateApartment returns 404 when updated apartment cannot be loaded", async () => {
    const id = new ObjectId().toHexString();
    const existing = {
      _id: new ObjectId(id),
      workspaceId: "ws1",
      projectId: "p1",
      code: "A-101",
      name: "Apt 101",
      status: "AVAILABLE",
      mode: "SELL",
      surfaceMq: 80,
      rawPrice: { mode: "SELL", amount: 1000 },
      planimetryUrl: "https://cdn/plan",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    findOneMock.mockResolvedValueOnce(existing).mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

    await expect(updateApartment({ apartmentId: id, price: 1200 })).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);
  });
});
