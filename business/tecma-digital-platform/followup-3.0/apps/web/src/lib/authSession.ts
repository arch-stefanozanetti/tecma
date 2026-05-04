/** Chiavi sessione condivise tra login, accesso progetti e shell. */
export const AUTH_ACCESS_TOKEN_KEY = 'followup.auth.accessToken';
export const AUTH_REFRESH_TOKEN_KEY = 'followup.auth.refreshToken';
export const AUTH_PROFILE_KEY = 'followup.auth.profile';

export type StoredLoginProfile = {
  id: string;
  email: string;
  systemRole: string;
};

export function persistLoginProfile(profile: StoredLoginProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
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
    const systemRole = typeof o.systemRole === 'string' && o.systemRole.trim() !== '' ? o.systemRole : 'user';
    return { id: o.id, email: o.email.trim().toLowerCase(), systemRole };
  } catch {
    return null;
  }
}

/** Rimuove token e profilo: logout, sessione invalida, ecc. */
export function clearFollowupAuthSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(AUTH_ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
    window.sessionStorage.removeItem(AUTH_PROFILE_KEY);
    window.sessionStorage.removeItem('followup3.accessToken');
    window.sessionStorage.removeItem('followup3.lastEmail');
    window.sessionStorage.removeItem('followup3.isAdmin');
    window.sessionStorage.removeItem('followup.projectScope');
    window.sessionStorage.removeItem('followup3.projectsCache');
  } catch {
    /* ignore */
  }
}
