import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { HttpError } from "../../types/http.js";

const mocks = vi.hoisted(() => {
  const findOneMock = vi.fn();
  const insertOneMock = vi.fn();
  const updateOneMock = vi.fn();
  const countDocumentsMock = vi.fn();
  const toArrayMock = vi.fn();
  const projectMock = vi.fn(() => ({ toArray: toArrayMock }));
  const limitMock = vi.fn(() => ({ project: projectMock, toArray: toArrayMock }));
  const skipMock = vi.fn(() => ({ limit: limitMock, project: projectMock, toArray: toArrayMock }));
  const sortMock = vi.fn(() => ({ skip: skipMock, limit: limitMock, project: projectMock, toArray: toArrayMock }));
  const findMock = vi.fn(() => ({ sort: sortMock, skip: skipMock, limit: limitMock, project: projectMock, toArray: toArrayMock }));

  const createInventoryForUnitMock = vi.fn();
  const upsertCommercialModelMock = vi.fn();
  const createRatePlanMock = vi.fn();
  const createSalePriceMock = vi.fn();
  const createMonthlyRentMock = vi.fn();
  const emitDomainEventMock = vi.fn();

  const tzApartmentsCollectionMock = {
    find: findMock,
    findOne: findOneMock,
    insertOne: insertOneMock,
    updateOne: updateOneMock,
    countDocuments: countDocumentsMock,
  };

  return {
    findOneMock,
    insertOneMock,
    updateOneMock,
    countDocumentsMock,
    toArrayMock,
    findMock,
    createInventoryForUnitMock,
    upsertCommercialModelMock,
    createRatePlanMock,
    createSalePriceMock,
    createMonthlyRentMock,
    emitDomainEventMock,
    tzApartmentsCollectionMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_apartments") return mocks.tzApartmentsCollectionMock;
      throw new Error(`Unexpected collection: ${name}`);
    },
  }),
}));

vi.mock("../inventory/inventory.service.js", () => ({
  createInventoryForUnit: mocks.createInventoryForUnitMock,
}));

vi.mock("../commercial-models/commercial-models.service.js", () => ({
  upsertCommercialModel: mocks.upsertCommercialModelMock,
}));

vi.mock("../rate-plans/rate-plans.service.js", () => ({
  createRatePlan: mocks.createRatePlanMock,
}));

vi.mock("../sale-prices/sale-prices.service.js", () => ({
  createSalePrice: mocks.createSalePriceMock,
}));

vi.mock("../monthly-rents/monthly-rents.service.js", () => ({
  createMonthlyRent: mocks.createMonthlyRentMock,
}));

vi.mock("../events/event-log.service.js", () => ({
  emitDomainEvent: mocks.emitDomainEventMock,
}));

import { createApartment, getApartmentById, queryApartments, updateApartment } from "./apartments.service.js";

describe("apartments.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertCommercialModelMock.mockResolvedValue({ _id: "cm-1" });
  });

  it("queryApartments returns normalized rows and pagination", async () => {
    const now = new Date().toISOString();
    const aptId = new ObjectId();
    mocks.toArrayMock.mockResolvedValueOnce([
      {
        _id: aptId,
        workspaceId: "ws1",
        projectId: "p1",
        code: "A1",
        name: "App 1",
        status: "AVAILABLE",
        mode: "SELL",
        surfaceMq: 72,
        rawPrice: { mode: "SELL", amount: 200000 },
        planimetryUrl: "http://example.com/plan.pdf",
        updatedAt: now,
        createdAt: now,
      },
    ]);
    mocks.countDocumentsMock.mockResolvedValueOnce(1);

    const result = await queryApartments({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 20,
      filters: { status: ["AVAILABLE"], mode: ["SELL"] },
      searchText: "App",
      sort: { field: "updatedAt", direction: -1 },
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]._id).toBe(aptId.toHexString());
    expect(result.data[0].normalizedPrice.amountCents).toBe(20000000);
    expect(result.pagination.total).toBe(1);
    expect(mocks.findMock).toHaveBeenCalledOnce();
  });

  it("getApartmentById returns apartment mapped from tz collection", async () => {
    const aptId = new ObjectId();
    const now = new Date().toISOString();
    mocks.findOneMock.mockResolvedValueOnce({
      _id: aptId,
      workspaceId: "ws1",
      projectId: "p1",
      code: "A-10",
      name: "Penthouse",
      status: "AVAILABLE",
      mode: "SELL",
      surfaceMq: 100,
      rawPrice: { mode: "SELL", amount: 300000 },
      planimetryUrl: "x",
      updatedAt: now,
      createdAt: now,
    });

    const result = await getApartmentById(aptId.toHexString());

    expect(result.apartment._id).toBe(aptId.toHexString());
    expect(result.apartment.name).toBe("Penthouse");
  });

  it("getApartmentById throws 404 when apartment does not exist", async () => {
    mocks.findOneMock.mockResolvedValueOnce(null);

    await expect(getApartmentById(new ObjectId().toHexString())).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<HttpError>);
  });

  it("createApartment throws 409 on duplicate name in project", async () => {
    mocks.findOneMock.mockResolvedValueOnce({ _id: new ObjectId() });

    await expect(
      createApartment({
        workspaceId: "ws1",
        projectId: "p1",
        code: "A1",
        name: "Dup",
        price: 1000,
        floor: 1,
        mode: "SELL",
        status: "AVAILABLE",
        surfaceMq: 50,
        planimetryUrl: "url",
      })
    ).rejects.toMatchObject({ statusCode: 409 } as Partial<HttpError>);
  });

  it("createApartment creates rent apartment and side effects", async () => {
    mocks.findOneMock.mockResolvedValueOnce(null);
    mocks.insertOneMock.mockResolvedValueOnce({ acknowledged: true });

    const result = await createApartment({
      workspaceId: "ws1",
      projectId: "p1",
      code: "R1",
      name: "Rent Apt",
      price: 1200,
      floor: 3,
      mode: "RENT",
      status: "AVAILABLE",
      surfaceMq: 60,
      planimetryUrl: "http://plan",
      deposit: 2400,
    });

    expect(mocks.insertOneMock).toHaveBeenCalledOnce();
    expect(mocks.createInventoryForUnitMock).toHaveBeenCalledWith(expect.any(String), "ws1", "available");
    expect(mocks.createMonthlyRentMock).toHaveBeenCalledOnce();
    expect(mocks.createSalePriceMock).not.toHaveBeenCalled();
    expect(mocks.createRatePlanMock).toHaveBeenCalledOnce();
    expect(mocks.emitDomainEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: "apartment.created", workspaceId: "ws1", projectId: "p1" })
    );
    expect(result.apartment.mode).toBe("RENT");
  });

  it("updateApartment returns 404 if apartment missing before update", async () => {
    mocks.findOneMock.mockResolvedValueOnce(null);

    await expect(
      updateApartment({
        apartmentId: new ObjectId().toHexString(),
        price: 1000,
      })
    ).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);
  });

  it("updateApartment updates rawPrice and fields", async () => {
    const id = new ObjectId();
    const existing = {
      _id: id,
      workspaceId: "ws1",
      projectId: "p1",
      code: "A1",
      name: "Old",
      status: "AVAILABLE",
      mode: "SELL",
      surfaceMq: 70,
      rawPrice: { mode: "SELL", amount: 100000 },
      planimetryUrl: "url",
      updatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const updated = {
      ...existing,
      name: "New",
      mode: "RENT",
      rawPrice: { mode: "RENT", amount: 1500 },
    };

    mocks.findOneMock
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);

    await updateApartment({
      apartmentId: id.toHexString(),
      name: "New",
      mode: "RENT",
      price: 1500,
    });

    expect(mocks.updateOneMock).toHaveBeenCalledOnce();
    expect(mocks.updateOneMock.mock.calls[0]?.[1]).toMatchObject({
      $set: expect.objectContaining({
        name: "New",
        mode: "RENT",
        rawPrice: { mode: "RENT", amount: 1500 },
      }),
    });
  });
});
