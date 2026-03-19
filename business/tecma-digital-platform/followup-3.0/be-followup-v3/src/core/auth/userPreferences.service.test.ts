import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const findOneMock = vi.fn();
  const updateOneMock = vi.fn();
  const collectionMock = {
    findOne: findOneMock,
    updateOne: updateOneMock,
  };

  return {
    findOneMock,
    updateOneMock,
    collectionMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => mocks.collectionMock,
  }),
}));

import { getUserPreferences, upsertUserPreferences } from "./userPreferences.service.js";

describe("userPreferences.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getUserPreferences normalizes email", async () => {
    const doc = { email: "x@example.com", workspaceId: "ws1", selectedProjectIds: ["p1"], updatedAt: new Date() };
    mocks.findOneMock.mockResolvedValueOnce(doc);

    const result = await getUserPreferences("  X@Example.Com ");

    expect(mocks.findOneMock).toHaveBeenCalledWith({ email: "x@example.com" });
    expect(result).toBe(doc);
  });

  it("upsertUserPreferences updates and returns stored doc", async () => {
    const doc = { email: "x@example.com", workspaceId: "ws2", selectedProjectIds: ["p2"], updatedAt: new Date() };
    mocks.updateOneMock.mockResolvedValueOnce({ acknowledged: true });
    mocks.findOneMock.mockResolvedValueOnce(doc);

    const result = await upsertUserPreferences("  X@Example.Com ", "ws2", ["p2"]);

    expect(mocks.updateOneMock).toHaveBeenCalledOnce();
    expect(mocks.updateOneMock).toHaveBeenCalledWith(
      { email: "x@example.com" },
      expect.objectContaining({
        $set: expect.objectContaining({
          email: "x@example.com",
          workspaceId: "ws2",
          selectedProjectIds: ["p2"],
          updatedAt: expect.any(Date),
        }),
      }),
      { upsert: true }
    );
    expect(result).toBe(doc);
  });

  it("throws if post-upsert document is not readable", async () => {
    mocks.updateOneMock.mockResolvedValueOnce({ acknowledged: true });
    mocks.findOneMock.mockResolvedValueOnce(null);

    await expect(upsertUserPreferences("x@example.com", "ws1", ["p1"])).rejects.toThrow(
      "Unable to load user preferences after upsert"
    );
  });
});
