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
