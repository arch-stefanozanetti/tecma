import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";

const mocks = vi.hoisted(() => {
  const findOneMock = vi.fn();
  const insertOneMock = vi.fn();
  const updateOneMock = vi.fn();
  const countDocumentsMock = vi.fn();
  const toArrayMock = vi.fn();
  const limitMock = vi.fn(() => ({ toArray: toArrayMock }));
  const skipMock = vi.fn(() => ({ limit: limitMock, toArray: toArrayMock }));
  const sortMock = vi.fn(() => ({ skip: skipMock, limit: limitMock, toArray: toArrayMock }));
  const findMock = vi.fn(() => ({ sort: sortMock, skip: skipMock, limit: limitMock, toArray: toArrayMock }));

  const handoversColl = {
    find: findMock,
    findOne: findOneMock,
    insertOne: insertOneMock,
    updateOne: updateOneMock,
    countDocuments: countDocumentsMock,
  };
  const apartmentsColl = { findOne: vi.fn() };

  return { findOneMock, insertOneMock, updateOneMock, countDocumentsMock, toArrayMock, handoversColl, apartmentsColl };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "tz_handovers") return mocks.handoversColl;
      if (name === "tz_apartments") return mocks.apartmentsColl;
      throw new Error(`Unexpected collection: ${name}`);
    },
  }),
}));

import { getOrCreateHandover, getHandoverForApartment, patchHandover, queryHandovers } from "./handovers.service.js";
import { HANDOVER_CHECKLIST_TEMPLATE } from "./handover-checklist-template.js";

describe("handovers.service", () => {
  const aptId = new ObjectId();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apartmentsColl.findOne.mockResolvedValue({ _id: aptId, workspaceId: "ws1", projectId: "p1" });
  });

  it("getOrCreateHandover inserts when absent", async () => {
    mocks.findOneMock.mockResolvedValueOnce(null);
    mocks.insertOneMock.mockResolvedValueOnce({ acknowledged: true });

    const r = await getOrCreateHandover(
      { workspaceId: "ws1", projectId: "p1", apartmentId: aptId.toHexString() },
      { userId: "u1" }
    );
    expect(r.created).toBe(true);
    expect(r.handover.checklist.length).toBe(HANDOVER_CHECKLIST_TEMPLATE.length);
    expect(r.handover.sessionStatus).toBe("not_started");
  });

  it("getOrCreateHandover returns existing", async () => {
    const id = new ObjectId();
    const now = new Date().toISOString();
    mocks.findOneMock.mockResolvedValueOnce({
      _id: id,
      workspaceId: "ws1",
      projectId: "p1",
      apartmentId: aptId.toHexString(),
      sessionStatus: "in_progress",
      checklist: [],
      createdAt: now,
      updatedAt: now,
    });

    const r = await getOrCreateHandover(
      { workspaceId: "ws1", projectId: "p1", apartmentId: aptId.toHexString() },
      {}
    );
    expect(r.created).toBe(false);
    expect(mocks.insertOneMock).not.toHaveBeenCalled();
  });

  it("getHandoverForApartment returns null when missing", async () => {
    mocks.findOneMock.mockResolvedValueOnce(null);
    const r = await getHandoverForApartment("ws1", "p1", aptId.toHexString());
    expect(r.handover).toBeNull();
  });

  it("queryHandovers paginates", async () => {
    mocks.countDocumentsMock.mockResolvedValueOnce(0);
    mocks.toArrayMock.mockResolvedValueOnce([]);
    const r = await queryHandovers({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 10,
    });
    expect(r.data).toEqual([]);
    expect(r.pagination.total).toBe(0);
  });

  it("patchHandover updates checklist item", async () => {
    const id = new ObjectId();
    const templateRow = {
      id: "impianti",
      label: "Impianti",
      required: true,
      photoUrls: [] as string[],
    };
    mocks.findOneMock
      .mockResolvedValueOnce({
        _id: id,
        workspaceId: "ws1",
        projectId: "p1",
        apartmentId: aptId.toHexString(),
        sessionStatus: "in_progress",
        checklist: [templateRow],
        createdAt: "a",
        updatedAt: "a",
      })
      .mockResolvedValueOnce({
        _id: id,
        workspaceId: "ws1",
        projectId: "p1",
        apartmentId: aptId.toHexString(),
        sessionStatus: "in_progress",
        checklist: [{ ...templateRow, doneAt: "x" }],
        createdAt: "a",
        updatedAt: "b",
      });
    mocks.updateOneMock.mockResolvedValueOnce({ acknowledged: true });

    const r = await patchHandover(id.toHexString(), {
      workspaceId: "ws1",
      projectId: "p1",
      checklist: [{ itemId: "impianti", done: true }],
    });
    expect(r.handover.checklist[0].doneAt).toBeDefined();
  });
});
