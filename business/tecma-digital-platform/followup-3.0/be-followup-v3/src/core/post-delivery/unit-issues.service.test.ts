import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { HttpError } from "../../types/http.js";

const mocks = vi.hoisted(() => {
  const findOneMock = vi.fn();
  const insertOneMock = vi.fn();
  const updateOneMock = vi.fn();
  const deleteOneMock = vi.fn();
  const countDocumentsMock = vi.fn();
  const toArrayMock = vi.fn();
  const projectMock = vi.fn(() => ({ toArray: toArrayMock }));
  const limitMock = vi.fn(() => ({ project: projectMock, toArray: toArrayMock }));
  const skipMock = vi.fn(() => ({ limit: limitMock, project: projectMock, toArray: toArrayMock }));
  const sortMock = vi.fn(() => ({ skip: skipMock, limit: limitMock, project: projectMock, toArray: toArrayMock }));
  const findMock = vi.fn(() => ({ sort: sortMock, skip: skipMock, limit: limitMock, project: projectMock, toArray: toArrayMock }));

  const issuesColl = {
    find: findMock,
    findOne: findOneMock,
    insertOne: insertOneMock,
    updateOne: updateOneMock,
    deleteOne: deleteOneMock,
    countDocuments: countDocumentsMock,
  };
  const apartmentsColl = { findOne: vi.fn() };

  return {
    findOneMock,
    insertOneMock,
    updateOneMock,
    deleteOneMock,
    countDocumentsMock,
    toArrayMock,
    findMock,
    issuesColl,
    apartmentsColl,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_unit_issues") return mocks.issuesColl;
      if (name === "tz_apartments") return mocks.apartmentsColl;
      throw new Error(`Unexpected collection: ${name}`);
    },
  }),
}));

import {
  createUnitIssue,
  deleteUnitIssue,
  getUnitIssueById,
  patchUnitIssue,
  queryUnitIssues,
} from "./unit-issues.service.js";

describe("unit-issues.service", () => {
  const aptId = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apartmentsColl.findOne.mockResolvedValue({ _id: aptId, workspaceId: "ws1", projectId: "p1" });
  });

  it("queryUnitIssues returns paginated data", async () => {
    const now = new Date().toISOString();
    mocks.toArrayMock.mockResolvedValueOnce([
      {
        _id: new ObjectId(),
        workspaceId: "ws1",
        projectId: "p1",
        apartmentId: aptId.toHexString(),
        title: "Infiltrazione",
        description: "Soffitto",
        status: "open",
        priority: "high",
        photoUrls: [],
        createdAt: now,
        updatedAt: now,
      },
    ]);
    mocks.countDocumentsMock.mockResolvedValueOnce(1);

    const r = await queryUnitIssues({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 25,
    });
    expect(r.data).toHaveLength(1);
    expect(r.data[0].title).toBe("Infiltrazione");
    expect(r.pagination.total).toBe(1);
  });

  it("createUnitIssue inserts when apartment exists", async () => {
    mocks.insertOneMock.mockResolvedValueOnce({ acknowledged: true });
    const r = await createUnitIssue(
      {
        workspaceId: "ws1",
        projectId: "p1",
        apartmentId: aptId.toHexString(),
        title: "Difetto",
        description: "Test",
      },
      { userId: "u1" }
    );
    expect(r.issue.title).toBe("Difetto");
    expect(mocks.insertOneMock).toHaveBeenCalled();
  });

  it("createUnitIssue throws when apartment missing", async () => {
    mocks.apartmentsColl.findOne.mockResolvedValueOnce(null);
    await expect(
      createUnitIssue(
        {
          workspaceId: "ws1",
          projectId: "p1",
          apartmentId: aptId.toHexString(),
          title: "X",
        },
        {}
      )
    ).rejects.toThrow(HttpError);
  });

  it("patchUnitIssue updates fields", async () => {
    const id = new ObjectId();
    mocks.findOneMock
      .mockResolvedValueOnce({
        _id: id,
        workspaceId: "ws1",
        projectId: "p1",
        apartmentId: aptId.toHexString(),
        title: "T",
        description: "",
        status: "open",
        priority: "low",
        photoUrls: [],
        createdAt: "a",
        updatedAt: "a",
      })
      .mockResolvedValueOnce({
        _id: id,
        workspaceId: "ws1",
        projectId: "p1",
        apartmentId: aptId.toHexString(),
        title: "T",
        description: "",
        status: "in_progress",
        priority: "low",
        photoUrls: [],
        createdAt: "a",
        updatedAt: "b",
      });
    mocks.updateOneMock.mockResolvedValueOnce({ acknowledged: true });

    const r = await patchUnitIssue(id.toHexString(), {
      workspaceId: "ws1",
      projectId: "p1",
      status: "in_progress",
    });
    expect(r.issue.status).toBe("in_progress");
  });

  it("getUnitIssueById returns row", async () => {
    const id = new ObjectId();
    mocks.findOneMock.mockResolvedValueOnce({
      _id: id,
      workspaceId: "ws1",
      projectId: "p1",
      apartmentId: aptId.toHexString(),
      title: "T",
      description: "",
      status: "open",
      priority: "low",
      photoUrls: [],
      createdAt: "a",
      updatedAt: "a",
    });
    const r = await getUnitIssueById(id.toHexString(), "ws1");
    expect(r.issue._id).toBe(id.toHexString());
  });

  it("deleteUnitIssue removes document", async () => {
    const id = new ObjectId();
    mocks.deleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
    const r = await deleteUnitIssue(id.toHexString(), "ws1", "p1");
    expect(r.deleted).toBe(true);
  });
});
