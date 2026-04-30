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

const collectionMock = {
  find: findMock,
  findOne: findOneMock,
  insertOne: insertOneMock,
  updateOne: updateOneMock,
  countDocuments: countDocumentsMock,
};

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => collectionMock,
  }),
}));

import { createClient, getClientById, queryClients, updateClient } from "./clients.service.js";

describe("clients.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queryClients returns normalized rows and pagination", async () => {
    const now = new Date().toISOString();
    toArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(),
        projectId: "p1",
        workspaceId: "ws1",
        fullName: "Mario Rossi",
        email: "mario@test.it",
        phone: "+39 111",
        status: "lead",
        updatedAt: now,
        createdAt: now,
      },
    ]);
    countDocumentsMock.mockResolvedValueOnce(1);

    const result = await queryClients({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 25,
      sort: { field: "updatedAt", direction: -1 },
      filters: {},
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].projectId).toBe("p1");
    expect(result.data[0].firstName).toBe("Mario");
    expect(result.data[0].lastName).toBe("Rossi");
    expect(result.data[0].fullName).toBe("Mario Rossi");
    expect(result.pagination.total).toBe(1);
    expect(findMock).toHaveBeenCalled();
    expect(countDocumentsMock).toHaveBeenCalled();
  });

  it("createClient trims fields and returns created row", async () => {
    const insertedId = new ObjectId();
    const now = new Date().toISOString();
    insertOneMock.mockResolvedValueOnce({ insertedId });
    findOneMock.mockResolvedValueOnce(null);
    findOneMock.mockResolvedValueOnce({
      _id: insertedId,
      workspaceId: "ws1",
      projectId: "p1",
      firstName: "Luca",
      lastName: "Bianchi",
      fullName: "Luca Bianchi",
      email: "luca@test.it",
      phone: "123",
      status: "lead",
      city: "Milano",
      updatedAt: now,
      createdAt: now,
    });

    const result = await createClient({
      workspaceId: "ws1",
      projectId: "p1",
      firstName: "  Luca ",
      lastName: " Bianchi  ",
      email: "luca@test.it",
      phone: " 123 ",
      status: "lead",
      city: " Milano ",
    });

    expect(insertOneMock).toHaveBeenCalledOnce();
    expect(result.client._id).toBe(insertedId.toHexString());
    expect(result.client.firstName).toBe("Luca");
    expect(result.client.lastName).toBe("Bianchi");
    expect(result.client.fullName).toBe("Luca Bianchi");
    expect(result.client.email).toBe("luca@test.it");
    expect(result.client.phone).toBe("123");
    expect(result.client.city).toBe("Milano");
  });

  it("getClientById returns 404 on invalid id", async () => {
    await expect(getClientById("not-an-object-id")).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<HttpError>);
  });

  it("updateClient returns updated row", async () => {
    const id = new ObjectId();
    const existing = {
      _id: id,
      workspaceId: "ws1",
      projectId: "p1",
      fullName: "Old Name",
      status: "lead",
      updatedAt: new Date().toISOString(),
    };
    const updated = {
      ...existing,
      fullName: "New Name",
      email: "new@test.it",
      updatedAt: new Date().toISOString(),
    };

    findOneMock.mockResolvedValueOnce(existing).mockResolvedValueOnce(null).mockResolvedValueOnce(updated);
    updateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });

    const result = await updateClient(id.toHexString(), { fullName: "New Name", email: "new@test.it" });

    expect(updateOneMock).toHaveBeenCalledOnce();
    expect(result.client.firstName).toBe("New");
    expect(result.client.lastName).toBe("Name");
    expect(result.client.fullName).toBe("New Name");
    expect(result.client.email).toBe("new@test.it");
    expect(result.workspaceId).toBe("ws1");
  });
});
