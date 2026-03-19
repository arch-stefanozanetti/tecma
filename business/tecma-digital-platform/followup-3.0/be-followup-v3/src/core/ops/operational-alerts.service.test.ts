import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { acknowledgeOperationalAlert } from "./operational-alerts.service.js";

const mocks = vi.hoisted(() => {
  const updateOneMock = vi.fn();
  return { updateOneMock };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      updateOne: mocks.updateOneMock,
    }),
  }),
}));

describe("operational-alerts.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acknowledgeOperationalAlert applies workspace scope when provided", async () => {
    const id = new ObjectId().toHexString();
    await acknowledgeOperationalAlert(id, "ws1");
    expect(mocks.updateOneMock).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.any(ObjectId), workspaceId: "ws1" }),
      expect.any(Object)
    );
  });
});

