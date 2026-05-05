import {
  buildHttpApiErrorFromFailedFetch,
  buildHttpApiErrorFromResponse,
  DEV_MISSING_API_KEY_CONSOLE,
  normalizeApiError,
} from './httpError';
import { sessionOrchestrator } from '../core/session/session-orchestrator';
import { ENABLE_NEW_SESSION_FLOW } from '../config/featureFlags';

const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed === '') return '/v1';
  if (trimmed === '/') return '';
  return trimmed.replace(/\/+$/, '');
};

const baseUrlHasV1 = (value: string): boolean => /(^|\/)v1($|\/)/.test(value);

/**
 * Garantisce che l’URL base contenga il segmento `v1` (come le route di services/api).
 * Se in `.env` c’è solo l’host (es. `http://localhost:8080`), senza questa normalizzazione
 * le chiamate finiscono su `/auth/login` invece di `/v1/auth/login` (404 o risposta errata).
 */
export function resolveApiBaseUrl(envValue: string | undefined): string {
  const raw = envValue != null && envValue.trim() !== '' ? envValue.trim() : '/v1';
  const normalized = normalizeBaseUrl(raw);
  if (baseUrlHasV1(normalized)) return normalized;
  if (normalized === '' || normalized === '/') return '/v1';
  return `${normalized.replace(/\/+$/, '')}/v1`;
}

const viteApiBaseEnv = import.meta.env.VITE_API_BASE_URL as string | undefined;
export const apiBaseUrl = resolveApiBaseUrl(viteApiBaseEnv);
const defaultApiKey = (import.meta.env.VITE_API_KEY as string | undefined)?.trim() || null;

if (
  import.meta.env.DEV &&
  viteApiBaseEnv != null &&
  viteApiBaseEnv.trim() !== '' &&
  !baseUrlHasV1(normalizeBaseUrl(viteApiBaseEnv.trim()))
) {
  console.warn(
    `[http] VITE_API_BASE_URL senza /v1: le richieste usano la base normalizzata "${apiBaseUrl}" (es. .../v1/auth/login).`,
  );
}

let warnedMissingApiKey = false;

export interface HttpOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
  apiKey?: string | null;
}

export {
  HttpApiError,
  isHttpApiError,
  mapApiErrorToUserCopy,
  normalizeApiError,
  formatUserFacingApiCopy,
  toUserFacingApiCopyFromUnknown,
} from './httpError';

const shouldInvalidateSession = (error: unknown): boolean => {
  if (!ENABLE_NEW_SESSION_FLOW) return false;
  const normalized = normalizeApiError(error);
  return (
    normalized.category === 'auth' &&
    ['session_expired', 'invalid_token', 'missing_token'].includes(normalized.reason)
  );
};

export const http = async <T>(path: string, options: HttpOptions = {}): Promise<T> => {
  const method = options.method ?? 'GET';
  const resolvedApiKey = options.apiKey ?? defaultApiKey;
  if (import.meta.env.DEV && resolvedApiKey == null && !warnedMissingApiKey) {
    warnedMissingApiKey = true;
    console.error(DEV_MISSING_API_KEY_CONSOLE);
  }

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(options.accessToken != null ? { authorization: `Bearer ${options.accessToken}` } : {}),
        ...(resolvedApiKey != null ? { 'x-api-key': resolvedApiKey } : {}),
      },
      credentials: 'include',
      body: options.body == null ? null : JSON.stringify(options.body),
    });
  } catch (err) {
    const apiError = buildHttpApiErrorFromFailedFetch(path, apiBaseUrl, err, method);
    if (shouldInvalidateSession(apiError)) {
      void sessionOrchestrator.invalidateSession({
        reason: 'session_expired',
        source: 'api_interceptor',
        redirectToLogin: true,
        strategy: 'auth-only',
      });
    }
    throw apiError;
  }

  if (!response.ok) {
    const apiError = await buildHttpApiErrorFromResponse(response, path, method);
    if (shouldInvalidateSession(apiError)) {
      const normalized = normalizeApiError(apiError);
      void sessionOrchestrator.invalidateSession({
        reason:
          normalized.reason === 'session_expired' ||
          normalized.reason === 'invalid_token' ||
          normalized.reason === 'missing_token'
            ? normalized.reason
            : 'session_expired',
        source: 'api_interceptor',
        redirectToLogin: true,
        strategy: 'auth-only',
      });
    }
    throw apiError;
  }
  return response.json() as Promise<T>;
};
