import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export const REFRESH_TOKEN_COOKIE_NAME = 'followup_refresh_token';

const isSecureCookieEnv = (app: FastifyInstance): boolean =>
  app.config.NODE_ENV === 'staging' || app.config.NODE_ENV === 'production';

/**
 * Il frontend Lovable vive su un'origine diversa dall'API (`*.lovable.app` vs
 * Render): con `strict` il browser non rimanda mai il cookie di refresh e la
 * sessione muore alla scadenza dell'access token. In prod/staging serve quindi
 * `none` + `secure` + `partitioned` (CHIPS, per il blocco dei cookie di terze
 * parti). In dev/test resta `lax`, che funziona su localhost.
 */
const refreshCookieSameSite = (app: FastifyInstance): 'none' | 'lax' =>
  app.config.NODE_ENV === 'production' || app.config.NODE_ENV === 'staging' ? 'none' : 'lax';

const refreshTokenMaxAgeSeconds = (app: FastifyInstance): number =>
  app.config.AUTH_REFRESH_EXPIRES_DAYS * 24 * 60 * 60;

export const setRefreshTokenCookie = (
  app: FastifyInstance,
  reply: FastifyReply,
  refreshToken: string,
): void => {
  reply.setCookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
    httpOnly: true,
    secure: isSecureCookieEnv(app),
    sameSite: refreshCookieSameSite(app),
    partitioned: isSecureCookieEnv(app),
    path: '/v1/auth',
    maxAge: refreshTokenMaxAgeSeconds(app),
  });
};

export const clearRefreshTokenCookie = (app: FastifyInstance, reply: FastifyReply): void => {
  reply.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: isSecureCookieEnv(app),
    sameSite: refreshCookieSameSite(app),
    partitioned: isSecureCookieEnv(app),
    path: '/v1/auth',
  });
};

export const readRefreshTokenCookie = (request: FastifyRequest): string | null => {
  const token = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Quando il browser blocca i cookie di terze parti (iframe della preview
 * Lovable), il client chiede il refresh token nel corpo della risposta con
 * l'header `x-token-delivery: body` e lo custodisce lui.
 */
export const wantsTokenInBody = (request: FastifyRequest): boolean => {
  const header = request.headers['x-token-delivery'];
  const value = Array.isArray(header) ? header[0] : header;
  return typeof value === 'string' && value.trim().toLowerCase() === 'body';
};

/**
 * Legge il refresh token dal cookie oppure, per i client che usano la consegna
 * nel corpo, dal campo `refreshToken` della richiesta.
 */
export const readRefreshToken = (request: FastifyRequest): string | null => {
  const fromCookie = readRefreshTokenCookie(request);
  if (fromCookie != null) return fromCookie;
  const body = request.body as { refreshToken?: unknown } | undefined;
  const fromBody = body?.refreshToken;
  if (typeof fromBody !== 'string') return null;
  const trimmed = fromBody.trim();
  return trimmed === '' ? null : trimmed;
};
