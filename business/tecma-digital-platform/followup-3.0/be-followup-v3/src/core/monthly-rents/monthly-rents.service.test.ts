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
    findMock,
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
  createMonthlyRent,
  getCurrentMonthlyRent,
  listMonthlyRentsByUnitId,
  updateMonthlyRent,
} from "./monthly-rents.service.js";

describe("monthly-rents.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.toArrayMock.mockResolvedValue([]);
    mocks.findOneMock.mockResolvedValue(null);
    mocks.insertOneMock.mockResolvedValue({ acknowledged: true });
    mocks.findOneAndUpdateMock.mockResolvedValue(null);
  });

  it("returns empty list on blank unitId", async () => {
    await expect(listMonthlyRentsByUnitId(" ")).resolves.toEqual([]);
    expect(mocks.findMock).not.toHaveBeenCalled();
  });

  it("maps current monthly rent row from db", async () => {
    const id = new ObjectId();
    mocks.findOneMock.mockResolvedValueOnce({
      _id: id,
      unitId: "u1",
      workspaceId: "ws1",
      pricePerMonth: 900,
      deposit: 1800,
      currency: "EUR",
      validFrom: new Date("2026-01-01T00:00:00.000Z"),
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    await expect(getCurrentMonthlyRent("u1")).resolves.toEqual(
      expect.objectContaining({
        _id: id.toHexString(),
        unitId: "u1",
        pricePerMonth: 900,
        deposit: 1800,
      })
    );
  });

  it("validates mandatory fields on create", async () => {
    await expect(createMonthlyRent({ unitId: "", workspaceId: "", pricePerMonth: 10 })).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("returns existing row when update payload is empty", async () => {
    const id = new ObjectId();
    mocks.findOneMock.mockResolvedValueOnce({
      _id: id,
      unitId: "u1",
      workspaceId: "ws1",
      pricePerMonth: 1000,
      currency: "EUR",
      validFrom: "2026-01-01T00:00:00.000Z",
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(updateMonthlyRent("u1", id.toHexString(), {})).resolves.toEqual(
      expect.objectContaining({ _id: id.toHexString(), unitId: "u1" })
    );
    expect(mocks.findOneAndUpdateMock).not.toHaveBeenCalled();
  });

  it("throws on invalid id and when row does not exist", async () => {
    await expect(updateMonthlyRent("u1", "bad-id", { pricePerMonth: 1 })).rejects.toMatchObject({ statusCode: 400 });

    await expect(updateMonthlyRent("u1", new ObjectId().toHexString(), { pricePerMonth: 1 })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
