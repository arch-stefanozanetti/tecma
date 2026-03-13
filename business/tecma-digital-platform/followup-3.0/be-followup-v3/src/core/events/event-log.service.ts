import { getDb } from "../../config/db.js";

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
  await collection.insertOne({
    type: input.type,
    workspaceId: input.workspaceId ?? null,
    projectId: input.projectId ?? null,
    entityId: input.entityId ?? null,
    payload: input.payload,
    actor: input.actor ?? { type: "system" },
    createdAt: now
  });
};

