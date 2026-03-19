import { EventEmitter } from "node:events";
import type { RealtimeEventEnvelope } from "./realtime-events.js";

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

const TOPIC = "followup.realtime.event";

export type RealtimeListener = (event: RealtimeEventEnvelope) => void;

export function publishRealtimeEvent(event: RealtimeEventEnvelope): void {
  emitter.emit(TOPIC, event);
}

export function subscribeRealtimeEvents(listener: RealtimeListener): () => void {
  emitter.on(TOPIC, listener);
  return () => emitter.off(TOPIC, listener);
}
