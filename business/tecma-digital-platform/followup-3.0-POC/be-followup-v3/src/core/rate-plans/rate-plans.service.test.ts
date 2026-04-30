import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const createIndexMock = vi.fn();
  const findMock = vi.fn();
  const toArrayMock = vi.fn();
  const insertOneMock = vi.fn();
  const getCommercialModelByUnitIdMock = vi.fn();

  findMock.mockReturnValue({ toArray: toArrayMock });

  const collectionMock = {
    createIndex: createIndexMock,
    find: findMock,
    insertOne: insertOneMock,
  };

  return {
    findMock,
    toArrayMock,
    insertOneMock,
    getCommercialModelByUnitIdMock,
    collectionMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => mocks.collectionMock,
  }),
}));

vi.mock("../commercial-models/commercial-models.service.js", () => ({
  getCommercialModelByUnitId: mocks.getCommercialModelByUnitIdMock,
}));

import {
  createRatePlan,
  getFirstRatePlanForUnit,
  listRatePlansByCommercialModelId,
} from "./rate-plans.service.js";

describe("rate-plans.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toArrayMock.mockResolvedValue([]);
    mocks.insertOneMock.mockResolvedValue({ acknowledged: true });
    mocks.getCommercialModelByUnitIdMock.mockResolvedValue(null);
  });

  it("returns empty list on blank commercialModelId", async () => {
    await expect(listRatePlansByCommercialModelId("")).resolves.toEqual([]);
    expect(mocks.findMock).not.toHaveBeenCalled();
  });

  it("creates rate plan and normalizes default name/pricing model", async () => {
    await expect(createRatePlan("cm1", "", "fixed_sale")).resolves.toEqual(
      expect.objectContaining({ commercialModelId: "cm1", name: "Default", pricingModel: "fixed_sale" })
    );
  });

  it("validates required commercialModelId", async () => {
    await expect(createRatePlan("", "Plan", "monthly_rent")).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns first plan from commercial model", async () => {
    mocks.getCommercialModelByUnitIdMock.mockResolvedValueOnce({ _id: "cm1" });
    const rowId = new ObjectId();
    mocks.toArrayMock.mockResolvedValueOnce([
      {
        _id: rowId,
        commercialModelId: "cm1",
        name: "Rent Plan",
        pricingModel: "monthly_rent",
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await expect(getFirstRatePlanForUnit("u1")).resolves.toEqual(
      expect.objectContaining({ _id: rowId.toHexString(), pricingModel: "monthly_rent" })
    );
  });
});
