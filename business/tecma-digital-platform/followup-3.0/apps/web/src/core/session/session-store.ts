import { readAccessTokenFromStorage, readRefreshTokenFromStorage } from './session-storage';

export type SessionProfile = {
  id: string;
  email: string;
  systemRole: string;
};

export type SessionSnapshot = {
  accessToken: string;
  refreshToken?: string;
  profile: SessionProfile;
};

const PROFILE_STORAGE_KEY = 'followup.auth.profile';

const base64UrlDecode = (value: string): string | null => {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '==='.slice((normalized.length + 3) % 4);
    return atob(padded);
  } catch {
    return null;
  }
};

export const getTokenExpiration = (token: string): Date | null => {
  const parts = token.split('.');
  if (parts.length < 2 || parts[1] == null) return null;
  const decoded = base64UrlDecode(parts[1]);
  if (decoded == null) return null;
  try {
    const payload = JSON.parse(decoded) as { exp?: unknown };
    if (typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
};

export const isTokenExpired = (token: string, skewSeconds = 30): boolean => {
  const expiresAt = getTokenExpiration(token);
  if (expiresAt == null) return false;
  return expiresAt.getTime() <= Date.now() + skewSeconds * 1000;
};

export const readSessionProfile = (): SessionProfile | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as Partial<SessionProfile>;
    if (typeof parsed.id !== 'string' || parsed.id.trim() === '') return null;
    if (typeof parsed.email !== 'string' || parsed.email.trim() === '') return null;
    const role =
      typeof parsed.systemRole === 'string' && parsed.systemRole.trim() !== ''
        ? parsed.systemRole
        : 'user';
    return { id: parsed.id, email: parsed.email.trim().toLowerCase(), systemRole: role };
  } catch {
    return null;
  }
};

export const readSessionSnapshot = (): SessionSnapshot | null => {
  const accessToken = readAccessTokenFromStorage();
  const profile = readSessionProfile();
  if (accessToken == null || profile == null) return null;
  const refreshToken = readRefreshTokenFromStorage();
  return {
    accessToken,
    ...(refreshToken != null ? { refreshToken } : {}),
    profile,
  };
};
