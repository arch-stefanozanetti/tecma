import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';

export const jwtPlugin = fp(async (app: FastifyInstance) => {
  await app.register(import('@fastify/jwt'), {
    secret: app.config.AUTH_JWT_SECRET,
    sign: { expiresIn: app.config.AUTH_JWT_EXPIRES_IN },
  });

  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch {
      return reply.status(401).send({
        error: {
          code: 'Unauthorized',
          message: 'Missing or invalid token',
          status: 401,
        },
      });
    }
  });
});
