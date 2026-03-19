import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/env.js", () => ({
  ENV: {
    PLATFORM_API_KEYS: JSON.stringify({
      "test-key-1": {
        workspaceId: "ws1",
        projectIds: ["p1", "p2"],
        label: "partner-site",
        scopes: ["platform.capabilities.read"],
        quotaPerDay: 2,
      },
    }),
  },
}));

const mocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
}));

vi.mock("../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({ findOneAndUpdate: mocks.findOneAndUpdate }),
  }),
}));

import type { Request, Response } from "express";
import { enforcePlatformQuota, platformApiKeyMiddleware, requirePlatformScope } from "./platformApiKeyMiddleware.js";

describe("platformApiKeyMiddleware", () => {
  const makeRes = () => {
    const status = vi.fn().mockReturnThis();
    const json = vi.fn().mockReturnThis();
    return { status, json } as unknown as Response;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findOneAndUpdate.mockResolvedValue({ count: 1 });
  });

  it("rejects missing api key", () => {
    const req = {
      get: vi.fn().mockReturnValue(undefined),
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    platformApiKeyMiddleware(req, res, next);
    expect((res.status as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("accepts valid api key and populates req.platformAccess", () => {
    const req = {
      get: vi.fn().mockImplementation((name: string) => (name.toLowerCase() === "x-api-key" ? "test-key-1" : undefined)),
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();

    platformApiKeyMiddleware(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.platformAccess).toEqual(
      expect.objectContaining({ workspaceId: "ws1", projectIds: ["p1", "p2"], label: "partner-site" })
    );
  });

  it("denies missing scope", () => {
    const req = {
      platformAccess: {
        apiKey: "test-key-1",
        workspaceId: "ws1",
        projectIds: ["p1"],
        label: "partner-site",
        scopes: ["platform.capabilities.read"],
        quotaPerDay: 2,
      },
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();
    requirePlatformScope("platform.reports.read")(req, res, next);
    expect((res.status as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(403);
  });

  it("blocks request when daily quota exceeded", async () => {
    mocks.findOneAndUpdate.mockResolvedValueOnce({ count: 3 });
    const req = {
      platformAccess: {
        apiKey: "test-key-1",
        workspaceId: "ws1",
        projectIds: ["p1"],
        label: "partner-site",
        scopes: ["platform.capabilities.read"],
        quotaPerDay: 2,
      },
    } as unknown as Request;
    const res = makeRes();
    const next = vi.fn();
    await enforcePlatformQuota(req, res, next);
    expect((res.status as unknown as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(429);
    expect(next).not.toHaveBeenCalled();
  });
});
