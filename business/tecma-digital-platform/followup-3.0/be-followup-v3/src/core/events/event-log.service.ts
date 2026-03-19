import { getDb } from "../../config/db.js";
import { getRequestContext } from "../../observability/request-context.js";
import { publishRealtimeEvent } from "../realtime/realtime-bus.service.js";
import { REALTIME_PAYLOAD_VERSION } from "../realtime/realtime-events.js";

export type DomainEventInput = {
  type: string;
  workspaceId?: string;
  projectId?: string;
  entityId?: string;
  payload: Record<string, unknown>;
  actor?: { type: "system" | "user" | "mcp"; id?: string };
};

export const emitDomainEvent = async (input: DomainEventInput) => {
  const collection = getDb().collection("tz_domain_events");
  const now = new Date().toISOString();
  const requestContext = getRequestContext();
  await collection.insertOne({
    type: input.type,
    workspaceId: input.workspaceId ?? null,
    projectId: input.projectId ?? null,
    entityId: input.entityId ?? null,
    payload: input.payload,
    actor: input.actor ?? { type: "system" },
    createdAt: now
  });

  publishRealtimeEvent({
    eventType: input.type,
    entityId: input.entityId ?? null,
    workspaceId: input.workspaceId ?? null,
    projectId: input.projectId ?? null,
    actorId: input.actor?.id ?? requestContext?.userId ?? null,
    timestamp: now,
    payloadVersion: REALTIME_PAYLOAD_VERSION,
    payload: input.payload,
  });
};
