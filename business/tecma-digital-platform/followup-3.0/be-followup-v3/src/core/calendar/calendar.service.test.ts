import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "../../types/http.js";
import { ObjectId } from "mongodb";

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

  const calendarEventsCollection = {
    find: findMock,
    findOne: findOneMock,
    insertOne: insertOneMock,
    updateOne: updateOneMock,
    deleteOne: deleteOneMock,
    countDocuments: countDocumentsMock,
  };

  const dispatchEventMock = vi.fn(() => Promise.resolve());

  return {
    findOneMock,
    insertOneMock,
    updateOneMock,
    deleteOneMock,
    countDocumentsMock,
    toArrayMock,
    findMock,
    calendarEventsCollection,
    dispatchEventMock,
  };
});

vi.mock("../../config/db.js", () => ({
  getDb: () => ({
    collection: (name: string) => {
      if (name === "calendar_events") return mocks.calendarEventsCollection;
      throw new Error("Unexpected collection: " + name);
    },
  }),
}));

vi.mock("../automations/automation-events.service.js", () => ({
  dispatchEvent: mocks.dispatchEventMock,
}));

import {
  createCalendarEvent,
  deleteCalendarEvent,
  queryCalendarEvents,
  updateCalendarEvent,
} from "./calendar.service.js";

describe("calendar.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queryCalendarEvents uses primary collection when data exists", async () => {
    const now = new Date().toISOString();
    mocks.toArrayMock.mockResolvedValueOnce([
      {
        _id: "e1",
        workspaceId: "ws1",
        projectId: "p1",
        title: "Visita",
        startsAt: now,
        endsAt: now,
        source: "CUSTOM_SERVICE",
      },
    ]);
    mocks.countDocumentsMock.mockResolvedValueOnce(1);

    const result = await queryCalendarEvents({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 20,
      filters: { dateFrom: now, clientId: "c1" },
      searchText: "visit",
    });

    expect(result.data).toHaveLength(1);
    expect(result.pagination.total).toBe(1);
    expect(mocks.findMock).toHaveBeenCalled();
  });

  it("queryCalendarEvents returns empty result when primary has no rows", async () => {
    const now = new Date().toISOString();
    mocks.toArrayMock.mockResolvedValueOnce([]);
    mocks.countDocumentsMock.mockResolvedValueOnce(0);

    const result = await queryCalendarEvents({
      workspaceId: "ws1",
      projectIds: ["p1"],
      page: 1,
      perPage: 20,
      filters: { dateFrom: now },
      searchText: "attivita",
    });

    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });

  it("createCalendarEvent dispatches visit.scheduled when clientId exists", async () => {
    const insertedId = new ObjectId();
    mocks.insertOneMock.mockResolvedValueOnce({ insertedId });

    const result = await createCalendarEvent({
      workspaceId: "ws1",
      projectId: "p1",
      title: "  Visita App  ",
      startsAt: "2026-01-01T10:00:00.000Z",
      endsAt: "2026-01-01T11:00:00.000Z",
      source: "FOLLOWUP_SELL",
      clientId: "c1",
      apartmentId: "a1",
    });

    expect(result.event._id).toBe(insertedId.toHexString());
    expect(result.event.title).toBe("Visita App");
    expect(mocks.dispatchEventMock).toHaveBeenCalledWith(
      "ws1",
      "visit.scheduled",
      expect.objectContaining({ clientId: "c1", apartmentId: "a1" })
    );
  });

  it("updateCalendarEvent validates id and returns 404 when missing", async () => {
    await expect(updateCalendarEvent("bad-id", { title: "x" })).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<HttpError>);

    mocks.findOneMock.mockResolvedValueOnce(null);
    await expect(updateCalendarEvent(new ObjectId().toHexString(), { title: "x" })).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<HttpError>);
  });

  it("updateCalendarEvent updates fields and dispatches visit.updated", async () => {
    const id = new ObjectId();
    const existing = {
      _id: id,
      workspaceId: "ws1",
      projectId: "p1",
      title: "Old",
      startsAt: "2026-01-01T10:00:00.000Z",
      endsAt: "2026-01-01T11:00:00.000Z",
      source: "CUSTOM_SERVICE",
      clientId: "c1",
    };
    const updated = {
      ...existing,
      title: "New",
      apartmentId: "a1",
    };

    mocks.findOneMock.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);

    const result = await updateCalendarEvent(id.toHexString(), {
      title: " New ",
      apartmentId: "a1",
      source: "FOLLOWUP_SELL",
    });

    expect(mocks.updateOneMock).toHaveBeenCalledOnce();
    expect(result.event.title).toBe("New");
    expect(mocks.dispatchEventMock).toHaveBeenCalledWith(
      "ws1",
      "visit.updated",
      expect.objectContaining({ entityId: id.toHexString() })
    );
  });

  it("deleteCalendarEvent handles invalid id, not found and success", async () => {
    await expect(deleteCalendarEvent("x")).rejects.toMatchObject({ statusCode: 404 } as Partial<HttpError>);

    mocks.deleteOneMock.mockResolvedValueOnce({ deletedCount: 0 });
    await expect(deleteCalendarEvent(new ObjectId().toHexString())).rejects.toMatchObject({
      statusCode: 404,
    } as Partial<HttpError>);

    mocks.deleteOneMock.mockResolvedValueOnce({ deletedCount: 1 });
    await expect(deleteCalendarEvent(new ObjectId().toHexString())).resolves.toEqual({ deleted: true });
  });
});
