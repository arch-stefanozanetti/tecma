import { afterEach, describe, expect, it } from 'vitest';

import {
  MongoRateLimitStore,
  incrementRateLimit,
  initRateLimitStore,
  isRateLimitStoreReady,
  resetRateLimitStoreForTest,
} from './rateLimitStore.js';

/** Collection finta con la semantica usata dallo store. */
const makeDb = () => {
  const docs = new Map<string, { _id: string; count: number; resetAt: Date }>();
  const col = {
    createIndex: async () => 'ok',
    findOneAndUpdate: async (filter: any, update: any) => {
      const doc = docs.get(filter._id);
      if (doc == null || doc.resetAt <= filter.resetAt.$gt) return null;
      doc.count += update.$inc.count;
      return doc;
    },
    replaceOne: async (filter: any, doc: any) => {
      docs.set(filter._id, { _id: filter._id, ...doc });
      return { acknowledged: true };
    },
  };
  return { db: { collection: () => col } as any, docs };
};

afterEach(() => {
  resetRateLimitStoreForTest();
});

describe('rate limit store condiviso', () => {
  it('non e pronto finche non viene inizializzato', async () => {
    expect(isRateLimitStoreReady()).toBe(false);
    await expect(incrementRateLimit('k', 1000)).rejects.toThrow(/non inizializzato/);
  });

  it('conta le richieste nella stessa finestra', async () => {
    const { db } = makeDb();
    await initRateLimitStore(db);
    expect(isRateLimitStoreReady()).toBe(true);

    expect((await incrementRateLimit('ip-1', 60_000)).current).toBe(1);
    expect((await incrementRateLimit('ip-1', 60_000)).current).toBe(2);
    expect((await incrementRateLimit('ip-2', 60_000)).current).toBe(1);
  });

  it('riparte da 1 quando la finestra e scaduta', async () => {
    const { db, docs } = makeDb();
    await initRateLimitStore(db);
    await incrementRateLimit('ip-1', 60_000);
    docs.get('ip-1')!.resetAt = new Date(Date.now() - 1);
    expect((await incrementRateLimit('ip-1', 60_000)).current).toBe(1);
  });

  it('lascia passare la richiesta se il database non risponde (fail-open)', async () => {
    const brokenDb = {
      collection: () => ({
        createIndex: async () => 'ok',
        findOneAndUpdate: async () => {
          throw new Error('mongo down');
        },
        replaceOne: async () => {
          throw new Error('mongo down');
        },
      }),
    } as any;
    await initRateLimitStore(brokenDb);

    const store = new MongoRateLimitStore({ timeWindow: 1000 });
    const result = await new Promise<{ current: number; ttl: number }>((resolve) => {
      store.incr('ip-1', (_err, value) => resolve(value!));
    });
    expect(result.current).toBe(0);
  });

  it('child eredita la finestra e accetta un override per rotta', () => {
    const store = new MongoRateLimitStore({ timeWindow: 60_000 });
    expect(store.child()).toBeInstanceOf(MongoRateLimitStore);
    expect(store.child({ timeWindow: 1000 })).toBeInstanceOf(MongoRateLimitStore);
  });
});
