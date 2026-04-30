export interface RealtimeEventEnvelope<TPayload = Record<string, unknown>> {
  eventType: string;
  entityId: string | null;
  workspaceId: string | null;
  projectId: string | null;
  actorId: string | null;
  timestamp: string;
  payloadVersion: number;
  payload: TPayload;
}

export const REALTIME_PAYLOAD_VERSION = 1;

