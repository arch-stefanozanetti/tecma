/**
 * OAuth Meta (Marketing API) per connettore workspace marketing_meta_ads — token long-lived.
 */
import { randomBytes } from "crypto";
import { ENV } from "../../config/env.js";
import { HttpError } from "../../types/http.js";
import {
  resolveMetaMarketingRedirectUri,
  suggestedMetaMarketingRedirectUriForDocs,
} from "./marketing-oauth-redirect.util.js";
import {
  signMarketingGoogleOAuthState,
  verifyMarketingGoogleOAuthState,
  type MarketingGoogleOAuthStatePayload,
} from "./marketing-google-oauth.service.js";
import { saveMarketingMetaAdsConfig } from "./marketing-analytics-config.service.js";

const FB_GRAPH = "https://graph.facebook.com/v19.0";
const META_OAUTH_DIALOG = "https://www.facebook.com/v19.0/dialog/oauth";

/** Stesso formato state di Google (HMAC su payload) per riuso verifyMarketingGoogleOAuthState */
export type MarketingMetaOAuthStatePayload = MarketingGoogleOAuthStatePayload;

function getMetaMarketingAppConfig(): { appId: string; appSecret: string; redirectUri: string } {
  const appId = ENV.META_MARKETING_APP_ID?.trim() || ENV.META_APP_ID?.trim() || "";
  const appSecret = ENV.META_MARKETING_APP_SECRET?.trim() || ENV.META_APP_SECRET?.trim() || "";
  const redirectUri = resolveMetaMarketingRedirectUri();
  const exampleRedirect = suggestedMetaMarketingRedirectUriForDocs();

  if (!redirectUri) {
    throw new HttpError(
      "Meta Marketing OAuth: in produzione/staging impostare META_MARKETING_REDIRECT_URI con l’URL pubblico del backend (deve finire con /v1/connectors/marketing-meta/callback e coincidere con l’app Meta).",
      503,
      "MARKETING_META_OAUTH_NOT_CONFIGURED",
      `Esempio: https://api.tuodominio.it/v1/connectors/marketing-meta/callback`
    );
  }

  if (!appId || !appSecret) {
    throw new HttpError(
      "Meta Marketing OAuth: mancano App ID e/o App Secret. Impostare META_MARKETING_APP_ID e META_MARKETING_APP_SECRET (oppure META_APP_ID e META_APP_SECRET).",
      503,
      "MARKETING_META_OAUTH_NOT_CONFIGURED",
      `Registra nelle impostazioni OAuth dell’app Meta questo redirect URI: ${exampleRedirect}`
    );
  }

  return { appId, appSecret, redirectUri };
}

export function signMarketingMetaOAuthState(payload: MarketingMetaOAuthStatePayload): string {
  return signMarketingGoogleOAuthState(payload);
}

export function verifyMarketingMetaOAuthState(stateParam: string): MarketingMetaOAuthStatePayload {
  return verifyMarketingGoogleOAuthState(stateParam);
}

export function buildMetaMarketingAuthorizationUrl(workspaceId: string, userId: string): string {
  const { appId, redirectUri } = getMetaMarketingAppConfig();
  const exp = Math.floor(Date.now() / 1000) + 10 * 60;
  const rnd = randomBytes(8).toString("hex");
  const state = signMarketingMetaOAuthState({ workspaceId, userId, exp, rnd });
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: "ads_read,public_profile",
    response_type: "code",
  });
  return `${META_OAUTH_DIALOG}?${params.toString()}`;
}

async function exchangeCodeForShortLivedToken(code: string): Promise<string> {
  const { appId, appSecret, redirectUri } = getMetaMarketingAppConfig();
  const url = new URL(`${FB_GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(`Meta token exchange failed: ${res.status} ${text.slice(0, 500)}`, 400);
  }
  const json = JSON.parse(text) as { access_token?: string };
  const shortLived = json.access_token?.trim();
  if (!shortLived) throw new HttpError("Meta non ha restituito access_token", 400);
  return shortLived;
}

async function exchangeForLongLivedToken(shortLived: string): Promise<string> {
  const { appId, appSecret } = getMetaMarketingAppConfig();
  const url = new URL(`${FB_GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLived);
  const res = await fetch(url.toString());
  const text = await res.text();
  if (!res.ok) {
    throw new HttpError(`Meta long-lived exchange failed: ${res.status} ${text.slice(0, 500)}`, 400);
  }
  const json = JSON.parse(text) as { access_token?: string };
  const longLived = json.access_token?.trim();
  if (!longLived) throw new HttpError("Meta non ha restituito long-lived access_token", 400);
  return longLived;
}

export async function completeMetaMarketingOAuth(code: string, stateParam: string): Promise<string> {
  const payload = verifyMarketingMetaOAuthState(stateParam);
  const shortLived = await exchangeCodeForShortLivedToken(code);
  const longLived = await exchangeForLongLivedToken(shortLived);
  await saveMarketingMetaAdsConfig(payload.workspaceId, { accessToken: longLived });
  return payload.workspaceId;
}
