import crypto from "node:crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { getReportSnapshotByToken } from "./realtime-reports.service.js";

const hashToken = (raw: string): string =>
  crypto.createHash("sha256").update(raw, "utf8").digest("hex");

const findOneMock = vi.fn();
const recordSecurityEventMock = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_report_snapshots") return { findOne: findOneMock };
      return { findOne: vi.fn() };
    },
  }),
}));

vi.mock("../compliance/security-audit.service.js", () => ({
  recordSecurityEvent: (...args: unknown[]) => recordSecurityEventMock(...args),
}));

describe("getReportSnapshotByToken", () => {
  beforeEach(() => {
    findOneMock.mockReset();
    recordSecurityEventMock.mockReset();
  });

  it("returns found false when no snapshot matches", async () => {
    findOneMock.mockResolvedValueOnce(null);
    const r = await getReportSnapshotByToken("missing");
    expect(r.data).toEqual({ found: false });
    expect(recordSecurityEventMock).not.toHaveBeenCalled();
  });

  it("returns payload and records security audit on successful read", async () => {
    const oid = new ObjectId();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    findOneMock.mockResolvedValueOnce({
      _id: oid,
      workspaceId: "ws-a",
      projectIds: ["p1"],
      query: "kpi",
      response: { x: 1 },
      createdAt: "2026-01-01T00:00:00.000Z",
      expiresAt: future,
    });
    const r = await getReportSnapshotByToken("good-tok", { ip: "1.2.3.4", userAgent: "TestUA/1" });
    expect(findOneMock).toHaveBeenCalledWith({
      tokenHash: hashToken("good-tok"),
      expiresAt: { $gt: expect.any(String) },
      revokedAt: null,
    });
    expect(r.data).toMatchObject({
      found: true,
      workspaceId: "ws-a",
      projectIds: ["p1"],
      query: "kpi",
      response: { x: 1 },
    });
    expect(recordSecurityEventMock).toHaveBeenCalledWith({
      action: "security.report_snapshot.accessed",
      entityType: "report_snapshot",
      entityId: oid.toHexString(),
      workspaceId: "ws-a",
      ip: "1.2.3.4",
      userAgent: "TestUA/1",
    });
  });
});
