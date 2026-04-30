import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";

const insertOneMock = vi.fn();
const getReportDefinitionByIdMock = vi.fn();
const runReportMock = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      insertOne: (...args: unknown[]) => insertOneMock(...args),
    }),
  }),
}));

vi.mock("../compliance/security-audit.service.js", () => ({
  recordSecurityEvent: vi.fn(),
}));

vi.mock("./report-definitions.service.js", () => ({
  getReportDefinitionById: (...args: unknown[]) => getReportDefinitionByIdMock(...args),
}));

vi.mock("./reports.service.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reports.service.js")>();
  return {
    ...actual,
    runReport: (...args: unknown[]) => runReportMock(...args),
  };
});

describe("createReportDefinitionSnapshot", () => {
  beforeEach(() => {
    insertOneMock.mockReset();
    getReportDefinitionByIdMock.mockReset();
    runReportMock.mockReset();
  });

  it("creates token and stores snapshot with definition payload", async () => {
    const defId = new ObjectId().toHexString();
    getReportDefinitionByIdMock.mockResolvedValue({
      _id: defId,
      workspaceId: "ws1",
      name: "Preferito test",
      reportType: "pipeline",
      projectIds: ["p1"],
      dateFrom: null,
      dateTo: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "u1",
    });
    runReportMock.mockResolvedValue({
      data: [{ status: "new", type: "sale", projectId: "p1", count: 2 }],
    });
    const oid = new ObjectId();
    insertOneMock.mockResolvedValue({ insertedId: oid });

    const { createReportDefinitionSnapshot } = await import("./realtime-reports.service.js");
    const out = await createReportDefinitionSnapshot({ workspaceId: "ws1", reportDefinitionId: defId });

    expect(out.data.token).toBeDefined();
    expect(out.data.url).toBe(`/v1/public/reports/${out.data.token}`);
    expect(out.data.snapshotId).toBe(oid.toHexString());
    expect(runReportMock).toHaveBeenCalledWith(
      "pipeline",
      expect.objectContaining({ workspaceId: "ws1", projectIds: ["p1"] })
    );
    expect(insertOneMock).toHaveBeenCalled();
    const doc = insertOneMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(doc.snapshotKind).toBe("definition");
    expect(doc.reportDefinitionId).toBe(defId);
    expect((doc.response as Record<string, unknown>).kind).toBe("definition");
  });

  it("throws when definition is missing", async () => {
    getReportDefinitionByIdMock.mockResolvedValue(null);
    const { createReportDefinitionSnapshot } = await import("./realtime-reports.service.js");
    await expect(createReportDefinitionSnapshot({ workspaceId: "ws1", reportDefinitionId: "bad" })).rejects.toThrow();
  });
});
