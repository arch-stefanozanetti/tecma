import { describe, expect, it } from 'vitest';

import { JobQueue, type JobDoc } from './jobQueue.js';

/** Collection Mongo finta, sufficiente per la semantica usata da JobQueue. */
const makeDb = () => {
  const docs: JobDoc[] = [];
  const matches = (doc: JobDoc, filter: any): boolean => {
    if (filter._id != null && doc._id !== filter._id) return false;
    if (filter.status?.$in != null && !filter.status.$in.includes(doc.status)) return false;
    if (filter.kind?.$in != null && !filter.kind.$in.includes(doc.kind)) return false;
    if (filter.$or != null) {
      const ok = filter.$or.some((clause: any) => {
        if (clause.status !== doc.status) return false;
        if (clause.runAt?.$lte != null) return doc.runAt <= clause.runAt.$lte;
        if (clause.leaseUntil?.$lte != null)
          return doc.leaseUntil != null && doc.leaseUntil <= clause.leaseUntil.$lte;
        return true;
      });
      if (!ok) return false;
    }
    return true;
  };
  const apply = (doc: JobDoc, update: any) => {
    Object.assign(doc, update.$set ?? {});
    for (const [k, v] of Object.entries(update.$inc ?? {})) {
      (doc as any)[k] += v as number;
    }
  };
  const collection = {
    createIndex: async () => 'ok',
    findOne: async (filter: any) => docs.find((d) => matches(d, filter)) ?? null,
    replaceOne: async (filter: any, doc: JobDoc) => {
      const idx = docs.findIndex((d) => matches(d, filter));
      if (idx >= 0) docs[idx] = doc;
      else docs.push(doc);
      return { acknowledged: true };
    },
    findOneAndUpdate: async (filter: any, update: any, opts: any) => {
      const candidates = docs.filter((d) => matches(d, filter));
      candidates.sort((a, b) => a.runAt.getTime() - b.runAt.getTime());
      const doc = candidates[0];
      if (doc == null) return null;
      apply(doc, update);
      return opts?.returnDocument === 'after' ? doc : doc;
    },
    updateOne: async (filter: any, update: any) => {
      const doc = docs.find((d) => matches(d, filter));
      if (doc != null) apply(doc, update);
      return { acknowledged: true };
    },
  };
  return { db: { collection: () => collection } as any, docs };
};

describe('JobQueue', () => {
  it('accoda e preleva un job', async () => {
    const { db, docs } = makeDb();
    const queue = new JobQueue(db);
    const id = await queue.enqueue('retention.scan', { workspaceId: 'ws-1' });
    expect(id).not.toBeNull();
    expect(docs).toHaveLength(1);

    const claimed = await queue.claim();
    expect(claimed?.kind).toBe('retention.scan');
    expect(claimed?.status).toBe('running');
    expect(claimed?.attempts).toBe(1);
  });

  it('non preleva due volte lo stesso job finche il lease e valido', async () => {
    const { db } = makeDb();
    const queue = new JobQueue(db);
    await queue.enqueue('a');
    expect(await queue.claim()).not.toBeNull();
    expect(await queue.claim()).toBeNull();
  });

  it('recupera un job con lease scaduto', async () => {
    const { db, docs } = makeDb();
    const queue = new JobQueue(db);
    await queue.enqueue('a');
    await queue.claim();
    docs[0]!.leaseUntil = new Date(Date.now() - 1000);
    const again = await queue.claim();
    expect(again?.attempts).toBe(2);
  });

  it('non duplica un job con la stessa dedupeKey', async () => {
    const { db, docs } = makeDb();
    const queue = new JobQueue(db);
    await queue.enqueue('a', {}, { dedupeKey: 'daily-scan' });
    const second = await queue.enqueue('a', {}, { dedupeKey: 'daily-scan' });
    expect(second).toBeNull();
    expect(docs).toHaveLength(1);
  });

  it('rimette in coda con backoff finche restano tentativi, poi fallisce', async () => {
    const { db, docs } = makeDb();
    const queue = new JobQueue(db);
    await queue.enqueue('a', {}, { maxAttempts: 2 });

    const first = (await queue.claim())!;
    await queue.fail(first, new Error('boom'));
    expect(docs[0]!.status).toBe('pending');
    expect(docs[0]!.lastError).toBe('boom');

    docs[0]!.runAt = new Date(Date.now() - 1);
    const second = (await queue.claim())!;
    await queue.fail(second, new Error('boom again'));
    expect(docs[0]!.status).toBe('failed');
  });

  it('marca il job completato', async () => {
    const { db, docs } = makeDb();
    const queue = new JobQueue(db);
    const id = (await queue.enqueue('a'))!;
    await queue.claim();
    await queue.complete(id);
    expect(docs[0]!.status).toBe('done');
    expect(docs[0]!.leaseUntil).toBeNull();
  });
});
