/**
 * OIDC Authorization Code + PKCE verso Keycloak (client pubblico, senza secret nel browser).
 * Il backend verifica l'id_token su POST /v1/auth/sso-exchange (JWKS Keycloak + issuer/audience).
 */

import { spaAbsolutePath } from "../lib/spaPath";

const STORAGE_STATE = "followup3.oidc_state";
const STORAGE_VERIFIER = "followup3.oidc_code_verifier";
const STORAGE_BACK_TO = "followup3.oidc_back_to";

function envTrim(key: keyof ImportMetaEnv): string {
  const v = import.meta.env[key];
  return typeof v === "string" ? v.trim() : "";
}

export function isKeycloakOidcConfigured(): boolean {
  const base = envTrim("VITE_KEYCLOAK_URL");
  const realm = envTrim("VITE_KEYCLOAK_REALM");
  const clientId = envTrim("VITE_KEYCLOAK_CLIENT_ID");
  return Boolean(base && realm && clientId);
}

function keycloakBasePath(): string {
  const base = envTrim("VITE_KEYCLOAK_URL").replace(/\/+$/, "");
  const realm = envTrim("VITE_KEYCLOAK_REALM");
  return `${base}/realms/${encodeURIComponent(realm)}`;
}

export function getKeycloakCallbackPath(): string {
  const raw = envTrim("VITE_KEYCLOAK_REDIRECT_PATH") || "/login/keycloak-callback";
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function randomUrlSafeString(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Avvia il login OIDC: salva PKCE e redirect a Keycloak.
 * @param backTo path o URL dopo login (es. da query ?backTo=)
 */
export function startKeycloakOidcLogin(backTo: string): void {
  if (!isKeycloakOidcConfigured()) return;

  const clientId = envTrim("VITE_KEYCLOAK_CLIENT_ID");
  const scope = envTrim("VITE_KEYCLOAK_SCOPE") || "openid email profile";
  const callbackPath = getKeycloakCallbackPath();

  const state = randomUrlSafeString(24);
  const codeVerifier = randomUrlSafeString(48);

  sessionStorage.setItem(STORAGE_STATE, state);
  sessionStorage.setItem(STORAGE_VERIFIER, codeVerifier);
  sessionStorage.setItem(STORAGE_BACK_TO, backTo);

  const origin = window.location.origin;
  const redirectUri = `${origin}${spaAbsolutePath(callbackPath)}`;

  void sha256Base64Url(codeVerifier).then((codeChallenge) => {
    const authUrl = new URL(`${keycloakBasePath()}/protocol/openid-connect/auth`);
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scope);
    authUrl.searchParams.set("state", state);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");
    window.location.assign(authUrl.toString());
  });
}

export type KeycloakOidcCallbackResult =
  | { ok: true; idToken: string }
  | { ok: false; error: string };

/**
 * Scambia il `code` della callback con l'id_token (Authorization Code + PKCE).
 */
export async function exchangeKeycloakAuthorizationCode(searchParams: URLSearchParams): Promise<KeycloakOidcCallbackResult> {
  if (!isKeycloakOidcConfigured()) {
    return { ok: false, error: "Keycloak OIDC non configurato." };
  }

  const err = searchParams.get("error");
  const errDesc = searchParams.get("error_description");
  if (err) {
    return { ok: false, error: errDesc || err };
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return { ok: false, error: "Risposta OAuth non valida (mancano code o state)." };
  }

  const expectedState = sessionStorage.getItem(STORAGE_STATE);
  const codeVerifier = sessionStorage.getItem(STORAGE_VERIFIER);
  sessionStorage.removeItem(STORAGE_STATE);
  sessionStorage.removeItem(STORAGE_VERIFIER);

  if (!expectedState || state !== expectedState || !codeVerifier) {
    return { ok: false, error: "Sessione SSO scaduta o non valida. Riprova dal login." };
  }

  const clientId = envTrim("VITE_KEYCLOAK_CLIENT_ID");
  const callbackPath = getKeycloakCallbackPath();
  const redirectUri = `${window.location.origin}${spaAbsolutePath(callbackPath)}`;

  const tokenUrl = `${keycloakBasePath()}/protocol/openid-connect/token`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier
  });

  let res: Response;
  try {
    res = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Errore di rete verso Keycloak." };
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const desc = typeof json.error_description === "string" ? json.error_description : JSON.stringify(json);
    return { ok: false, error: desc || `Token endpoint: ${res.status}` };
  }

  const idToken = json.id_token;
  if (typeof idToken !== "string" || !idToken) {
    return { ok: false, error: "Risposta token senza id_token. Verifica lo scope (serve openid)." };
  }

  return { ok: true, idToken };
}

export function consumeStoredOidcBackTo(): string {
  const v = sessionStorage.getItem(STORAGE_BACK_TO);
  sessionStorage.removeItem(STORAGE_BACK_TO);
  if (v && v.length > 0) return v;
  return "/";
}
