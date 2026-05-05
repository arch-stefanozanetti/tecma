import { normalizeApiError, type NormalizedApiError } from './httpError';

/** Chiavi sessione condivise tra login, accesso progetti e shell. */
export const AUTH_ACCESS_TOKEN_KEY = 'followup.auth.accessToken';
export const AUTH_REFRESH_TOKEN_KEY = 'followup.auth.refreshToken';
export const AUTH_PROFILE_KEY = 'followup.auth.profile';

export type StoredLoginProfile = {
  id: string;
  email: string;
  systemRole: string;
};

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  profile: StoredLoginProfile;
};

export type SessionExpiredNotice = {
  reason: NormalizedApiError['reason'];
  message: string;
};

export function persistLoginProfile(profile: StoredLoginProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* ignore quota / private mode */
  }
}

export function persistAuthSession(session: AuthSession): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTH_ACCESS_TOKEN_KEY, session.accessToken);
    window.sessionStorage.setItem('followup3.accessToken', session.accessToken);
    if (session.refreshToken != null) {
      window.sessionStorage.setItem(AUTH_REFRESH_TOKEN_KEY, session.refreshToken);
    }
    window.sessionStorage.setItem('followup3.lastEmail', session.profile.email);
    persistLoginProfile(session.profile);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredLoginProfile(): StoredLoginProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(AUTH_PROFILE_KEY);
    if (raw == null) return null;
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (typeof o.id !== 'string' || o.id === '') return null;
    if (typeof o.email !== 'string' || o.email.trim() === '') return null;
    const systemRole =
      typeof o.systemRole === 'string' && o.systemRole.trim() !== '' ? o.systemRole : 'user';
    return { id: o.id, email: o.email.trim().toLowerCase(), systemRole };
  } catch {
    return null;
  }
}

export function readAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const accessToken = window.sessionStorage.getItem(AUTH_ACCESS_TOKEN_KEY);
  const profile = readStoredLoginProfile();
  if (accessToken == null || accessToken.trim() === '' || profile == null) return null;
  const refreshToken = window.sessionStorage.getItem(AUTH_REFRESH_TOKEN_KEY) ?? undefined;
  return {
    accessToken,
    ...(refreshToken !== undefined && refreshToken.trim() !== '' ? { refreshToken } : {}),
    profile,
  };
}

/** Rimuove token e profilo: logout, sessione invalida, ecc. */
export function clearAuthSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_PROFILE_KEY);
    window.sessionStorage.removeItem('followup3.accessToken');
    window.sessionStorage.removeItem('followup3.lastEmail');
    window.sessionStorage.removeItem('followup3.isAdmin');
    window.sessionStorage.removeItem('followup.workspaceId');
    window.sessionStorage.removeItem('followup.projectScope');
    window.sessionStorage.removeItem('followup3.projectsCache');
  } catch {
    /* ignore */
  }
}

export const clearFollowupAuthSession = clearAuthSession;

export function isRecoverableSessionError(error: unknown): boolean {
  const normalized = normalizeApiError(error);
  return (
    normalized.category === 'auth' &&
    ['session_expired', 'invalid_token', 'missing_token'].includes(normalized.reason)
  );
}

export function handleSessionExpired(error: unknown): SessionExpiredNotice {
  const normalized = normalizeApiError(error);
  clearAuthSession();
  return {
    reason: normalized.reason,
    message: 'La sessione è scaduta. Accedi di nuovo per continuare.',
  };
}
