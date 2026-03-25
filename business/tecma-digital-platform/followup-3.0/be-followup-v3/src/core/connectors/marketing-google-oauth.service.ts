/**
 * OAuth Google unificato (Ads + Analytics scope) per connettore workspace marketing_google_ads.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { ENV } from "../../config/env.js";
import { HttpError } from "../../types/http.js";
import { saveMarketingGoogleAdsConfig } from "./marketing-analytics-config.service.js";
import {
  resolveGoogleMarketingRedirectUri,
  suggestedGoogleMarketingRedirectUriForDocs,
} from "./marketing-oauth-redirect.util.js";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

const SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/analytics.readonly",
].join(" ");

export type MarketingGoogleOAuthStatePayload = {
  workspaceId: string;
  userId: string;
  exp: number;
  rnd: string;
};

function stateSecret(): string {
  const s = ENV.MARKETING_OAUTH_STATE_SECRET?.trim();
  if (s) return s;
  return ENV.AUTH_JWT_SECRET;
}

export function getGoogleMarketingOAuthClientConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId =
    ENV.GOOGLE_MARKETING_CLIENT_ID?.trim() || ENV.GOOGLE_OAUTH_CLIENT_ID?.trim() || "";
  const clientSecret =
    ENV.GOOGLE_MARKETING_CLIENT_SECRET?.trim() || ENV.GOOGLE_OAUTH_CLIENT_SECRET?.trim() || "";
  const redirectUri = resolveGoogleMarketingRedirectUri();
  const exampleRedirect = suggestedGoogleMarketingRedirectUriForDocs();

  if (!redirectUri) {
    throw new HttpError(
      "Google Marketing OAuth: in produzione/staging impostare GOOGLE_MARKETING_REDIRECT_URI con l’URL pubblico del backend (deve finire con /v1/connectors/marketing-google/callback e coincidere con Google Cloud Console).",
      503,
      "MARKETING_GOOGLE_OAUTH_NOT_CONFIGURED",
      `Esempio: https://api.tuodominio.it/v1/connectors/marketing-google/callback`
    );
  }

  if (!clientId || !clientSecret) {
    throw new HttpError(
      "Google Marketing OAuth: mancano client ID e/o client secret. Impostare GOOGLE_MARKETING_CLIENT_ID e GOOGLE_MARKETING_CLIENT_SECRET (oppure GOOGLE_OAUTH_CLIENT_ID e GOOGLE_OAUTH_CLIENT_SECRET).",
      503,
      "MARKETING_GOOGLE_OAUTH_NOT_CONFIGURED",
      `Registra in Google Cloud Console questo redirect URI (Authorized redirect URIs): ${exampleRedirect}`
    );
  }

  return { clientId, clientSecret, redirectUri };
}

export function signMarketingGoogleOAuthState(payload: MarketingGoogleOAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyMarketingGoogleOAuthState(stateParam: string): MarketingGoogleOAuthStatePayload {
  const parts = stateParam.split(".");
  if (parts.length !== 2) {
    throw new HttpError("Parametro state OAuth non valido", 400);
  }
  const [body, sig] = parts;
  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const a = Buffer.from(sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError("Firma state OAuth non valida", 400);
  }
  let payload: MarketingGoogleOAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as MarketingGoogleOAuthStatePayload;
  } catch {
    throw new HttpError("State OAuth malformato", 400);
  }
  if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
    throw new HttpError("State OAuth scaduto", 400);
  }
  if (!payload.workspaceId || !payload.userId || !payload.rnd) {
    throw new HttpError("State OAuth incompleto", 400);
  }
  return payload;
}

export function buildGoogleMarketingAuthorizationUrl(workspaceId: string, userId: string): string {
  const { clientId, redirectUri } = getGoogleMarketingOAuthClientConfig();
  const exp = Math.floor(Date.now() / 1000) + 10 * 60;
  const rnd = randomBytes(8).toString("hex");
  const state = signMarketingGoogleOAuthState({ workspaceId, userId, exp, rnd });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    state,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `${GOOGLE_AUTH}?${params.toString()}`;
}

export async function completeGoogleMarketingOAuth(code: string, stateParam: string): Promise<string> {
  const payload = verifyMarketingGoogleOAuthState(stateParam);
  const { clientId, clientSecret, redirectUri } = getGoogleMarketingOAuthClientConfig();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  const res = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(`Google token exchange failed: ${res.status} ${text.slice(0, 500)}`, 400);
  }
  let json: { refresh_token?: string };
  try {
    json = JSON.parse(text) as { refresh_token?: string };
  } catch {
    throw new HttpError("Risposta token Google non JSON", 400);
  }
  const refreshToken = json.refresh_token?.trim();
  if (!refreshToken) {
    throw new HttpError(
      "Google non ha restituito refresh_token. Ripeti il collegamento assicurandoti di usare prompt=consent e access_type=offline.",
      400
    );
  }
  await saveMarketingGoogleAdsConfig(payload.workspaceId, { refreshToken });
  return payload.workspaceId;
}
