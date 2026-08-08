import { describe, expect, it } from 'vitest';

import { resolveAppEnv } from './appEnv.js';

describe('resolveAppEnv', () => {
  it('seleziona demo solo per il valore esatto', () => {
    expect(resolveAppEnv('demo')).toBe('demo');
    expect(resolveAppEnv('DEMO')).toBe('demo');
    expect(resolveAppEnv('  Demo  ')).toBe('demo');
  });

  it('ricade su prod per qualunque valore ambiguo', () => {
    expect(resolveAppEnv(undefined)).toBe('prod');
    expect(resolveAppEnv('')).toBe('prod');
    expect(resolveAppEnv('prod')).toBe('prod');
    expect(resolveAppEnv('demo-x')).toBe('prod');
    expect(resolveAppEnv('xdemo')).toBe('prod');
    expect(resolveAppEnv('demo,prod')).toBe('prod');
    expect(resolveAppEnv(1)).toBe('prod');
    expect(resolveAppEnv(null)).toBe('prod');
    expect(resolveAppEnv({})).toBe('prod');
  });

  it('con header ripetuto usa il primo valore', () => {
    expect(resolveAppEnv(['demo', 'prod'])).toBe('demo');
    expect(resolveAppEnv(['prod', 'demo'])).toBe('prod');
    expect(resolveAppEnv([])).toBe('prod');
  });
});
