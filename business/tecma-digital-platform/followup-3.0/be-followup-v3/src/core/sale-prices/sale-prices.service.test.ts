import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const createIndexMock = vi.fn();
  const findMock = vi.fn();
  const sortMock = vi.fn();
  const toArrayMock = vi.fn();
  const findOneMock = vi.fn();
  const insertOneMock = vi.fn();
  const findOneAndUpdateMock = vi.fn();

  sortMock.mockReturnValue({ toArray: toArrayMock });
  findMock.mockReturnValue({ sort: sortMock });

  const collectionMock = {
    createIndex: createIndexMock,
    find: findMock,
    findOne: findOneMock,
    insertOne: insertOneMock,
    findOneAndUpdate: findOneAndUpdateMock,
  };

  return {
    createIndexMock,
    findMock,
    sortMock,
    toArrayMock,
    findOneMock,
    insertOneMock,
    findOneAndUpdateMock,
    collectionMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => mocks.collectionMock,
  }),
}));

import {
  createSalePrice,
  getCurrentSalePrice,
  listSalePricesByUnitId,
  updateSalePrice,
} from "./sale-prices.service.js";

describe("sale-prices.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toArrayMock.mockResolvedValue([]);
    mocks.findOneMock.mockResolvedValue(null);
    mocks.insertOneMock.mockResolvedValue({ acknowledged: true });
    mocks.findOneAndUpdateMock.mockResolvedValue(null);
  });

  it("returns empty list on blank unitId", async () => {
    await expect(listSalePricesByUnitId("")).resolves.toEqual([]);
    expect(mocks.findMock).not.toHaveBeenCalled();
  });

  it("maps current price row from db", async () => {
    const id = new ObjectId();
    mocks.findOneMock.mockResolvedValueOnce({
      _id: id,
      unitId: "u1",
      workspaceId: "ws1",
      price: 120000,
      currency: "EUR",
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(getCurrentSalePrice("u1")).resolves.toEqual(
      expect.objectContaining({
        _id: id.toHexString(),
        unitId: "u1",
        price: 120000,
        currency: "EUR",
      })
    );
  });

  it("validates mandatory fields on create", async () => {
    await expect(createSalePrice({ unitId: "", workspaceId: "", price: 10 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("update returns existing doc when no update payload is provided", async () => {
    const id = new ObjectId();
    mocks.findOneMock.mockResolvedValueOnce({
      _id: id,
      unitId: "u1",
      workspaceId: "ws1",
      price: 10,
      currency: "EUR",
      validFrom: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(updateSalePrice("u1", id.toHexString(), {})).resolves.toEqual(
      expect.objectContaining({ _id: id.toHexString(), unitId: "u1", price: 10 })
    );
    expect(mocks.findOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it("throws on invalid id and on missing db row", async () => {
    await expect(updateSalePrice("u1", "bad-id", { price: 1 })).rejects.toMatchObject({ statusCode: 400 });

    const validId = new ObjectId().toHexString();
    mocks.findOneAndUpdateMock.mockResolvedValueOnce(null);
    await expect(updateSalePrice("u1", validId, { price: 1 })).rejects.toMatchObject({ statusCode: 404 });
  });
});
