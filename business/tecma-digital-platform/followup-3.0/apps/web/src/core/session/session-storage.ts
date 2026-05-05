import type { SessionStorageStrategy } from './session-types';

const SESSION_STORAGE_AUTH_KEYS = [
  'followup.auth.accessToken',
  'followup.auth.refreshToken',
  'followup.auth.profile',
  'followup3.accessToken',
  'followup3.lastEmail',
  'followup3.isAdmin',
] as const;

const SESSION_STORAGE_FULL_KEYS = [
  ...SESSION_STORAGE_AUTH_KEYS,
  'followup.workspaceId',
  'followup.projectScope',
  'followup3.projectsCache',
  'followup.apiEnvironment',
] as const;

const LOCAL_STORAGE_AUTH_KEYS = ['followup3.rememberedEmail'] as const;

const removeKeysFromStorage = (
  storage: Storage,
  keys: readonly string[],
): void => {
  for (const key of keys) storage.removeItem(key);
};

export const clearSessionStorage = (strategy: SessionStorageStrategy): void => {
  if (typeof window === 'undefined') return;
  try {
    const sessionKeys = strategy === 'full' ? SESSION_STORAGE_FULL_KEYS : SESSION_STORAGE_AUTH_KEYS;
    removeKeysFromStorage(window.sessionStorage, sessionKeys);
    removeKeysFromStorage(window.localStorage, LOCAL_STORAGE_AUTH_KEYS);
  } catch {
    /* ignore private mode / quota */
  }
};

export const readAccessTokenFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem('followup.auth.accessToken');
    return value == null || value.trim() === '' ? null : value;
  } catch {
    return null;
  }
};

export const readRefreshTokenFromStorage = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem('followup.auth.refreshToken');
    return value == null || value.trim() === '' ? null : value;
  } catch {
    return null;
  }
};

export const writeAccessTokenToStorage = (token: string): void => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem('followup.auth.accessToken', token);
  window.sessionStorage.setItem('followup3.accessToken', token);
};

export const writeRefreshTokenToStorage = (token: string): void => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem('followup.auth.refreshToken', token);
};
