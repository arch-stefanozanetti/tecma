import { beforeEach, describe, expect, it, vi } from "vitest";
import { ObjectId } from "mongodb";
import { HttpError } from "../../types/http.js";

const {
  dispatchEventMock,
  primaryFindToArrayMock,
  primaryCountDocumentsMock,
  primaryFindOneMock,
  primaryInsertOneMock,
  primaryUpdateOneMock,
  primaryDeleteOneMock,
  legacyFindToArrayMock,
  legacyCountDocumentsMock,
} = vi.hoisted(() => ({
  dispatchEventMock: vi.fn(),
  primaryFindToArrayMock: vi.fn(),
  primaryCountDocumentsMock: vi.fn(),
  primaryFindOneMock: vi.fn(),
  primaryInsertOneMock: vi.fn(),
  primaryUpdateOneMock: vi.fn(),
  primaryDeleteOneMock: vi.fn(),
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
          find: vi.fn(() => buildFindChain(primaryFindToArrayMock)),
          countDocuments: primaryCountDocumentsMock,
          findOne: primaryFindOneMock,
          insertOne: primaryInsertOneMock,
          updateOne: primaryUpdateOneMock,
          deleteOne: primaryDeleteOneMock,
        };
      }
      if (name === "calendars") {
        return {
          find: vi.fn(() => buildFindChain(legacyFindToArrayMock)),
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

  it("updateCalendarEvent returns 404 on invalid id", async () => {
    await expect(updateCalendarEvent("bad-id", { title: "X" })).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<HttpError>);
  });

  it("deleteCalendarEvent returns deleted=true when row exists", async () => {
    primaryDeleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
    const id = new ObjectId().toHexString();

    const result = await deleteCalendarEvent(id);

    expect(result.deleted).toBe(true);
  });
});
