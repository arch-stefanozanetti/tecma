import { afterEach, describe, expect, it } from 'vitest';

import {
  AUTH_PROFILE_KEY,
  clearAuthSession,
  clearFollowupAuthSession,
  handleSessionExpired,
  isRecoverableSessionError,
  persistAuthSession,
  persistLoginProfile,
  readAuthSession,
  readStoredLoginProfile,
} from './authSession';
import { HttpApiError } from './httpError';

describe('authSession', () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it('persistLoginProfile e readStoredLoginProfile (round-trip)', () => {
    persistLoginProfile({
      id: '507f1f77bcf86cd799439011',
      email: 'a@tecma.test',
      systemRole: 'tecma_superadmin',
    });
    expect(readStoredLoginProfile()).toEqual({
      id: '507f1f77bcf86cd799439011',
      email: 'a@tecma.test',
      systemRole: 'tecma_superadmin',
    });
  });

  it('readStoredLoginProfile normalizza email e default systemRole', () => {
    sessionStorage.setItem(
      AUTH_PROFILE_KEY,
      JSON.stringify({ id: 'x', email: '  B@Tecma.TEST  ' }),
    );
    expect(readStoredLoginProfile()).toEqual({
      id: 'x',
      email: 'b@tecma.test',
      systemRole: 'user',
    });
  });

  it('clearFollowupAuthSession rimuove profilo e token', () => {
    sessionStorage.setItem('followup.auth.accessToken', 'tok');
    sessionStorage.setItem('followup.auth.refreshToken', 'ref');
    sessionStorage.setItem('followup.workspaceId', 'ws-1');
    persistLoginProfile({ id: '1', email: 'e@test.it', systemRole: 'user' });
    clearFollowupAuthSession();
    expect(sessionStorage.getItem('followup.auth.accessToken')).toBeNull();
    expect(sessionStorage.getItem('followup.auth.refreshToken')).toBeNull();
    expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).toBeNull();
    expect(sessionStorage.getItem('followup.workspaceId')).toBeNull();
  });

  it('persistAuthSession/readAuthSession gestiscono token e profilo centralizzati', () => {
    persistAuthSession({
      accessToken: 'tok',
      refreshToken: 'ref',
      profile: { id: '1', email: 'User@Tecma.TEST', systemRole: 'user' },
    });

    expect(readAuthSession()).toEqual({
      accessToken: 'tok',
      refreshToken: 'ref',
      profile: { id: '1', email: 'user@tecma.test', systemRole: 'user' },
    });
  });

  it('isRecoverableSessionError riconosce token invalidi/scaduti', () => {
    const err = new HttpApiError('Missing or invalid token', {
      kind: 'unauthorized',
      path: '/auth/me',
      status: 401,
      serverMessage: 'Missing or invalid token',
      unauthorizedBecause: 'session',
    });
    expect(isRecoverableSessionError(err)).toBe(true);
  });

  it('handleSessionExpired pulisce sessione e ritorna notice utente-safe', () => {
    sessionStorage.setItem('followup.auth.accessToken', 'tok');
    const notice = handleSessionExpired(
      new HttpApiError('jwt expired', {
        kind: 'unauthorized',
        path: '/workspaces',
        status: 401,
        serverMessage: 'jwt expired',
        unauthorizedBecause: 'session',
      }),
    );
    expect(notice.message).toBe('La sessione è scaduta. Accedi di nuovo per continuare.');
    expect(sessionStorage.getItem('followup.auth.accessToken')).toBeNull();
  });

  it('clearAuthSession è alias pubblico del clear centralizzato', () => {
    sessionStorage.setItem('followup.auth.accessToken', 'tok');
    clearAuthSession();
    expect(sessionStorage.getItem('followup.auth.accessToken')).toBeNull();
  });
});
