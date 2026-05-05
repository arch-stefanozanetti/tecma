import crypto from 'node:crypto';

import * as Sentry from '@sentry/node';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { withBindings } from '@followup/logger';

import { ApiError, apiErrorBody } from '../lib/apiError.js';
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
    const traceId = ctx?.traceId;

    if (error instanceof ApiError) {
      logger.warn(
        { traceId, err: error, method: request.method, url: request.url, status: error.status },
        'request rejected',
      );
      reply.status(error.status).send(apiErrorBody(error, traceId));
      return;
    }

    const validationIssues = (error as { validation?: unknown }).validation;
    if (Array.isArray(validationIssues)) {
      const validationError = new ApiError({
        code: 'ValidationError',
        message: 'Request validation failed',
        status: 400,
        details: (
          validationIssues as Array<{
            instancePath?: string;
            schemaPath?: string;
            message?: string;
          }>
        ).map((issue) => ({
          field: issue.instancePath || issue.schemaPath || '',
          messageDetail: [issue.message ?? 'Invalid value'],
        })),
      });
      reply.status(400).send(apiErrorBody(validationError, traceId));
      return;
    }

    logger.error(
      { traceId, err: error, method: request.method, url: request.url },
      'unhandled request error',
    );

    reply.status(500).send({
      error: {
        code: 'InternalServerError',
        message: 'Internal server error',
        status: 500,
        ...(traceId != null ? { traceId } : {}),
      },
    });
  });
};
