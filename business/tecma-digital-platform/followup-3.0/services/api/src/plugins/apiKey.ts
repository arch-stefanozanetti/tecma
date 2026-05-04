import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/** Esportato per test unitari su routing pubblico. */
export const isPublicApiPath = (url: string): boolean => {
  if (url === '/v1/health' || url.startsWith('/v1/health?')) return true;
  if (url === '/v1/auth/login' || url.startsWith('/v1/auth/login?')) return true;
  if (url.startsWith('/v1/docs')) return true;
  if (url === '/v1/openapi.json' || url.startsWith('/v1/openapi.json?')) return true;
  return false;
};

/**
 * Richiede header `x-api-key` uguale a `INTERNAL_API_KEY` su tutte le route tranne health, login e Swagger UI.
 * Allineato alle linee guida TECMA (ApiKeyAuth + BearerAuth).
 */
export const apiKeyPlugin = fp(async (app: FastifyInstance) => {
  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicApiPath(request.url)) return;
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
