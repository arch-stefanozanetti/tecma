import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { markRead } from "./notifications.service.js";

const mocks = vi.hoisted(() => {
  const findOneAndUpdateMock = vi.fn();
  return { findOneAndUpdateMock };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      findOneAndUpdate: mocks.findOneAndUpdateMock,
    }),
  }),
}));

vi.mock("../realtime/realtime-bus.service.js", () => ({
  publishRealtimeEvent: vi.fn(),
}));

describe("notifications.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("markRead applies workspace scope when provided", async () => {
    const id = new ObjectId();
    mocks.findOneAndUpdateMock.mockResolvedValueOnce({
      _id: id,
      workspaceId: "ws1",
      type: "other",
      title: "N",
      read: true,
      createdAt: new Date().toISOString(),
    });

    const out = await markRead(id.toHexString(), "ws1");
    expect(out?._id).toBe(id.toHexString());
    expect(mocks.findOneAndUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ _id: expect.any(ObjectId), workspaceId: "ws1" }),
      expect.any(Object),
      expect.any(Object)
    );
  });
});

