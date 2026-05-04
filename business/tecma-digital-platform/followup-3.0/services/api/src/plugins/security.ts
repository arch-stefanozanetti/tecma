import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { resolveRateLimitMax } from '@followup/shared-config';

/** Path senza query, slash ripetuti normalizzati (proxy / client vari). */
const normalizeUrlPath = (url: string): string => {
  const raw = url.split('?')[0] ?? '';
  let p = raw.replace(/\/+/g, '/');
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p === '' ? '/' : p;
};

/** Login/refresh non consumano il bucket globale (staging/prod). */
const isUnmeteredAuthPost = (request: FastifyRequest): boolean => {
  if (request.method !== 'POST') return false;
  const path = normalizeUrlPath(request.url);
  return path === '/v1/auth/login' || path === '/v1/auth/refresh';
};

const shouldSkipGlobalRateLimit = (config: { NODE_ENV: string }): boolean => {
  if (process.env.API_DISABLE_RATE_LIMIT === 'true' || process.env.API_DISABLE_RATE_LIMIT === '1') {
    return true;
  }
  /* In locale tutto passa dallo stesso IP → il bucket globale satura subito (429 anche sul login). */
  return config.NODE_ENV === 'development' || config.NODE_ENV === 'test';
};

const isLocalDevOrigin = (origin: string): boolean => {
  try {
    const u = new URL(origin);
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
};

export const securityPlugin = fp(async (app: FastifyInstance) => {
  await app.register(import('@fastify/helmet'), {
    global: true,
    contentSecurityPolicy: false,
  });

  await app.register(import('@fastify/cors'), {
    origin: (origin, callback) => {
      if (origin == null || origin === '') {
        callback(null, true);
        return;
      }
      const env = app.config.NODE_ENV;
      if ((env === 'development' || env === 'test') && isLocalDevOrigin(origin)) {
        callback(null, origin);
        return;
      }
      if (app.config.corsOrigins.includes(origin)) {
        callback(null, origin);
        return;
      }
      callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    /** Obbligatorio se il frontend chiama l’API su un’origine diversa (es. :5177 → :8080): senza questo il browser non invia `x-api-key` dopo il preflight. */
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'X-Api-Key'],
  });

  if (!shouldSkipGlobalRateLimit(app.config)) {
    await app.register(import('@fastify/rate-limit'), {
      global: true,
      max: resolveRateLimitMax(app.config),
      timeWindow: '1 minute',
      keyGenerator: (request) => request.ip,
      allowList: isUnmeteredAuthPost,
    });
  }
});
