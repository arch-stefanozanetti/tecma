import { describe, expect, it } from "vitest";
import { publishRealtimeEvent, subscribeRealtimeEvents } from "./realtime-bus.service.js";

describe("realtime-bus.service", () => {
  it("publishes events to subscribers", () => {
    const received: Array<{ eventType: string }> = [];
    const unsubscribe = subscribeRealtimeEvents((event) => {
      received.push({ eventType: event.eventType });
    });

    publishRealtimeEvent({
      eventType: "request.status_changed",
      entityId: "req1",
      workspaceId: "ws1",
      projectId: "p1",
      actorId: "u1",
      timestamp: new Date().toISOString(),
      payloadVersion: 1,
      payload: { status: "won" },
    });

    unsubscribe();
    expect(received).toEqual([{ eventType: "request.status_changed" }]);
  });
});

