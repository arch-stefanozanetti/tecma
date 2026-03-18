import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { HttpError } from "../../types/http.js";

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
  emitDomainEvent: vi.fn().mockResolvedValue(undefined),
}));

import { createApartment, getApartmentById, queryApartments, updateApartment } from "./apartments.service.js";

describe("apartments.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
