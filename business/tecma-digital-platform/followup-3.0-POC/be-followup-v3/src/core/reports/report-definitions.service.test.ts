import { describe, expect, it, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import {
  createReportDefinition,
  deleteReportDefinition,
  listReportDefinitions,
  updateReportDefinition,
} from "./report-definitions.service.js";

const insertOneMock = vi.fn();
const findOneMock = vi.fn();
const findMock = vi.fn();
const updateOneMock = vi.fn();
const deleteOneMock = vi.fn();

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: () => ({
      insertOne: insertOneMock,
      findOne: findOneMock,
      find: findMock,
      updateOne: updateOneMock,
      deleteOne: deleteOneMock,
    }),
  }),
}));

describe("report-definitions.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listReportDefinitions returns mapped rows", async () => {
    const oid = new ObjectId();
    findMock.mockReturnValue({
      sort: () => ({ limit: () => ({ toArray: () => Promise.resolve([{ _id: oid, workspaceId: "ws", name: "A", reportType: "pipeline", projectIds: ["p1"], createdAt: "t", updatedAt: "t", createdBy: null }]) }) }),
    });
    const r = await listReportDefinitions("ws");
    expect(r.data).toHaveLength(1);
    expect(r.data[0]?._id).toBe(oid.toHexString());
    expect(r.data[0]?.name).toBe("A");
  });

  it("createReportDefinition inserts and returns row", async () => {
    const oid = new ObjectId();
    insertOneMock.mockResolvedValue({ insertedId: oid });
    findOneMock.mockResolvedValue({
      _id: oid,
      workspaceId: "ws",
      name: "Mio",
      reportType: "kpi_summary",
      projectIds: ["p1"],
      dateFrom: null,
      dateTo: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      createdBy: "u1",
    });
    const r = await createReportDefinition(
      {
        workspaceId: "ws",
        name: "Mio",
        reportType: "kpi_summary",
        projectIds: ["p1"],
      },
      { userId: "u1" }
    );
    expect(r.data.reportType).toBe("kpi_summary");
    expect(insertOneMock).toHaveBeenCalled();
  });

  it("deleteReportDefinition removes by workspace", async () => {
    const oid = new ObjectId();
    deleteOneMock.mockResolvedValue({ deletedCount: 1 });
    const r = await deleteReportDefinition(oid.toHexString(), "ws");
    expect(r.data.deleted).toBe(true);
    expect(deleteOneMock).toHaveBeenCalledWith({ _id: oid, workspaceId: "ws" });
  });

  it("updateReportDefinition patches fields", async () => {
    const oid = new ObjectId();
    findOneMock
      .mockResolvedValueOnce({
        _id: oid,
        workspaceId: "ws",
        name: "Old",
        reportType: "pipeline",
        projectIds: ["p1"],
        createdAt: "t",
        updatedAt: "t",
        createdBy: null,
      })
      .mockResolvedValueOnce({
        _id: oid,
        workspaceId: "ws",
        name: "New",
        reportType: "pipeline",
        projectIds: ["p1"],
        createdAt: "t",
        updatedAt: "t2",
        createdBy: null,
      });
    updateOneMock.mockResolvedValue({ modifiedCount: 1 });
    const r = await updateReportDefinition(
      oid.toHexString(),
      { workspaceId: "ws", name: "New" },
      {}
    );
    expect(r.data.name).toBe("New");
  });
});
