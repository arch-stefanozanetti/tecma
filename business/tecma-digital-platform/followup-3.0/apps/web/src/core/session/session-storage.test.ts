import { describe, expect, it } from 'vitest';

import { clearSessionStorage } from './session-storage';

describe('clearSessionStorage', () => {
  it('auth-only pulisce solo chiavi di sessione auth', () => {
    sessionStorage.setItem('followup.auth.accessToken', 'tok');
    sessionStorage.setItem('followup.workspaceId', 'ws-1');
    clearSessionStorage('auth-only');
    expect(sessionStorage.getItem('followup.auth.accessToken')).toBeNull();
    expect(sessionStorage.getItem('followup.workspaceId')).toBe('ws-1');
  });

  it('full pulisce anche scope workspace/progetti', () => {
    sessionStorage.setItem('followup.auth.accessToken', 'tok');
    sessionStorage.setItem('followup.workspaceId', 'ws-1');
    sessionStorage.setItem('followup.projectScope', '[]');
    clearSessionStorage('full');
    expect(sessionStorage.getItem('followup.auth.accessToken')).toBeNull();
    expect(sessionStorage.getItem('followup.workspaceId')).toBeNull();
    expect(sessionStorage.getItem('followup.projectScope')).toBeNull();
  });
});
