import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';

/**
 * Si registra SEMPRE il plugin `@fastify/rate-limit` perche le rotte sensibili
 * dichiarano `config.rateLimit` per-route (vedi `lib/rateLimitProfiles.ts`).
 * Per non rompere la dev-experience il limite globale e fissato a 10000/min in
 * `development` / `test` (di fatto disattivato), mentre in `staging`/`production`
 * resta `resolveRateLimitMax(config)` (default 100/min, override via API_RATE_LIMIT_MAX).
 *
 * `API_DISABLE_RATE_LIMIT=true|1` resta come emergency switch globale (skip plugin).
 */
const isRateLimitEmergencyDisabled = (): boolean =>
  process.env.API_DISABLE_RATE_LIMIT === 'true' || process.env.API_DISABLE_RATE_LIMIT === '1';

const resolveGlobalRateLimitMax = (config: {
  NODE_ENV: string;
  API_RATE_LIMIT_MAX?: number;
}): number => {
  if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') return 10_000;
  if (config.API_RATE_LIMIT_MAX != null) return config.API_RATE_LIMIT_MAX;
  return 100;
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
  const isDevLike = app.config.NODE_ENV === 'development' || app.config.NODE_ENV === 'test';
  /** Header `Permissions-Policy` impostato anche in `onSend` (allineato alla policy precedente). */
  await app.register(fastifyHelmet, {
    global: true,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        scriptSrc: ["'self'"],
        connectSrc: isDevLike ? ["'self'", 'http://localhost:*', 'ws://localhost:*'] : ["'self'"],
        styleSrc: ["'self'"],
        ...(isDevLike
          ? {}
          : {
              'require-trusted-types-for': ["'script'"],
              'trusted-types': ['followup-icons'],
            }),
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
    ...(isDevLike
      ? {}
      : {
          strictTransportSecurity: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: false,
          },
        }),
  });

  await app.register(fastifyCors, {
    origin: (origin, callback) => {
      // Le chiamate server-to-server spesso non hanno Origin: non sono CORS browser.
      // Il caso rischioso è il literal "null" da file:// o iframe sandboxed.
      const env = app.config.NODE_ENV;
      const isDevLikeEnv = env === 'development' || env === 'test';
      if (origin == null || origin === '') {
        callback(null, false);
        return;
      }
      if (origin === 'null' && !isDevLikeEnv) {
        callback(new Error('CORS: null origin not allowed in production'), false);
        return;
      }
      if (isDevLikeEnv && isLocalDevOrigin(origin)) {
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
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-api-key',
      'X-Api-Key',
      'x-workspace-platform-key',
      'X-Workspace-Platform-Key',
    ],
  });

  // Impedisce a proxy/CDN di cachare risposte autenticate con dati sensibili.
  app.addHook('onSend', async (request, reply) => {
    reply.header(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    const hasAuth =
      request.headers['authorization'] != null || request.headers['x-api-key'] != null;
    if (hasAuth) {
      reply.header('Cache-Control', 'no-store');
    }
  });

  if (!isRateLimitEmergencyDisabled()) {
    /**
     * Note: niente `allowList` qui. In passato login/refresh erano in allowlist
     * per evitare 429 spuri sul bucket globale, ma allowList esenta la richiesta
     * da TUTTI i rate limit (anche per-route). Ora che login/refresh hanno il
     * proprio bucket per-route (vedi `lib/rateLimitProfiles.ts`), partecipano
     * anche al bucket globale: e' la semantica corretta — un IP rumoroso non
     * deve avere tentativi di login gratuiti.
     */
    await app.register(fastifyRateLimit, {
      global: true,
      max: resolveGlobalRateLimitMax(app.config),
      timeWindow: '1 minute',
      keyGenerator: (request) => request.ip,
    });
  }
});
