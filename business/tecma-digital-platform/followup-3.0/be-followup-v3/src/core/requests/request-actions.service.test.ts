import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { HttpError } from "../../types/http.js";

const mocks = vi.hoisted(() => {
  const findOneMock = vi.fn();
  const insertOneMock = vi.fn();
  const updateOneMock = vi.fn();
  const deleteOneMock = vi.fn();
  const toArrayMock = vi.fn();
  const sortMock = vi.fn(() => ({ toArray: toArrayMock }));
  const findMock = vi.fn(() => ({ sort: sortMock, toArray: toArrayMock }));

  return { findOneMock, insertOneMock, updateOneMock, deleteOneMock, toArrayMock, findMock };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      find: mocks.findMock,
      findOne: mocks.findOneMock,
      insertOne: mocks.insertOneMock,
      updateOne: mocks.updateOneMock,
      deleteOne: mocks.deleteOneMock,
    }),
  }),
}));

import {
  createRequestAction,
  deleteRequestAction,
  listRequestActions,
  updateRequestAction,
} from "./request-actions.service.js";

describe("request-actions.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listRequestActions validates workspace and returns rows", async () => {
    await expect(listRequestActions(""))
      .rejects.toMatchObject({ statusCode: 400 } as Partial<HttpError>);

    const id = new ObjectId();
    mocks.toArrayMock.mockResolvedValueOnce([
      {
        _id: id,
        workspaceId: "ws1",
        requestIds: ["r1"],
        type: "note",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const result = await listRequestActions("ws1", "r1");

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]._id).toBe(id.toHexString());
  });

  it("createRequestAction inserts and returns created doc", async () => {
    const id = new ObjectId();
    mocks.insertOneMock.mockResolvedValueOnce({ insertedId: id });
    mocks.findOneMock.mockResolvedValueOnce({
      _id: id,
      workspaceId: "ws1",
      requestIds: ["r1"],
      type: "call",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userId: "u1",
    });

    const result = await createRequestAction(
      { workspaceId: "ws1", requestIds: ["r1"], type: "call", title: "Call" },
      { userId: "u1" }
    );

    expect(mocks.insertOneMock).toHaveBeenCalledOnce();
    expect(result.action.type).toBe("call");
  });

  it("updateRequestAction handles invalid/missing/success", async () => {
    await expect(updateRequestAction("bad", { title: "x" }))
      .rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);

    const id = new ObjectId();
    mocks.findOneMock.mockResolvedValueOnce(null);
    await expect(updateRequestAction(id.toHexString(), { title: "x" }))
      .rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);

    mocks.findOneMock
      .mockResolvedValueOnce({ _id: id, workspaceId: "ws1", requestIds: ["r1"], type: "note" })
      .mockResolvedValueOnce({
        _id: id,
        workspaceId: "ws1",
        requestIds: ["r2"],
        type: "email",
        title: "Updated",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    const result = await updateRequestAction(id.toHexString(), { requestIds: ["r2"], type: "email", title: "Updated" });

    expect(mocks.updateOneMock).toHaveBeenCalledOnce();
    expect(result.action.type).toBe("email");
  });

  it("deleteRequestAction handles invalid/missing/success", async () => {
    await expect(deleteRequestAction("bad")).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);

    mocks.deleteOneMock.mockResolvedValueOnce({ deletedCount: 0 });
    await expect(deleteRequestAction(new ObjectId().toHexString())).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);

    mocks.deleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
    await expect(deleteRequestAction(new ObjectId().toHexString())).resolves.toEqual({ deleted: true });
  });
});
