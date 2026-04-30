import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requireWorkspaceEntitled, requireWorkspaceEntitledIfWorkspaceId, workspaceIdFromBodyOrQuery } from "./workspaceEntitlementMiddleware.js";

const isWorkspaceEntitledToFeature = vi.hoisted(() => vi.fn());

vi.mock("../core/workspaces/workspace-entitlements.service.js", () => ({
  isWorkspaceEntitledToFeature,
}));

describe("workspaceEntitlementMiddleware", () => {
  beforeEach(() => {
    isWorkspaceEntitledToFeature.mockReset();
  });

  it("requireWorkspaceEntitled: 403 quando reports non entitled", async () => {
    isWorkspaceEntitledToFeature.mockResolvedValue(false);
    const mw = requireWorkspaceEntitled("reports", workspaceIdFromBodyOrQuery);
    const req = { body: { workspaceId: "ws1", projectIds: ["p1"] } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;
    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.stringContaining("non abilitata") as string,
        code: "FEATURE_NOT_ENTITLED",
      })
    );
    expect(isWorkspaceEntitledToFeature).toHaveBeenCalledWith("ws1", "reports");
  });

  it("requireWorkspaceEntitled: next quando integrations entitled", async () => {
    isWorkspaceEntitledToFeature.mockResolvedValue(true);
    const mw = requireWorkspaceEntitled("integrations", (r) => r.params.workspaceId);
    const req = { params: { workspaceId: "ws2" } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(isWorkspaceEntitledToFeature).toHaveBeenCalledWith("ws2", "integrations");
  });

  it("requireWorkspaceEntitled: 400 se workspaceId assente", async () => {
    isWorkspaceEntitledToFeature.mockResolvedValue(true);
    const mw = requireWorkspaceEntitled("reports", () => undefined);
    const req = { body: {} } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;
    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(isWorkspaceEntitledToFeature).not.toHaveBeenCalled();
  });

  it("requireWorkspaceEntitledIfWorkspaceId: next senza workspace in query", async () => {
    isWorkspaceEntitledToFeature.mockResolvedValue(true);
    const mw = requireWorkspaceEntitledIfWorkspaceId("integrations", (r) =>
      typeof r.query.workspaceId === "string" ? r.query.workspaceId : undefined
    );
    const req = { query: {} } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn() as NextFunction;
    await mw(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(isWorkspaceEntitledToFeature).not.toHaveBeenCalled();
  });

  it("workspaceIdFromBodyOrQuery legge body poi query", () => {
    expect(
      workspaceIdFromBodyOrQuery({ body: { workspaceId: "a" }, query: {} } as unknown as Request)
    ).toBe("a");
    expect(
      workspaceIdFromBodyOrQuery({ body: {}, query: { workspaceId: "b" } } as unknown as Request)
    ).toBe("b");
  });
});
