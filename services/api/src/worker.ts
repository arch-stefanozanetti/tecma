/**
 * Processo worker: esegue i job della coda `tz_jobs` fuori dal processo web.
 *
 * Stesso repository, stessa immagine, stesse variabili d'ambiente dell'API:
 * cambia solo l'entrypoint (`pnpm start:worker`). Non e' un microservizio, e'
 * una separazione di processo, cosi' un'ingestion lunga non degrada le
 * richieste degli utenti.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import dotenv from 'dotenv';

import { FollowupMongoClient } from '@followup/db';
import { appLogger } from '@followup/logger';
import { loadEnv } from '@followup/shared-config';

import { JobQueue, type JobDoc } from './infra/jobQueue.js';
import { JOB_HANDLERS, type JobHandler } from './jobs/handlers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

const POLL_INTERVAL_MS = Number.parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? '2000', 10);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const runJob = async (
  job: JobDoc,
  handlers: Record<string, JobHandler>,
  ctx: Parameters<JobHandler>[1],
): Promise<void> => {
  const handler = handlers[job.kind];
  if (handler == null) {
    throw new Error(`nessun handler registrato per il job "${job.kind}"`);
  }
  await handler(job.payload, ctx);
};

const main = async (): Promise<void> => {
  const config = loadEnv();
  const mongo = new FollowupMongoClient({
    mongoUri: config.MONGO_URI,
    mongoDbName: config.MONGO_DB_NAME,
    nodeEnv: config.NODE_ENV,
  });
  await mongo.connect();
  const db = mongo.getDb();
  const queue = new JobQueue(db);
  await queue.ensureIndexes();

  let stopping = false;
  const stop = () => {
    stopping = true;
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  appLogger.info({ event: 'worker.started', kinds: Object.keys(JOB_HANDLERS) }, 'worker avviato');

  while (!stopping) {
    let job: JobDoc | null = null;
    try {
      job = await queue.claim();
    } catch (error) {
      appLogger.error({ event: 'worker.claim_failed', error: String(error) }, 'claim fallito');
    }

    if (job == null) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    const startedAt = Date.now();
    try {
      await runJob(job, JOB_HANDLERS, { db, config, logger: appLogger });
      await queue.complete(job._id);
      appLogger.info(
        { event: 'worker.job_done', kind: job.kind, jobId: job._id, ms: Date.now() - startedAt },
        'job completato',
      );
    } catch (error) {
      await queue.fail(job, error);
      appLogger.error(
        { event: 'worker.job_failed', kind: job.kind, jobId: job._id, error: String(error) },
        'job fallito',
      );
    }
  }

  await mongo.close();
  appLogger.info({ event: 'worker.stopped' }, 'worker fermato');
};

const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void main();
}
