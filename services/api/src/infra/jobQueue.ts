/**
 * Coda di lavori persistita su Mongo (collection `tz_jobs`).
 *
 * Perche' non Redis: il volume attuale non lo giustifica e Mongo e' gia' un
 * componente critico. La semantica e' "at-least-once": un job viene preso in
 * carico con un lease a scadenza, quindi un worker morto non blocca la coda
 * per sempre. Gli handler devono essere idempotenti.
 */
import crypto from 'node:crypto';

import type { Db } from 'mongodb';

export const JOBS_COLLECTION = 'tz_jobs';

export type JobStatus = 'pending' | 'running' | 'done' | 'failed';

export interface JobDoc {
  _id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  /** Scadenza del lease: oltre questo istante il job torna prelevabile. */
  leaseUntil: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueOptions {
  /** Ritardo prima della prima esecuzione, in millisecondi. */
  delayMs?: number;
  maxAttempts?: number;
  /** Chiave di deduplica: se un job pending/running con la stessa chiave esiste, non se ne crea un altro. */
  dedupeKey?: string;
}

const now = (): Date => new Date();

export class JobQueue {
  constructor(
    private readonly db: Db,
    private readonly leaseMs = 5 * 60_000,
  ) {}

  private get col() {
    return this.db.collection<JobDoc>(JOBS_COLLECTION);
  }

  /** Indici necessari al polling e alla pulizia. Idempotente. */
  async ensureIndexes(): Promise<void> {
    await this.col.createIndex({ status: 1, runAt: 1 });
    await this.col.createIndex({ kind: 1, status: 1 });
    await this.col.createIndex({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
  }

  async enqueue(
    kind: string,
    payload: Record<string, unknown> = {},
    options: EnqueueOptions = {},
  ): Promise<string | null> {
    const at = now();
    if (options.dedupeKey != null) {
      const existing = await this.col.findOne({
        _id: options.dedupeKey,
        status: { $in: ['pending', 'running'] },
      });
      if (existing != null) return null;
    }
    const doc: JobDoc = {
      _id: options.dedupeKey ?? crypto.randomUUID(),
      kind,
      payload,
      status: 'pending',
      attempts: 0,
      maxAttempts: options.maxAttempts ?? 3,
      runAt: new Date(at.getTime() + (options.delayMs ?? 0)),
      leaseUntil: null,
      lastError: null,
      createdAt: at,
      updatedAt: at,
    };
    await this.col.replaceOne({ _id: doc._id }, doc, { upsert: true });
    return doc._id;
  }

  /**
   * Preleva atomicamente un job eseguibile: pending scaduto di runAt, oppure
   * running con lease scaduto (worker morto).
   */
  async claim(kinds?: readonly string[]): Promise<JobDoc | null> {
    const at = now();
    const filter: Record<string, unknown> = {
      $or: [
        { status: 'pending', runAt: { $lte: at } },
        { status: 'running', leaseUntil: { $lte: at } },
      ],
      ...(kinds != null && kinds.length > 0 ? { kind: { $in: [...kinds] } } : {}),
    };
    const result = await this.col.findOneAndUpdate(
      filter,
      {
        $set: {
          status: 'running',
          leaseUntil: new Date(at.getTime() + this.leaseMs),
          updatedAt: at,
        },
        $inc: { attempts: 1 },
      },
      { sort: { runAt: 1 }, returnDocument: 'after' },
    );
    return (result as JobDoc | null) ?? null;
  }

  async complete(id: string): Promise<void> {
    const at = now();
    await this.col.updateOne(
      { _id: id },
      { $set: { status: 'done', leaseUntil: null, lastError: null, updatedAt: at } },
    );
  }

  /**
   * Registra il fallimento. Se restano tentativi il job torna pending con
   * backoff esponenziale, altrimenti si ferma in `failed` per ispezione manuale.
   */
  async fail(job: JobDoc, error: unknown): Promise<void> {
    const at = now();
    const message = error instanceof Error ? error.message : String(error);
    const exhausted = job.attempts >= job.maxAttempts;
    const backoffMs = Math.min(60_000 * 2 ** (job.attempts - 1), 30 * 60_000);
    await this.col.updateOne(
      { _id: job._id },
      {
        $set: {
          status: exhausted ? 'failed' : 'pending',
          leaseUntil: null,
          lastError: message.slice(0, 2000),
          runAt: exhausted ? job.runAt : new Date(at.getTime() + backoffMs),
          updatedAt: at,
        },
      },
    );
  }
}
