/**
 * Errore API lato client: unico confine per classificazione (by design, niente copy duplicato nelle feature).
 */
export type HttpApiErrorKind = 'network' | 'unauthorized' | 'rate_limited' | 'http';

/** Sotto-tipo 401: chiave interna vs sessione JWT vs non classificato. */
export type UnauthorizedBecause = 'api_key' | 'session' | 'unknown';

export type ApiErrorCategory = 'auth' | 'permission' | 'tenant' | 'system' | 'network' | 'unknown';

export type ApiErrorReason =
  | 'session_expired'
  | 'invalid_token'
  | 'missing_token'
  | 'insufficient_auth'
  | 'tenant_mismatch'
  | 'maintenance'
  | 'network_error'
  | 'server_error'
  | 'unknown';

export type NormalizedApiError = {
  category: ApiErrorCategory;
  reason: ApiErrorReason;
  httpStatus?: number;
  endpoint?: string;
  method?: string;
  requestId?: string;
  traceId?: string;
  userMessage: string;
  technicalMessage?: string;
  originalError?: unknown;
};

export class HttpApiError extends Error {
  override readonly name = 'HttpApiError';

  readonly kind: HttpApiErrorKind;

  readonly path: string;

  readonly status?: number;

  readonly serverMessage?: string;

  readonly code?: string;

  readonly unauthorizedBecause?: UnauthorizedBecause;

  readonly method?: string;

  readonly requestId?: string;

  readonly traceId?: string;

  constructor(
    briefMessage: string,
    init: {
      kind: HttpApiErrorKind;
      path: string;
      status?: number;
      serverMessage?: string;
      code?: string;
      unauthorizedBecause?: UnauthorizedBecause;
      method?: string;
      requestId?: string;
      traceId?: string;
    },
  ) {
    super(briefMessage);
    this.kind = init.kind;
    this.path = init.path;
    if (init.status !== undefined) this.status = init.status;
    if (init.serverMessage !== undefined) this.serverMessage = init.serverMessage;
    if (init.code !== undefined) this.code = init.code;
    if (init.unauthorizedBecause !== undefined) this.unauthorizedBecause = init.unauthorizedBecause;
    if (init.method !== undefined) this.method = init.method;
    if (init.requestId !== undefined) this.requestId = init.requestId;
    if (init.traceId !== undefined) this.traceId = init.traceId;
  }
}

export const isHttpApiError = (e: unknown): e is HttpApiError => e instanceof HttpApiError;

/** Hint unico per allineamento chiave e base URL (grep: deve restare centralizzato qui). */
export const LOCAL_API_SETUP_HINT =
  'In locale: in apps/web/.env imposta `VITE_API_KEY` uguale a `INTERNAL_API_KEY` in services/api/.env (≥16 caratteri), oppure lasciala vuota e avvia Vite da apps/web per ereditarla (vite.config.ts). Allinea `VITE_API_BASE_URL` alla root con `/v1` o al proxy (es. `/v1` o `http://localhost:8080/v1`).';

export const LOCAL_API_NETWORK_HINT =
  'Verifica che il backend sia in esecuzione e che `VITE_API_BASE_URL` sia corretto (proxy verso l’API o URL completo con `/v1`).';

export const LOCAL_RATE_LIMIT_HINT =
  'In locale: su services/api puoi usare `NODE_ENV=development` o `API_DISABLE_RATE_LIMIT=1` nel `.env`, secondo la configurazione del progetto.';

/** Messaggio console in dev (stesso contenuto sostanziale del setup locale). */
export const DEV_MISSING_API_KEY_CONSOLE = `[followup] Manca la chiave API per il frontend (header x-api-key). ${LOCAL_API_SETUP_HINT}`;

type ApiErrorBody = {
  error?: { message?: string; code?: string; status?: number; traceId?: string; details?: unknown };
};

const isPublicAuthPath = (path: string): boolean =>
  path === '/auth/login' ||
  path === '/auth/refresh' ||
  path === '/auth/logout' ||
  path === '/auth/mfa/verify' ||
  path === '/auth/sso-exchange' ||
  path === '/auth/request-password-reset' ||
  path === '/auth/reset-password' ||
  path === '/auth/set-password-from-invite';

const classifyUnauthorized = (
  path: string,
  serverMessage: string | undefined,
  _code: string | undefined,
): UnauthorizedBecause => {
  const msg = (serverMessage ?? '').toLowerCase();
  if (msg.includes('x-api-key') || msg.includes('missing or invalid x-api-key')) return 'api_key';
  if (msg.includes('token') || msg.includes('expired') || msg.includes('not authenticated'))
    return 'session';
  if (path.startsWith('/auth/')) return 'session';
  return 'unknown';
};

const parseErrorBody = (
  text: string,
): { serverMessage?: string; code?: string; traceId?: string } => {
  if (!text.trim()) return {};
  try {
    const body = JSON.parse(text) as ApiErrorBody;
    const msg = body.error?.message;
    const code = body.error?.code;
    const traceId = body.error?.traceId;
    const out: { serverMessage?: string; code?: string; traceId?: string } = {};
    if (typeof msg === 'string' && msg.trim() !== '') out.serverMessage = msg.trim();
    if (typeof code === 'string' && code.trim() !== '') out.code = code.trim();
    if (typeof traceId === 'string' && traceId.trim() !== '') out.traceId = traceId.trim();
    return out;
  } catch {
    return {};
  }
};

export const buildHttpApiErrorFromFailedFetch = (
  path: string,
  apiBaseUrl: string,
  cause: unknown,
  method?: string,
): HttpApiError => {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new HttpApiError(`Impossibile raggiungere le API (${apiBaseUrl}).`, {
    kind: 'network',
    path,
    serverMessage: detail,
    ...(method !== undefined ? { method } : {}),
  });
};

export const buildHttpApiErrorFromResponse = async (
  response: Response,
  path: string,
  method?: string,
): Promise<HttpApiError> => {
  const status = response.status;
  const text = await response.text();
  const { serverMessage, code, traceId } = parseErrorBody(text);
  const requestId = response.headers?.get?.('x-request-id') ?? undefined;
  const common = {
    ...(serverMessage !== undefined ? { serverMessage } : {}),
    ...(code !== undefined ? { code } : {}),
    ...(method !== undefined ? { method } : {}),
    ...(requestId !== undefined ? { requestId } : {}),
    ...(traceId !== undefined ? { traceId } : {}),
  };

  if (status === 429) {
    const brief = serverMessage ?? 'Troppe richieste (429).';
    return new HttpApiError(brief, {
      kind: 'rate_limited',
      path,
      status,
      ...common,
    });
  }

  if (status === 401 && !isPublicAuthPath(path)) {
    const because = classifyUnauthorized(path, serverMessage, code);
    const brief = serverMessage ?? `Richiesta non autorizzata (HTTP 401) su ${path}.`;
    return new HttpApiError(brief, {
      kind: 'unauthorized',
      path,
      status,
      ...common,
      unauthorizedBecause: because,
    });
  }

  const brief = serverMessage ?? `HTTP ${status}: ${path}`;
  return new HttpApiError(brief, {
    kind: 'http',
    path,
    status,
    ...common,
  });
};

const sessionReasonFromMessage = (message: string | undefined): ApiErrorReason => {
  const msg = (message ?? '').toLowerCase();
  if (msg.includes('expired')) return 'session_expired';
  if (msg.includes('invalid')) return 'invalid_token';
  if (msg.includes('missing')) return 'missing_token';
  if (msg.includes('token')) return 'invalid_token';
  return 'insufficient_auth';
};

const isTenantMessage = (message: string | undefined): boolean => {
  const msg = (message ?? '').toLowerCase();
  return (
    msg.includes('tenant') ||
    msg.includes('workspace') ||
    msg.includes('project') ||
    msg.includes('isolat')
  );
};

export const normalizeApiError = (error: unknown): NormalizedApiError => {
  if (isHttpApiError(error)) {
    const technicalMessage = error.serverMessage ?? error.message;
    const base = {
      endpoint: error.path,
      technicalMessage,
      originalError: error,
      ...(error.status !== undefined ? { httpStatus: error.status } : {}),
      ...(error.method !== undefined ? { method: error.method } : {}),
      ...(error.requestId !== undefined ? { requestId: error.requestId } : {}),
      ...(error.traceId !== undefined ? { traceId: error.traceId } : {}),
    };

    if (error.kind === 'network') {
      return {
        ...base,
        category: 'network',
        reason: 'network_error',
        userMessage: 'Non riusciamo a collegarci al servizio. Riprova tra qualche secondo.',
      };
    }

    if (error.kind === 'unauthorized') {
      if (error.unauthorizedBecause === 'session') {
        return {
          ...base,
          category: 'auth',
          reason: sessionReasonFromMessage(technicalMessage),
          userMessage: 'La sessione è scaduta. Accedi di nuovo per continuare.',
        };
      }

      return {
        ...base,
        category: 'auth',
        reason: 'insufficient_auth',
        userMessage: 'Non è stato possibile verificare l’accesso. Riprova o accedi di nuovo.',
      };
    }

    if (error.status === 403) {
      return {
        ...base,
        category: isTenantMessage(technicalMessage) ? 'tenant' : 'permission',
        reason: isTenantMessage(technicalMessage) ? 'tenant_mismatch' : 'insufficient_auth',
        userMessage: 'Non hai i permessi per completare questa operazione.',
      };
    }

    if (error.status != null && error.status >= 500) {
      return {
        ...base,
        category: 'system',
        reason: error.status === 503 ? 'maintenance' : 'server_error',
        userMessage: 'Il servizio non è disponibile in questo momento. Riprova tra poco.',
      };
    }

    return {
      ...base,
      category: 'unknown',
      reason: 'unknown',
      userMessage: 'Qualcosa non ha funzionato. Riprova tra qualche secondo.',
    };
  }

  return {
    category: 'unknown',
    reason: 'unknown',
    userMessage: 'Qualcosa non ha funzionato. Riprova tra qualche secondo.',
    technicalMessage: error instanceof Error ? error.message : String(error),
    originalError: error,
  };
};

export type UserFacingApiCopy = {
  title: string;
  hint?: string;
};

/**
 * Unico mapper testo per UI: le feature non duplicano spiegazioni env/401/rete.
 */
export const mapApiErrorToUserCopy = (err: HttpApiError): UserFacingApiCopy => {
  const normalized = normalizeApiError(err);
  if (err.kind === 'network') {
    return {
      title: normalized.userMessage,
      hint: LOCAL_API_NETWORK_HINT,
    };
  }

  if (err.kind === 'rate_limited') {
    return {
      title: err.serverMessage ?? err.message,
      hint: LOCAL_RATE_LIMIT_HINT,
    };
  }

  if (err.kind === 'unauthorized') {
    if (err.unauthorizedBecause === 'session') {
      return {
        title: normalized.userMessage,
      };
    }
    return {
      title: err.serverMessage ?? err.message,
      hint: LOCAL_API_SETUP_HINT,
    };
  }

  return {
    title: err.serverMessage ?? err.message,
  };
};

/** Formatta titolo + hint in un unico blocco per componenti che espongono una sola stringa. */
export const formatUserFacingApiCopy = (copy: UserFacingApiCopy): string =>
  copy.hint != null && copy.hint.trim() !== '' ? `${copy.title}\n\n${copy.hint}` : copy.title;

export const toUserFacingApiCopyFromUnknown = (e: unknown): UserFacingApiCopy => {
  if (isHttpApiError(e)) return mapApiErrorToUserCopy(e);
  return { title: e instanceof Error ? e.message : 'Errore sconosciuto.' };
};
