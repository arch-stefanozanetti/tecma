import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { HttpError } from "../../types/http.js";

const {
  dispatchEventMock,
  primaryFindMock,
  primaryFindToArrayMock,
  primaryCountDocumentsMock,
  primaryFindOneMock,
  primaryInsertOneMock,
  primaryUpdateOneMock,
  primaryDeleteOneMock,
  legacyFindMock,
  legacyFindToArrayMock,
  legacyCountDocumentsMock,
} = vi.hoisted(() => ({
  dispatchEventMock: vi.fn(),
  primaryFindMock: vi.fn(),
  primaryFindToArrayMock: vi.fn(),
  primaryCountDocumentsMock: vi.fn(),
  primaryFindOneMock: vi.fn(),
  primaryInsertOneMock: vi.fn(),
  primaryUpdateOneMock: vi.fn(),
  primaryDeleteOneMock: vi.fn(),
  legacyFindMock: vi.fn(),
  legacyFindToArrayMock: vi.fn(),
  legacyCountDocumentsMock: vi.fn(),
}));

const buildFindChain = (toArrayMock: ReturnType<typeof vi.fn>) => ({
  sort: vi.fn(() => ({
    skip: vi.fn(() => ({
      limit: vi.fn(() => ({
        project: vi.fn(() => ({ toArray: toArrayMock })),
        toArray: toArrayMock,
      })),
      project: vi.fn(() => ({ toArray: toArrayMock })),
      toArray: toArrayMock,
    })),
    project: vi.fn(() => ({ toArray: toArrayMock })),
    toArray: toArrayMock,
  })),
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "calendar_events") {
        return {
          find: primaryFindMock.mockImplementation(() => buildFindChain(primaryFindToArrayMock)),
          countDocuments: primaryCountDocumentsMock,
          findOne: primaryFindOneMock,
          insertOne: primaryInsertOneMock,
          updateOne: primaryUpdateOneMock,
          deleteOne: primaryDeleteOneMock,
        };
      }
      if (name === "calendars") {
        return {
          find: legacyFindMock.mockImplementation(() => buildFindChain(legacyFindToArrayMock)),
          countDocuments: legacyCountDocumentsMock,
        };
      }
      return {};
    },
  }),
}));

vi.mock("../automations/automation-events.service.js", () => ({
  dispatchEvent: dispatchEventMock,
}));

import { createCalendarEvent, deleteCalendarEvent, queryCalendarEvents, updateCalendarEvent } from "./calendar.service.js";

describe("calendar.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queryCalendarEvents returns primary dataset when found", async () => {
    primaryFindToArrayMock.mockResolvedValueOnce([
      {
        _id: "ev1",
        workspaceId: "ws1",
        projectId: "p1",
        title: "Primary event",
        startsAt: new Date().toISOString(),
        endsAt: new Date().toISOString(),
        source: "CUSTOM_SERVICE",
      },
    ]);
    primaryCountDocumentsMock.mockResolvedValueOnce(1);

    const result = await queryCalendarEvents({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 25,
      filters: {},
    });

    expect(result.pagination.total).toBe(1);
    expect(result.data[0].title).toBe("Primary event");
  });

  it("queryCalendarEvents falls back to legacy collection when primary is empty", async () => {
    primaryFindToArrayMock.mockResolvedValueOnce([]);
    primaryCountDocumentsMock.mockResolvedValueOnce(0);
    const legacyId = new ObjectId("64b64f3fd9024a2a53111111");
    legacyFindToArrayMock.mockResolvedValueOnce([
      {
        _id: legacyId,
        project_id: "p1",
        startDate: "2026-03-01T10:00:00.000Z",
        endDate: "2026-03-01T11:00:00.000Z",
        typology: "Visita",
      },
    ]);
    legacyCountDocumentsMock.mockResolvedValueOnce(1);

    const result = await queryCalendarEvents({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 25,
      filters: {},
    });

    expect(result.pagination.total).toBe(1);
    expect(result.data[0].workspaceId).toBe("legacy");
    expect(result.data[0]._id).toBe(legacyId.toHexString());
  });

  it("queryCalendarEvents applies date/search/client filters on primary", async () => {
    primaryFindToArrayMock.mockResolvedValueOnce([]);
    primaryCountDocumentsMock.mockResolvedValueOnce(0);
    legacyFindToArrayMock.mockResolvedValueOnce([]);
    legacyCountDocumentsMock.mockResolvedValueOnce(0);

    await queryCalendarEvents({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 25,
      searchText: "visita",
      filters: {
        dateFrom: "2026-01-01T00:00:00.000Z",
        dateTo: "2026-12-31T23:59:59.999Z",
        clientId: "c1",
      },
    });

    expect(primaryFindMock).toHaveBeenCalledWith({
      $and: expect.arrayContaining([
        { workspaceId: "ws1", projectId: { $in: ["p1"] } },
        { clientId: "c1" },
      ]),
    });
  });

  it("createCalendarEvent dispatches automation when clientId exists", async () => {
    const insertedId = new ObjectId();
    primaryInsertOneMock.mockResolvedValueOnce({ insertedId });
    dispatchEventMock.mockResolvedValueOnce(undefined);

    const result = await createCalendarEvent({
      workspaceId: "ws1",
      projectId: "p1",
      title: "Nuova visita",
      startsAt: "2026-03-01T10:00:00.000Z",
      endsAt: "2026-03-01T11:00:00.000Z",
      source: "FOLLOWUP_SELL",
      clientId: "c1",
    });

    expect(result.event._id).toBe(insertedId.toHexString());
    expect(dispatchEventMock).toHaveBeenCalledWith(
      "ws1",
      "visit.scheduled",
      expect.objectContaining({ clientId: "c1", entityType: "calendar_event" })
    );
  });

  it("createCalendarEvent does not dispatch automation without clientId", async () => {
    primaryInsertOneMock.mockResolvedValueOnce({ insertedId: new ObjectId() });

    await createCalendarEvent({
      workspaceId: "ws1",
      projectId: "p1",
      title: "Generic",
      startsAt: "2026-03-01T10:00:00.000Z",
      endsAt: "2026-03-01T11:00:00.000Z",
      source: "CUSTOM_SERVICE",
    });

    expect(dispatchEventMock).not.toHaveBeenCalled();
  });

  it("updateCalendarEvent returns 404 on invalid id", async () => {
    await expect(updateCalendarEvent("bad-id", { title: "X" })).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<HttpError>);
  });

  it("updateCalendarEvent returns 404 when event does not exist", async () => {
    primaryFindOneMock.mockResolvedValueOnce(null);
    const id = new ObjectId().toHexString();
    await expect(updateCalendarEvent(id, { title: "X" })).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<HttpError>);
  });

  it("updateCalendarEvent returns existing event when payload has no effective changes", async () => {
    const id = new ObjectId();
    const existing = {
      _id: id,
      workspaceId: "ws1",
      projectId: "p1",
      title: "Existing",
      startsAt: "2026-03-01T10:00:00.000Z",
      endsAt: "2026-03-01T11:00:00.000Z",
      source: "CUSTOM_SERVICE",
    };
    primaryFindOneMock.mockResolvedValueOnce(existing);

    const result = await updateCalendarEvent(id.toHexString(), {});
    expect(result.event).toEqual(existing);
  });

  it("updateCalendarEvent updates and dispatches visit.updated when clientId present", async () => {
    const id = new ObjectId();
    primaryFindOneMock
      .mockResolvedValueOnce({
        _id: id,
        workspaceId: "ws1",
        projectId: "p1",
        title: "Old",
        startsAt: "2026-03-01T10:00:00.000Z",
        endsAt: "2026-03-01T11:00:00.000Z",
        source: "CUSTOM_SERVICE",
      })
      .mockResolvedValueOnce({
        _id: id,
        workspaceId: "ws1",
        projectId: "p1",
        title: "New title",
        startsAt: "2026-03-01T10:00:00.000Z",
        endsAt: "2026-03-01T11:00:00.000Z",
        source: "FOLLOWUP_SELL",
        clientId: "c1",
      });
    primaryUpdateOneMock.mockResolvedValueOnce({ matchedCount: 1, modifiedCount: 1 });
    dispatchEventMock.mockResolvedValueOnce(undefined);

    const result = await updateCalendarEvent(id.toHexString(), {
      title: "New title",
      source: "FOLLOWUP_SELL",
      clientId: "c1",
    });

    expect(result.event.title).toBe("New title");
    expect(primaryUpdateOneMock).toHaveBeenCalledTimes(1);
    expect(dispatchEventMock).toHaveBeenCalledWith(
      "ws1",
      "visit.updated",
      expect.objectContaining({ entityId: id.toHexString(), clientId: "c1" })
    );
  });

  it("deleteCalendarEvent returns deleted=true when row exists", async () => {
    primaryDeleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
    const id = new ObjectId().toHexString();

    const result = await deleteCalendarEvent(id);

    expect(result.deleted).toBe(true);
  });

  it("deleteCalendarEvent returns 404 on invalid/missing events", async () => {
    await expect(deleteCalendarEvent("bad-id")).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);
    primaryDeleteOneMock.mockResolvedValueOnce({ deletedCount: 0 });
    await expect(deleteCalendarEvent(new ObjectId().toHexString())).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);
  });
});
