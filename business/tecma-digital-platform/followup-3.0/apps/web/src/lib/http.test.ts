import { describe, expect, it } from 'vitest';

import { resolveApiBaseUrl } from './http';

describe('resolveApiBaseUrl', () => {
  it('defaulta a /v1 se env assente o vuoto', () => {
    expect(resolveApiBaseUrl(undefined)).toBe('/v1');
    expect(resolveApiBaseUrl('')).toBe('/v1');
    expect(resolveApiBaseUrl('   ')).toBe('/v1');
  });

  it('lascia invariata una base che contiene già v1', () => {
    expect(resolveApiBaseUrl('/v1')).toBe('/v1');
    expect(resolveApiBaseUrl('http://localhost:8080/v1')).toBe('http://localhost:8080/v1');
  });

  it("appende /v1 se manca (errore tipico: solo host:porta dell'API)", () => {
    expect(resolveApiBaseUrl('http://localhost:8080')).toBe('http://localhost:8080/v1');
    expect(resolveApiBaseUrl('http://127.0.0.1:3000/')).toBe('http://127.0.0.1:3000/v1');
  });
});
