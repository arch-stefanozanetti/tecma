import type { CalendarEvent } from "../../types/domain";

/**
 * Dopo un refetch, unisce i dati dall'API con l'evento aggiunto ottimisticamente
 * se l'API non lo restituisce ancora (es. eventual consistency).
 * Ordine: più recenti per startsAt prima.
 */
export function mergeCalendarEventsAfterRefetch(
  fromApi: CalendarEvent[],
  prev: CalendarEvent[],
  optimisticEventId: string | null
): CalendarEvent[] {
  if (!optimisticEventId) return fromApi;
  if (fromApi.some((e) => e._id === optimisticEventId)) return fromApi;
  const kept = prev.find((e) => e._id === optimisticEventId);
  if (!kept) return fromApi;
  const merged = [kept, ...fromApi];
  merged.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  return merged;
}
