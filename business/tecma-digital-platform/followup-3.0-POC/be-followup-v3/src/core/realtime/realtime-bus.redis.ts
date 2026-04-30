/**
 * Redis pub/sub adapter per realtime bus. Usare quando REALTIME_REDIS_URL è impostato
 * (deploy multi-istanza). Stessa interfaccia di realtime-bus.inmemory.
 */
import Redis from "ioredis";
import type { RealtimeEventEnvelope } from "./realtime-events.js";

const CHANNEL = "followup.realtime.event";

const RedisConstructor = (Redis as unknown) as new (url: string, opts?: { maxRetriesPerRequest: number }) => { publish: (ch: string, msg: string) => void; subscribe: (ch: string) => void; on: (ev: string, fn: (ch: string, msg: string) => void) => void };
type RedisClient = InstanceType<typeof RedisConstructor>;

let publisher: RedisClient | null = null;
let subscriber: RedisClient | null = null;
const listeners: Set<(event: RealtimeEventEnvelope) => void> = new Set();

function getPublisher(): RedisClient {
  if (!publisher) {
    const url = process.env.REALTIME_REDIS_URL;
    if (!url) throw new Error("REALTIME_REDIS_URL required for Redis realtime bus");
    publisher = new RedisConstructor(url, { maxRetriesPerRequest: 3 });
  }
  return publisher;
}

function getSubscriber(): RedisClient {
  if (!subscriber) {
    const url = process.env.REALTIME_REDIS_URL;
    if (!url) throw new Error("REALTIME_REDIS_URL required for Redis realtime bus");
    subscriber = new RedisConstructor(url, { maxRetriesPerRequest: 3 });
    subscriber.subscribe(CHANNEL);
    subscriber.on("message", (channel: string, message: string) => {
      if (channel !== CHANNEL) return;
      try {
        const event = JSON.parse(message) as RealtimeEventEnvelope;
        listeners.forEach((fn) => fn(event));
      } catch {
        // skip invalid messages
      }
    });
  }
  return subscriber;
}

export type RealtimeListener = (event: RealtimeEventEnvelope) => void;

export function publishRealtimeEvent(event: RealtimeEventEnvelope): void {
  getPublisher().publish(CHANNEL, JSON.stringify(event));
}

export function subscribeRealtimeEvents(listener: RealtimeListener): () => void {
  getSubscriber();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
