import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const findToArrayMock = vi.fn();
const findOneMock = vi.fn();
const insertOneMock = vi.fn();
const updateOneMock = vi.fn();
const deleteOneMock = vi.fn();
const deleteManyMock = vi.fn();

const findMock = vi.fn(() => ({ sort: vi.fn(() => ({ toArray: findToArrayMock })) }));

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      find: findMock,
      findOne: findOneMock,
      insertOne: insertOneMock,
      updateOne: updateOneMock,
      deleteOne: deleteOneMock,
      deleteMany: deleteManyMock,
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

  it("lists actions ordered and mapped", async () => {
    findToArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId("64b64f3fd9024a2a53111111"),
        workspaceId: "ws1",
        requestIds: ["r1"],
        type: "note",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      },
    ]);

    const result = await listRequestActions("ws1", "r1");

    expect(findMock).toHaveBeenCalledWith({ workspaceId: "ws1", requestIds: "r1" });
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]._id).toBe("64b64f3fd9024a2a53111111");
  });

  it("creates and reloads action", async () => {
    const insertedId = new ObjectId("64b64f3fd9024a2a53111111");
    insertOneMock.mockResolvedValueOnce({ insertedId });
    findOneMock.mockResolvedValueOnce({
      _id: insertedId,
      workspaceId: "ws1",
      requestIds: ["r1"],
      type: "call",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
      userId: "u1",
    });

    const result = await createRequestAction(
      { workspaceId: "ws1", requestIds: ["r1"], type: "call" },
      { userId: "u1" }
    );

    expect(insertOneMock).toHaveBeenCalledTimes(1);
    expect(result.action.type).toBe("call");
    expect(result.action.userId).toBe("u1");
  });

  it("updates an existing action", async () => {
    const id = "64b64f3fd9024a2a53111111";
    findOneMock
      .mockResolvedValueOnce({ _id: new ObjectId(id), workspaceId: "ws1", requestIds: ["r1"], type: "note" })
      .mockResolvedValueOnce({
        _id: new ObjectId(id),
        workspaceId: "ws1",
        requestIds: ["r2"],
        type: "email",
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-02"),
      });

    const result = await updateRequestAction(id, { type: "email", requestIds: ["r2"] });

    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(result.action.type).toBe("email");
    expect(result.action.requestIds).toEqual(["r2"]);
  });

  it("deletes an existing action", async () => {
    deleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
    const id = "64b64f3fd9024a2a53111111";

    const result = await deleteRequestAction(id);

    expect(result.deleted).toBe(true);
    expect(deleteOneMock).toHaveBeenCalledTimes(1);
  });

  it("throws on invalid id for update/delete", async () => {
    await expect(updateRequestAction("bad-id", { type: "note" })).rejects.toMatchObject({ statusCode: 404 });
    await expect(deleteRequestAction("bad-id")).rejects.toMatchObject({ statusCode: 404 });
  });
});
