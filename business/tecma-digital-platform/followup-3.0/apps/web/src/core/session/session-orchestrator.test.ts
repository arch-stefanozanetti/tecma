import { beforeEach, describe, expect, it } from 'vitest';

import { SESSION_INVALIDATED_AT_KEY, sessionOrchestrator } from './session-orchestrator';

describe('sessionOrchestrator', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('invalidateSession è idempotente su chiamate concorrenti', async () => {
    sessionStorage.setItem('followup.auth.accessToken', 'tok');
    const [first, second] = await Promise.all([
      sessionOrchestrator.invalidateSession({
        reason: 'session_expired',
        source: 'api_interceptor',
      }),
      sessionOrchestrator.invalidateSession({
        reason: 'session_expired',
        source: 'api_interceptor',
      }),
    ]);
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(sessionStorage.getItem('followup.auth.accessToken')).toBeNull();
  });

  it('scrive marker multi-tab in localStorage', async () => {
    await sessionOrchestrator.invalidateSession({
      reason: 'session_expired',
      source: 'api_interceptor',
    });
    const marker = localStorage.getItem(SESSION_INVALIDATED_AT_KEY);
    expect(marker).not.toBeNull();
    expect(marker).toContain('session_expired');
  });

  it('reagisce al marker storage cross-tab invalidando la sessione locale', async () => {
    sessionStorage.setItem('followup.auth.accessToken', 'tok');
    sessionOrchestrator.initMultiTabSync();
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: SESSION_INVALIDATED_AT_KEY,
        newValue: JSON.stringify({
          markerId: 'm1',
          reason: 'session_expired',
          source: 'api_interceptor',
          redirectToLogin: true,
          at: new Date().toISOString(),
        }),
      }),
    );
    await Promise.resolve();
    expect(sessionStorage.getItem('followup.auth.accessToken')).toBeNull();
  });
});
