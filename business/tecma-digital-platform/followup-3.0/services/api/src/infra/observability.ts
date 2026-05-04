import crypto from 'node:crypto';

import * as Sentry from '@sentry/node';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { withBindings } from '@followup/logger';

import { requestContext } from './requestContext.js';

export const initSentry = (dsn?: string): void => {
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.05 });
};

export const installRequestContextHooks = (app: FastifyInstance, logger: any): void => {
  app.addHook('onRequest', (request: FastifyRequest, reply: FastifyReply, done) => {
    const traceId =
      typeof request.headers['x-request-id'] === 'string'
        ? request.headers['x-request-id']
        : crypto.randomUUID();

    requestContext.run({ traceId }, () => {
      reply.header('x-request-id', traceId);
      withBindings({ traceId }).info(
        { method: request.method, url: request.url },
        'incoming request',
      );
      done();
    });
  });

  app.setErrorHandler((error, request, reply) => {
    const ctx = requestContext.get();
    logger.error(
      { traceId: ctx?.traceId, err: error, method: request.method, url: request.url },
      'unhandled request error',
    );

    reply.status(500).send({
      error: {
        code: 'InternalServerError',
        message: 'Internal server error',
        status: 500,
        tId: ctx?.traceId,
      },
    });
  });
};
