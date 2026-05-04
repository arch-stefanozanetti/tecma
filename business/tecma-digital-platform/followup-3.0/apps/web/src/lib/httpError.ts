/**
 * Errore API lato client: unico confine per classificazione (by design, niente copy duplicato nelle feature).
 */
export type HttpApiErrorKind = 'network' | 'unauthorized' | 'rate_limited' | 'http';

/** Sotto-tipo 401: chiave interna vs sessione JWT vs non classificato. */
export type UnauthorizedBecause = 'api_key' | 'session' | 'unknown';

export class HttpApiError extends Error {
  override readonly name = 'HttpApiError';

  readonly kind: HttpApiErrorKind;

  readonly path: string;

  readonly status?: number;

  readonly serverMessage?: string;

  readonly code?: string;

  readonly unauthorizedBecause?: UnauthorizedBecause;

  constructor(
    briefMessage: string,
    init: {
      kind: HttpApiErrorKind;
      path: string;
      status?: number;
      serverMessage?: string;
      code?: string;
      unauthorizedBecause?: UnauthorizedBecause;
    },
  ) {
    super(briefMessage);
    this.kind = init.kind;
    this.path = init.path;
    if (init.status !== undefined) this.status = init.status;
    if (init.serverMessage !== undefined) this.serverMessage = init.serverMessage;
    if (init.code !== undefined) this.code = init.code;
    if (init.unauthorizedBecause !== undefined) this.unauthorizedBecause = init.unauthorizedBecause;
  }
}

export const isHttpApiError = (e: unknown): e is HttpApiError =>
  e instanceof HttpApiError;

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
  error?: { message?: string; code?: string; status?: number };
  message?: string;
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
  if (msg.includes('token') || msg.includes('not authenticated')) return 'session';
  if (path.startsWith('/auth/')) return 'session';
  return 'unknown';
};

const parseErrorBody = (text: string): { serverMessage?: string; code?: string } => {
  if (!text.trim()) return {};
  try {
    const body = JSON.parse(text) as ApiErrorBody;
    const msg = body.error?.message ?? body.message;
    const code = body.error?.code;
    const out: { serverMessage?: string; code?: string } = {};
    if (typeof msg === 'string' && msg.trim() !== '') out.serverMessage = msg.trim();
    if (typeof code === 'string' && code.trim() !== '') out.code = code.trim();
    return out;
  } catch {
    return {};
  }
};

export const buildHttpApiErrorFromFailedFetch = (
  path: string,
  apiBaseUrl: string,
  cause: unknown,
): HttpApiError => {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new HttpApiError(`Impossibile raggiungere le API (${apiBaseUrl}).`, {
    kind: 'network',
    path,
    serverMessage: detail,
  });
};

export const buildHttpApiErrorFromResponse = async (
  response: Response,
  path: string,
): Promise<HttpApiError> => {
  const status = response.status;
  const text = await response.text();
  const { serverMessage, code } = parseErrorBody(text);

  if (status === 429) {
    const brief =
      serverMessage ??
      'Troppe richieste (429).';
    return new HttpApiError(brief, {
      kind: 'rate_limited',
      path,
      status,
      ...(serverMessage !== undefined ? { serverMessage } : {}),
      ...(code !== undefined ? { code } : {}),
    });
  }

  if (status === 401 && !isPublicAuthPath(path)) {
    const because = classifyUnauthorized(path, serverMessage, code);
    const brief =
      serverMessage ?? `Richiesta non autorizzata (HTTP 401) su ${path}.`;
    return new HttpApiError(brief, {
      kind: 'unauthorized',
      path,
      status,
      ...(serverMessage !== undefined ? { serverMessage } : {}),
      ...(code !== undefined ? { code } : {}),
      unauthorizedBecause: because,
    });
  }

  const brief = serverMessage ?? `HTTP ${status}: ${path}`;
  return new HttpApiError(brief, {
    kind: 'http',
    path,
    status,
    ...(serverMessage !== undefined ? { serverMessage } : {}),
    ...(code !== undefined ? { code } : {}),
  });
};

export type UserFacingApiCopy = {
  title: string;
  hint?: string;
};

/**
 * Unico mapper testo per UI: le feature non duplicano spiegazioni env/401/rete.
 */
export const mapApiErrorToUserCopy = (err: HttpApiError): UserFacingApiCopy => {
  if (err.kind === 'network') {
    return {
      title: 'Impossibile raggiungere le API.',
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
        title: err.serverMessage ?? err.message,
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
