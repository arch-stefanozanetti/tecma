/**
 * Adapter per l'autenticazione BSS (gateway api.tecmasolutions.com).
 * Usato quando VITE_USE_BSS_AUTH=true e VITE_API_BASE_URL punta al gateway.
 * Contratto BSS: token { tokenType, accessToken, refreshToken, expiresIn }, user { id, firstName, lastName, email, role, TwoFA, project_ids, ... }.
 */
import { getAccessToken } from "./http";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/v1";

/** Base URL del gateway senza suffisso /v1 (per POST /login che è a livello root). */
const getGatewayBaseUrl = (): string => {
  const base = API_BASE_URL.trim();
  if (base.endsWith("/v1")) return base.slice(0, -3);
  if (base.endsWith("/v1/")) return base.slice(0, -4);
  return base;
};

export interface BssLoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn?: string;
  user: { id: string; email: string; role: string | null; isAdmin: boolean };
}

export interface BssMeResponse {
  id: string;
  email: string;
  role: string | null;
  isAdmin: boolean;
}

export interface BssRefreshResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: string;
}

/** Risposta grezza login BSS (come restituita dal gateway). */
interface BssLoginRaw {
  token?: {
    tokenType?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: string;
  };
  user?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
    TwoFA?: boolean;
    project_ids?: string[];
    [key: string]: unknown;
  };
}

/** Risposta grezza getUserByJWT (come restituita dal gateway). */
interface BssUserRaw {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  [key: string]: unknown;
}

function mapBssUserToApp(user: BssUserRaw | undefined): BssMeResponse {
  if (!user) throw new Error("Risposta BSS senza utente");
  const role = user.role ?? null;
  const roleLower = typeof role === "string" ? role.toLowerCase() : "";
  return {
    id: String(user.id ?? ""),
    email: String(user.email ?? ""),
    role,
    isAdmin: roleLower === "admin"
  };
}

/**
 * Login BSS: POST /login con email, password, project_id.
 * Mappa la risposta al formato atteso dall'app (accessToken, refreshToken, user).
 */
export async function loginBss(
  email: string,
  password: string,
  projectId: string
): Promise<BssLoginResponse> {
  const gatewayBase = getGatewayBaseUrl();
  const url = `${gatewayBase}/login`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, project_id: projectId })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Login BSS fallito ${res.status}`);
  }
  const raw = (await res.json()) as BssLoginRaw;
  const token = raw.token;
  const accessToken = token?.accessToken ?? "";
  const refreshToken = token?.refreshToken ?? "";
  if (!accessToken) throw new Error("Risposta BSS senza accessToken");
  const user = mapBssUserToApp(raw.user);
  return {
    accessToken,
    refreshToken,
    expiresIn: token?.expiresIn,
    user
  };
}

/**
 * Me BSS: POST /v1/users/getUserByJWT con Authorization Bearer.
 * Restituisce l'utente nel formato { id, email, role, isAdmin }.
 */
export async function meBss(): Promise<BssMeResponse> {
  const token = getAccessToken();
  if (!token) throw new Error("Nessun token di accesso");
  const url = `${API_BASE_URL}/users/getUserByJWT`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({})
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `getUserByJWT fallito ${res.status}`);
  }
  const raw = (await res.json()) as BssUserRaw;
  return mapBssUserToApp(raw);
}

/**
 * Refresh BSS: POST /v1/auth/refresh-token.
 * Body/header come richiesto dal backend BSS (es. refreshToken in body).
 */
export async function refreshBss(refreshToken: string): Promise<BssRefreshResponse> {
  const url = `${API_BASE_URL}/auth/refresh-token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Refresh BSS fallito ${res.status}`);
  }
  const data = (await res.json()) as {
    tokenType?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: string;
  };
  const accessToken = data?.accessToken ?? (data as unknown as { accessToken?: string }).accessToken;
  if (!accessToken) throw new Error("Risposta refresh BSS senza accessToken");
  return {
    accessToken,
    refreshToken: data?.refreshToken,
    expiresIn: data?.expiresIn
  };
}
