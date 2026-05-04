import { afterEach, describe, expect, it } from 'vitest';

import {
  AUTH_PROFILE_KEY,
  clearFollowupAuthSession,
  persistLoginProfile,
  readStoredLoginProfile,
} from './authSession';

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
    persistLoginProfile({ id: '1', email: 'e@test.it', systemRole: 'user' });
    clearFollowupAuthSession();
    expect(sessionStorage.getItem('followup.auth.accessToken')).toBeNull();
    expect(sessionStorage.getItem('followup.auth.refreshToken')).toBeNull();
    expect(sessionStorage.getItem(AUTH_PROFILE_KEY)).toBeNull();
  });
});
