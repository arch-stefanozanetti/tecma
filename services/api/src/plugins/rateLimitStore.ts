/**
 * Store del rate limit condiviso tra le istanze.
 *
 * Il default in-process di `@fastify/rate-limit` tiene i contatori nella
 * memoria del singolo processo: con N istanze dietro al load balancer il
 * limite effettivo diventa N volte quello dichiarato. Persistendo i contatori
 * su Mongo (collection `tz_rate_limit`, con TTL) il limite resta quello scritto
 * anche scalando orizzontalmente.
 *
 * Se Mongo non risponde la richiesta viene lasciata passare (fail-open): il
 * rate limit e' una protezione, non deve diventare un single point of failure.
 */
import type { Collection, Db } from 'mongodb';

export const RATE_LIMIT_COLLECTION = 'tz_rate_limit';

interface RateLimitDoc {
  _id: string;
  count: number;
  resetAt: Date;
}

let collection: Collection<RateLimitDoc> | null = null;

/** Collega lo store al database. Va chiamata prima di registrare il plugin. */
export const initRateLimitStore = async (db: Db): Promise<void> => {
  const col = db.collection<RateLimitDoc>(RATE_LIMIT_COLLECTION);
  await col.createIndex({ resetAt: 1 }, { expireAfterSeconds: 0 });
  collection = col;
};

export const isRateLimitStoreReady = (): boolean => collection != null;

/** Solo per i test: azzera il collegamento. */
export const resetRateLimitStoreForTest = (): void => {
  collection = null;
};

type IncrCallback = (error: Error | null, result?: { current: number; ttl: number }) => void;

/**
 * Contatore atomico su Mongo. La finestra e' rappresentata dal campo `resetAt`:
 * finche' e' nel futuro si incrementa, altrimenti il documento viene riscritto
 * daccapo. `findOneAndUpdate` rende l'incremento atomico tra istanze.
 */
export const incrementRateLimit = async (
  key: string,
  timeWindowMs: number,
): Promise<{ current: number; ttl: number }> => {
  const col = collection;
  if (col == null) throw new Error('rate limit store non inizializzato');

  const now = new Date();
  const existing = await col.findOneAndUpdate(
    { _id: key, resetAt: { $gt: now } },
    { $inc: { count: 1 } },
    { returnDocument: 'after' },
  );
  if (existing != null) {
    return {
      current: existing.count,
      ttl: Math.max(0, existing.resetAt.getTime() - now.getTime()),
    };
  }

  const resetAt = new Date(now.getTime() + timeWindowMs);
  await col.replaceOne({ _id: key }, { count: 1, resetAt }, { upsert: true });
  return { current: 1, ttl: timeWindowMs };
};

/**
 * Classe store nel formato atteso da `@fastify/rate-limit`: il plugin la
 * istanzia da solo e chiama `child()` per ogni rotta con override.
 */
export class MongoRateLimitStore {
  private readonly timeWindowMs: number;

  constructor(options: { timeWindow?: number } = {}) {
    this.timeWindowMs = typeof options.timeWindow === 'number' ? options.timeWindow : 60_000;
  }

  incr(key: string, callback: IncrCallback): void {
    incrementRateLimit(key, this.timeWindowMs).then(
      (result) => callback(null, result),
      // Fail-open: Mongo giu' non deve tradursi in 500 su ogni richiesta.
      () => callback(null, { current: 0, ttl: this.timeWindowMs }),
    );
  }

  child(routeOptions: { timeWindow?: number } = {}): MongoRateLimitStore {
    return new MongoRateLimitStore({
      timeWindow:
        typeof routeOptions.timeWindow === 'number' ? routeOptions.timeWindow : this.timeWindowMs,
    });
  }
}
