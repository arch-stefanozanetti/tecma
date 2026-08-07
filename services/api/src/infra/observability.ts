import crypto from 'node:crypto';

import * as Sentry from '@sentry/node';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { withBindings } from '@followup/logger';

import { ApiError, apiErrorBody } from '../lib/apiError.js';
import { requestContext } from './requestContext.js';

export const initSentry = (dsn?: string, tags?: Record<string, string>): void => {
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.05 });
  const scope = Sentry.getGlobalScope();
  scope.setTag('security_domain', 'followup-api');
  if (tags != null) {
    for (const [k, v] of Object.entries(tags)) {
      scope.setTag(k, v);
    }
  }
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

    if (error instanceof z.ZodError) {
      const validationError = new ApiError({
        code: 'ValidationError',
        message: 'Request validation failed',
        status: 400,
        details: error.issues.map((issue) => ({
          field: issue.path.join('.') || 'body',
          messageDetail: [issue.message],
        })),
      });
      logger.warn(
        {
          traceId,
          method: request.method,
          url: request.url,
          status: 400,
          details: validationError.details,
        },
        'request validation failed',
      );
      reply.status(400).send(apiErrorBody(validationError, traceId));
      return;
    }

    // MongoServerError 11000 (duplicate key): mappa a 409 Conflict.
    // Non esponiamo il messaggio Mongo (può contenere il valore conflittuale e leakare info).
    const mongoError = error as {
      code?: number;
      codeName?: string;
      keyValue?: Record<string, unknown>;
    };
    if (mongoError.code === 11000) {
      const conflictField = Object.keys(mongoError.keyValue ?? {})[0] ?? 'unknown';
      logger.warn(
        { traceId, method: request.method, url: request.url, field: conflictField },
        'duplicate key conflict',
      );
      // Per `email` usiamo un messaggio neutro (anti user-enumeration).
      const userFacingMessage =
        conflictField === 'email'
          ? 'A record with this value already exists'
          : `A record with this ${conflictField} already exists`;
      reply.status(409).send({
        error: {
          code: 'DuplicateKey',
          message: userFacingMessage,
          status: 409,
          ...(traceId != null ? { traceId } : {}),
        },
      });
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

    // Errori 4xx con `statusCode` esplicito (es. @fastify/rate-limit -> 429,
    // @fastify/cors -> 401, etc.). Rispettiamo il codice originale invece di
    // mascherarlo come 500.
    const fastifyErr = error as { statusCode?: number; code?: string; message?: string };
    if (
      typeof fastifyErr.statusCode === 'number' &&
      fastifyErr.statusCode >= 400 &&
      fastifyErr.statusCode < 500
    ) {
      logger.warn(
        {
          traceId,
          err: error,
          method: request.method,
          url: request.url,
          status: fastifyErr.statusCode,
        },
        'request rejected (fastify error)',
      );
      reply.status(fastifyErr.statusCode).send({
        error: {
          code: fastifyErr.code ?? 'RequestRejected',
          message: fastifyErr.message ?? 'Request rejected',
          status: fastifyErr.statusCode,
          ...(traceId != null ? { traceId } : {}),
        },
      });
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
