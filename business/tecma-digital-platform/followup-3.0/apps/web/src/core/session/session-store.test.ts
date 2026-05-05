import { describe, expect, it } from 'vitest';

import { getTokenExpiration, isTokenExpired } from './session-store';

const makeTokenWithExp = (expSeconds: number): string => {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const payload = btoa(JSON.stringify({ exp: expSeconds }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${header}.${payload}.`;
};

describe('session-store token helpers', () => {
  it('getTokenExpiration legge exp da JWT', () => {
    const exp = Math.floor(Date.now() / 1000) + 60;
    const token = makeTokenWithExp(exp);
    const parsed = getTokenExpiration(token);
    expect(parsed).not.toBeNull();
    expect(parsed?.getTime()).toBe(exp * 1000);
  });

  it('isTokenExpired ritorna true per token scaduto', () => {
    const token = makeTokenWithExp(Math.floor(Date.now() / 1000) - 10);
    expect(isTokenExpired(token, 0)).toBe(true);
  });
});
