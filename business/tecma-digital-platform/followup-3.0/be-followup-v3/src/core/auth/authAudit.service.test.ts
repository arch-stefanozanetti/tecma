import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const insertOneMock = vi.fn();
  const errorMock = vi.fn();
  const collectionMock = {
    insertOne: insertOneMock,
  };

  return {
    insertOneMock,
    errorMock,
    collectionMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => mocks.collectionMock,
  }),
}));

vi.mock("../../observability/logger.js", () => ({
  logger: {
    error: mocks.errorMock,
  },
}));

import { logAuthEvent } from "./authAudit.service.js";

describe("authAudit.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes auth event document", async () => {
    mocks.insertOneMock.mockResolvedValue({ acknowledged: true });

    await logAuthEvent("login_success", {
      userId: "u1",
      email: "u@example.com",
      ipAddress: "127.0.0.1",
      userAgent: "Vitest",
      success: true,
    });

    expect(mocks.insertOneMock).toHaveBeenCalledOnce();
    expect(mocks.insertOneMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        eventType: "login_success",
        userId: "u1",
        email: "u@example.com",
        ipAddress: "127.0.0.1",
        userAgent: "Vitest",
        success: true,
      })
    );
    expect(mocks.errorMock).not.toHaveBeenCalled();
  });

  it("swallows db errors and logs", async () => {
    const boom = new Error("db down");
    mocks.insertOneMock.mockRejectedValueOnce(boom);

    await expect(logAuthEvent("login_failed", { email: "u@example.com" })).resolves.toBeUndefined();

    expect(mocks.errorMock).toHaveBeenCalledWith(
      expect.objectContaining({ err: boom, eventType: "login_failed" }),
      "[authAudit] failed to write auth event"
    );
  });
});
