/**
 * Molti eventi (es. client.created) passano l'id entità come entityId + entityType,
 * mentre altri (es. richieste) usano clientId esplicito. Unifica la risoluzione per invii e template.
 */
import type { DispatchEventPayload } from "../automations/automation-events.service.js";

export function resolveClientIdFromDispatchPayload(payload: DispatchEventPayload): string | undefined {
  const fromField = payload.clientId;
  if (typeof fromField === "string" && fromField.trim()) return fromField.trim();
  if (payload.entityType === "client" && typeof payload.entityId === "string" && payload.entityId.trim()) {
    return payload.entityId.trim();
  }
  return undefined;
}
