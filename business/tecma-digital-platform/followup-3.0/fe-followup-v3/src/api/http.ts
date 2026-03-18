export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/v1";

const STORAGE_ACCESS = "followup3.accessToken";
const STORAGE_REFRESH = "followup3.refreshToken";

const getStorage = (): Storage | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

export const getAccessToken = (): string | null => {
  const s = getStorage();
  return s ? s.getItem(STORAGE_ACCESS) : null;
};

export const getRefreshToken = (): string | null => {
  const s = getStorage();
  return s ? s.getItem(STORAGE_REFRESH) : null;
};

export const setTokens = (accessToken: string, refreshToken?: string): void => {
  const s = getStorage();
  if (!s) return;
  s.setItem(STORAGE_ACCESS, accessToken);
  if (refreshToken !== undefined) {
    s.setItem(STORAGE_REFRESH, refreshToken);
  }
};

export const clearTokens = (): void => {
  const s = getStorage();
  if (!s) return;
  s.removeItem(STORAGE_ACCESS);
  s.removeItem(STORAGE_REFRESH);
};

const isPublicAuthPath = (path: string): boolean =>
  path === "/auth/login" ||
  path === "/auth/sso-exchange" ||
  path === "/auth/refresh" ||
  path === "/auth/logout" ||
  path === "/auth/request-password-reset" ||
  path === "/auth/reset-password" ||
  path === "/auth/set-password-from-invite";

interface RefreshResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: string;
}

const useBssAuth = (): boolean =>
  typeof import.meta.env.VITE_USE_BSS_AUTH === "string" &&
  import.meta.env.VITE_USE_BSS_AUTH.toLowerCase() === "true";

const callRefresh = async (): Promise<RefreshResponse> => {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error("No refresh token");
  if (useBssAuth()) {
    const { refreshBss } = await import("./bssAuthAdapter");
    return refreshBss(refreshToken);
  }
  const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Refresh failed ${res.status}`);
  }
  return res.json() as Promise<RefreshResponse>;
};

const redirectToLogin = (): void => {
  clearTokens();
  const backTo = typeof window !== "undefined" ? encodeURIComponent(window.location.href) : "";
  window.location.replace(`/login${backTo ? `?backTo=${backTo}` : ""}`);
};

const requestJson = async <T>(path: string, options: RequestInit, isRetry = false): Promise<T> => {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (!isPublicAuthPath(path) && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    const hint =
      API_BASE_URL.startsWith("http://localhost") || API_BASE_URL.startsWith("/")
        ? " Verifica che il backend sia avviato (es. porta 8080)."
        : " Verifica che VITE_API_BASE_URL sia corretto per l'ambiente (gateway o backend).";
    throw new Error(
      `Impossibile raggiungere le API (${API_BASE_URL}).${hint} Dettaglio: ${message}`
    );
  }

  if (response.status === 401 && !isPublicAuthPath(path) && getRefreshToken() && !isRetry) {
    try {
      const data = await callRefresh();
      setTokens(data.accessToken, data.refreshToken);
      return requestJson<T>(path, options, true);
    } catch {
      redirectToLogin();
      throw new Error("Sessione scaduta. Effettua di nuovo l'accesso.");
    }
  }

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Errore API HTTP ${response.status} su ${path}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j?.error === "string" && j.error.length > 0) message = j.error;
    } catch {
      /* testo non JSON */
    }
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export const postJson = async <T>(path: string, body: unknown): Promise<T> =>
  requestJson<T>(path, {
    method: "POST",
    body: JSON.stringify(body)
  });

/** POST multipart (es. upload); non imposta Content-Type così il browser aggiunge boundary. */
export const postFormData = async <T>(path: string, form: FormData): Promise<T> => {
  const token = getAccessToken();
  const headers = new Headers();
  if (!isPublicAuthPath(path) && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method: "POST", headers, body: form });
  } catch (error) {
    const message = error instanceof Error ? error.message : "network error";
    throw new Error(`Impossibile raggiungere le API. Dettaglio: ${message}`);
  }
  if (response.status === 401 && !isPublicAuthPath(path) && getRefreshToken()) {
    try {
      const data = await callRefresh();
      setTokens(data.accessToken, data.refreshToken);
      const h2 = new Headers();
      const t2 = getAccessToken();
      if (t2) h2.set("Authorization", `Bearer ${t2}`);
      response = await fetch(`${API_BASE_URL}${path}`, { method: "POST", headers: h2, body: form });
    } catch {
      redirectToLogin();
      throw new Error("Sessione scaduta. Effettua di nuovo l'accesso.");
    }
  }
  if (!response.ok) {
    const text = await response.text();
    let message = text || `Errore API HTTP ${response.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (typeof j?.error === "string" && j.error.length > 0) message = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
};

export const putJson = async <T>(path: string, body: unknown): Promise<T> =>
  requestJson<T>(path, {
    method: "PUT",
    body: JSON.stringify(body)
  });

export const patchJson = async <T>(path: string, body: unknown): Promise<T> =>
  requestJson<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body)
  });

export const getJson = async <T>(path: string): Promise<T> =>
  requestJson<T>(path, {
    method: "GET"
  });

export const deleteJson = async <T>(path: string): Promise<T> =>
  requestJson<T>(path, {
    method: "DELETE"
  });
