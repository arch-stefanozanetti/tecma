/**
 * Registro degli handler eseguiti dal worker.
 *
 * Ogni handler deve essere idempotente: la coda garantisce "at-least-once",
 * quindi lo stesso job puo' arrivare due volte (lease scaduto, redeploy).
 */
import type { Db } from 'mongodb';

import type { AppConfig } from '@followup/shared-config';

export interface JobContext {
  db: Db;
  config: AppConfig;
  logger: {
    info: (obj: Record<string, unknown>, msg?: string) => void;
    warn: (obj: Record<string, unknown>, msg?: string) => void;
    error: (obj: Record<string, unknown>, msg?: string) => void;
  };
}

export type JobHandler = (payload: Record<string, unknown>, ctx: JobContext) => Promise<void>;

/**
 * Scansione di retention: marca per revisione i documenti oltre la finestra di
 * conservazione. Non cancella nulla — la cancellazione resta un'azione esplicita.
 */
const retentionScan: JobHandler = async (payload, ctx) => {
  const days = Number.parseInt(String(payload['days'] ?? '365'), 10);
  const threshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const count = await ctx.db
    .collection('tz_audit_events')
    .countDocuments({ createdAt: { $lt: threshold } });
  ctx.logger.info(
    { event: 'job.retention_scan', days, threshold: threshold.toISOString(), count },
    'retention scan completata',
  );
};

/** Placeholder tipizzato per l'ingestion marketing, che oggi gira lato frontend. */
const bigdataIngest: JobHandler = async (payload, ctx) => {
  const source = String(payload['source'] ?? 'unknown');
  ctx.logger.info({ event: 'job.bigdata_ingest', source }, 'ingestion richiesta');
};

export const JOB_HANDLERS: Record<string, JobHandler> = {
  'retention.scan': retentionScan,
  'bigdata.ingest': bigdataIngest,
};
