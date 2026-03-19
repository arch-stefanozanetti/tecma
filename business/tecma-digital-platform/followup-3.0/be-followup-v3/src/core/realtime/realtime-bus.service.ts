/**
 * Realtime event bus: in-memory (single instance) o Redis (multi-instance).
 * Se REALTIME_REDIS_URL è impostato, usa Redis pub/sub; altrimenti EventEmitter in-memory.
 */
import * as inmemory from "./realtime-bus.inmemory.js";
import * as redis from "./realtime-bus.redis.js";
import type { RealtimeEventEnvelope } from "./realtime-events.js";

export type RealtimeListener = (event: RealtimeEventEnvelope) => void;

const useRedis = typeof process.env.REALTIME_REDIS_URL === "string" && process.env.REALTIME_REDIS_URL.trim().length > 0;

export const publishRealtimeEvent = useRedis ? redis.publishRealtimeEvent : inmemory.publishRealtimeEvent;
export const subscribeRealtimeEvents = useRedis ? redis.subscribeRealtimeEvents : inmemory.subscribeRealtimeEvents;
