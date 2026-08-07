import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';

import { expandForStringOrObjectIdIn } from '../lib/mongoIdentity.js';

export const jwtPlugin = fp(async (app: FastifyInstance) => {
  const rawKid = app.config.AUTH_JWT_KID?.trim();
  const signHeader =
    rawKid != null && rawKid !== '' ? { kid: rawKid, alg: 'HS256' as const } : undefined;

  await app.register(fastifyJwt, {
    secret: app.config.AUTH_JWT_SECRET,
    sign: {
      expiresIn: app.config.AUTH_JWT_EXPIRES_IN,
      ...(signHeader != null ? { header: signHeader } : {}),
    },
  });

  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
      const claims = request.user as
        | {
            sub?: string;
            jti?: string;
            sid?: string;
            atv?: number;
            exp?: number;
          }
        | undefined;
      const userId = typeof claims?.sub === 'string' ? claims.sub : '';
      if (userId.trim() === '') {
        throw new Error('invalid_claims');
      }

      if (typeof claims?.jti === 'string' && claims.jti.trim() !== '') {
        const revoked = await app.mongoDb.collection('tz_authRevokedTokens').findOne({
          jti: claims.jti.trim(),
          expiresAt: { $gt: new Date().toISOString() },
        } as any);
        if (revoked != null) {
          throw new Error('token_revoked');
        }
      }

      if (typeof claims?.sid === 'string' && claims.sid.trim() !== '') {
        const session = await app.mongoDb.collection('tz_authSessions').findOne({
          sessionId: claims.sid.trim(),
          userId,
          expiresAt: { $gt: new Date().toISOString() },
        } as any);
        if (session == null) {
          throw new Error('session_revoked');
        }
      }

      const user = await app.mongoDb.collection('tz_users').findOne({
        _id: { $in: expandForStringOrObjectIdIn([userId]) },
      } as any);
      if (user == null || (user as { status?: string }).status !== 'active') {
        throw new Error('user_inactive');
      }

      const storedAtvRaw = (user as { authTokenVersion?: unknown }).authTokenVersion;
      const storedAtv =
        typeof storedAtvRaw === 'number' && Number.isFinite(storedAtvRaw) && storedAtvRaw >= 0
          ? Math.floor(storedAtvRaw)
          : 0;
      const claimAtv =
        typeof claims?.atv === 'number' && Number.isFinite(claims.atv) ? Math.floor(claims.atv) : 0;
      if (claimAtv !== storedAtv) {
        throw new Error('token_version_mismatch');
      }
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
