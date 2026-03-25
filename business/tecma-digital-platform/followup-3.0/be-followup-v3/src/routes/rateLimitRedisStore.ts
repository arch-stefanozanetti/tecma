import type { IncrementResponse, Options, Store } from "express-rate-limit";
import Redis from "ioredis";
import { ENV } from "../config/env.js";
import { logger } from "../observability/logger.js";

const KEY_PREFIX = "followup:rl:";

/** Allineamento tipi costruttore ioredis (come realtime-bus.redis). */
const RedisConstructor = Redis as unknown as new (
  url: string,
  opts?: { maxRetriesPerRequest?: number; lazyConnect?: boolean; enableReadyCheck?: boolean }
) => {
  incr: (key: string) => Promise<number>;
  pexpire: (key: string, ms: number) => Promise<number>;
  pttl: (key: string) => Promise<number>;
  decr: (key: string) => Promise<number>;
  del: (key: string) => Promise<number>;
  on: (event: string, fn: (err: Error) => void) => void;
};

type RedisClient = InstanceType<typeof RedisConstructor>;

const sharedClients = new Map<string, RedisClient>();

function getSharedRedis(url: string): RedisClient {
  const existing = sharedClients.get(url);
  if (existing) return existing;
  const client = new RedisConstructor(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    enableReadyCheck: true
  });
  client.on("error", (err: Error) => {
    logger.error({ err }, "[rate-limit-redis] connection error");
  });
  sharedClients.set(url, client);
  return client;
}

class IoredisFixedWindowStore implements Store {
  windowMs = 60_000;
  private readonly redis: RedisClient;

  constructor(redis: RedisClient) {
    this.redis = redis;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private key(k: string): string {
    return `${KEY_PREFIX}${k}`;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const redisKey = this.key(key);
    const n = await this.redis.incr(redisKey);
    if (n === 1) {
      await this.redis.pexpire(redisKey, this.windowMs);
    }
    const pttl = await this.redis.pttl(redisKey);
    const ms = pttl > 0 ? pttl : this.windowMs;
    return { totalHits: n, resetTime: new Date(Date.now() + ms) };
  }

  async decrement(key: string): Promise<void> {
    await this.redis.decr(this.key(key));
  }

  async resetKey(key: string): Promise<void> {
    await this.redis.del(this.key(key));
  }
}

/**
 * Se `RATE_LIMIT_REDIS_URL` è valorizzata, uno store Redis per istanza di limiter (condivide la connessione).
 * Altrimenti `undefined` → comportamento default in-memory di express-rate-limit.
 */
export function createOptionalRedisRateLimitStore(): Store | undefined {
  const url = (ENV.RATE_LIMIT_REDIS_URL ?? "").trim();
  if (!url) return undefined;
  return new IoredisFixedWindowStore(getSharedRedis(url));
}
