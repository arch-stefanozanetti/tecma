import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** Esportato per test unitari su routing pubblico. */
export const isPublicApiPath = (url: string): boolean => {
  if (url === '/v1/health' || url.startsWith('/v1/health?')) return true;
  if (url === '/v1/auth/login' || url.startsWith('/v1/auth/login?')) return true;
  if (url === '/v1/auth/forgot-password' || url.startsWith('/v1/auth/forgot-password?'))
    return true;
  if (url === '/v1/auth/reset-password' || url.startsWith('/v1/auth/reset-password?')) return true;
  if (url === '/v1/auth/invite-accept' || url.startsWith('/v1/auth/invite-accept?')) return true;
  if (url === '/v1/auth/sso-exchange' || url.startsWith('/v1/auth/sso-exchange?')) return true;
  // Refresh e logout viaggiano con il refresh token (cookie o corpo), non con
  // la chiave interna: il browser non deve mai custodire `INTERNAL_API_KEY`.
  if (url === '/v1/auth/refresh' || url.startsWith('/v1/auth/refresh?')) return true;
  if (url === '/v1/auth/logout' || url.startsWith('/v1/auth/logout?')) return true;
  // Swagger UI e OpenAPI JSON sono pubblici SOLO fuori dalla produzione.
  // In produzione restano protetti da x-api-key per non esporre la struttura API.
  const isProd = process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'prod';
  if (!isProd && url.startsWith('/v1/docs')) return true;
  if (!isProd && (url === '/v1/openapi.json' || url.startsWith('/v1/openapi.json?'))) return true;
  return false;
};

const isProdLike = (): boolean =>
  process.env.NODE_ENV === 'production' ||
  process.env.NODE_ENV === 'staging' ||
  process.env.APP_ENV === 'prod' ||
  process.env.APP_ENV === 'staging';

export const isDocumentationPath = (url: string): boolean =>
  url.startsWith('/v1/docs') || url === '/v1/openapi.json' || url.startsWith('/v1/openapi.json?');

/**
 * Richiede header `x-api-key` uguale a `INTERNAL_API_KEY` su tutte le route tranne health, login e Swagger UI.
 * Allineato alle linee guida TECMA (ApiKeyAuth + BearerAuth).
 */
export const apiKeyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isProdLike() && isDocumentationPath(request.url)) {
      return reply.status(404).send({
        error: {
          code: 'NotFound',
          message: 'Not found',
          status: 404,
        },
      });
    }
    if (isPublicApiPath(request.url)) return;
    // I client browser si autenticano con Bearer JWT: la verifica del token
    // (e dei permessi) avviene nelle route. Richiedere anche `x-api-key`
    // costringerebbe a spedire un segreto server-to-server nel frontend.
    const authorization = request.headers['authorization'];
    if (typeof authorization === 'string' && /^Bearer\s+\S+/i.test(authorization)) return;
    const key = request.headers['x-api-key'];
    if (typeof key !== 'string' || key !== app.config.INTERNAL_API_KEY) {
      return reply.status(401).send({
        error: {
          code: 'Unauthorized',
          message: 'Missing or invalid x-api-key',
          status: 401,
        },
      });
    }
  });
});
