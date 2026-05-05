import {
  type SessionProfile,
  isTokenExpired,
  readSessionProfile,
  readSessionSnapshot,
} from '../core/session/session-store';
import { sessionOrchestrator } from '../core/session/session-orchestrator';
import { clearSessionStorage, writeAccessTokenToStorage, writeRefreshTokenToStorage } from '../core/session/session-storage';
import { normalizeApiError, type ApiErrorReason, type NormalizedApiError } from './httpError';

/** Chiavi sessione condivise tra login, accesso progetti e shell. */
export const AUTH_ACCESS_TOKEN_KEY = 'followup.auth.accessToken';
export const AUTH_REFRESH_TOKEN_KEY = 'followup.auth.refreshToken';
export const AUTH_PROFILE_KEY = 'followup.auth.profile';

export type StoredLoginProfile = SessionProfile;

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
    writeAccessTokenToStorage(session.accessToken);
    if (session.refreshToken != null) {
      writeRefreshTokenToStorage(session.refreshToken);
    }
    window.sessionStorage.setItem('followup3.lastEmail', session.profile.email);
    persistLoginProfile(session.profile);
  } catch {
    /* ignore quota / private mode */
  }
}

export function readStoredLoginProfile(): StoredLoginProfile | null {
  return readSessionProfile();
}

export function readAuthSession(): AuthSession | null {
  return readSessionSnapshot();
}

/** Rimuove token e profilo: logout, sessione invalida, ecc. */
export function clearAuthSession(): void {
  clearSessionStorage('auth-only');
}

export const clearFollowupAuthSession = clearAuthSession;

export function isRecoverableSessionError(error: unknown): boolean {
  const normalized = normalizeApiError(error);
  return (
    normalized.category === 'auth' &&
    ['session_expired', 'invalid_token', 'missing_token'].includes(normalized.reason)
  );
}

export function mapSessionReasonToNotice(reason: ApiErrorReason | 'manual_logout' | 'token_precheck'): string {
  switch (reason) {
    case 'session_expired':
    case 'invalid_token':
    case 'missing_token':
      return 'La sessione è scaduta. Accedi di nuovo per continuare.';
    default:
      return 'Autenticazione non valida. Accedi di nuovo per continuare.';
  }
}

export function handleSessionExpired(error: unknown): SessionExpiredNotice {
  const normalized = normalizeApiError(error);
  void sessionOrchestrator.invalidateSession({
    reason:
      normalized.reason === 'session_expired' ||
      normalized.reason === 'invalid_token' ||
      normalized.reason === 'missing_token'
        ? normalized.reason
        : 'session_expired',
    source: 'project_access',
    redirectToLogin: true,
    strategy: 'auth-only',
  });
  return {
    reason: normalized.reason,
    message: mapSessionReasonToNotice(normalized.reason),
  };
}

export { isTokenExpired };
