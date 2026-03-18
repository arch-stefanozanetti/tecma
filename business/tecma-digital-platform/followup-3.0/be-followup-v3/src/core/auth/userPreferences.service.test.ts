import { beforeEach, describe, expect, it, vi } from "vitest";

const findOneMock = vi.fn();
const updateOneMock = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      findOne: findOneMock,
      updateOne: updateOneMock,
    }),
  }),
}));

import { getUserPreferences, upsertUserPreferences } from "./userPreferences.service.js";

describe("userPreferences.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads normalized user preferences", async () => {
    findOneMock.mockResolvedValueOnce({ email: "x@example.com", workspaceId: "ws1", selectedProjectIds: ["p1"] });

    const result = await getUserPreferences(" X@Example.com ");

    expect(findOneMock).toHaveBeenCalledWith({ email: "x@example.com" });
    expect(result?.workspaceId).toBe("ws1");
  });

  it("upserts and reloads preferences", async () => {
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });
    findOneMock.mockResolvedValueOnce({ email: "x@example.com", workspaceId: "ws1", selectedProjectIds: ["p1"] });

    const result = await upsertUserPreferences(" X@Example.com ", "ws1", ["p1"]);

    expect(updateOneMock).toHaveBeenCalledTimes(1);
    expect(result.email).toBe("x@example.com");
  });

  it("throws when upsert reload misses document", async () => {
    updateOneMock.mockResolvedValueOnce({ acknowledged: true });
    findOneMock.mockResolvedValueOnce(null);

    await expect(upsertUserPreferences("x@example.com", "ws1", ["p1"])).rejects.toThrow(
      "Unable to load user preferences after upsert"
    );
  });
});
