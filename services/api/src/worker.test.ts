import { describe, expect, it, vi } from 'vitest';

import type { JobDoc } from './infra/jobQueue.js';
import { runJob } from './worker.js';

const job = (kind: string): JobDoc => ({
  _id: 'j1',
  kind,
  payload: { a: 1 },
  status: 'running',
  attempts: 1,
  maxAttempts: 3,
  runAt: new Date(),
  leaseUntil: new Date(),
  lastError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const ctx = { db: {} as any, config: {} as any, logger: { info() {}, warn() {}, error() {} } };

describe('runJob', () => {
  it('invoca l handler registrato con il payload', async () => {
    const handler = vi.fn(async () => undefined);
    await runJob(job('demo.kind'), { 'demo.kind': handler }, ctx);
    expect(handler).toHaveBeenCalledWith({ a: 1 }, ctx);
  });

  it('fallisce in modo esplicito se il tipo di job e sconosciuto', async () => {
    await expect(runJob(job('ignoto'), {}, ctx)).rejects.toThrow(/ignoto/);
  });
});
