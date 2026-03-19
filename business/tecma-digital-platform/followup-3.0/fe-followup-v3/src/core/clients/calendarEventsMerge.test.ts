import { describe, it, expect } from "vitest";
import { mergeCalendarEventsAfterRefetch } from "./calendarEventsMerge";
import type { CalendarEvent } from "../../types/domain";

const ev = (id: string, startsAt: string): CalendarEvent => ({
  _id: id,
  projectId: "p1",
  title: "E",
  startsAt,
  endsAt: new Date(Date.parse(startsAt) + 3600000).toISOString(),
  source: "CUSTOM_SERVICE",
});

describe("mergeCalendarEventsAfterRefetch", () => {
  it("restituisce fromApi se non c'è evento ottimistico", () => {
    const fromApi = [ev("a", "2025-06-01T10:00:00Z")];
    const prev = [ev("b", "2025-06-02T10:00:00Z")];
    expect(mergeCalendarEventsAfterRefetch(fromApi, prev, null)).toEqual(fromApi);
  });

  it("restituisce fromApi se l'evento ottimistico è già in fromApi", () => {
    const fromApi = [ev("new", "2025-06-01T10:00:00Z"), ev("old", "2025-05-01T10:00:00Z")];
    const prev = [ev("new", "2025-06-01T10:00:00Z")];
    expect(mergeCalendarEventsAfterRefetch(fromApi, prev, "new")).toEqual(fromApi);
  });

  it("mantiene l'evento ottimistico in testa se l'API non lo restituisce", () => {
    const fromApi = [ev("old", "2025-05-01T10:00:00Z")];
    const optimistic = ev("new", "2025-06-15T14:00:00Z");
    const prev = [optimistic, ev("old", "2025-05-01T10:00:00Z")];
    const result = mergeCalendarEventsAfterRefetch(fromApi, prev, "new");
    expect(result).toHaveLength(2);
    expect(result[0]._id).toBe("new");
    expect(result[0].title).toBe("E");
    expect(result[1]._id).toBe("old");
  });

  it("ordina per startsAt desc dopo il merge", () => {
    const fromApi = [ev("a", "2025-06-01T10:00:00Z")];
    const optimistic = ev("new", "2025-07-01T10:00:00Z");
    const prev = [optimistic];
    const result = mergeCalendarEventsAfterRefetch(fromApi, prev, "new");
    expect(result[0]._id).toBe("new");
    expect(result[1]._id).toBe("a");
  });

  it("restituisce fromApi se l'id ottimistico non è in prev", () => {
    const fromApi = [ev("a", "2025-06-01T10:00:00Z")];
    const prev = [ev("other", "2025-05-01T10:00:00Z")];
    expect(mergeCalendarEventsAfterRefetch(fromApi, prev, "missing")).toEqual(fromApi);
  });
});
