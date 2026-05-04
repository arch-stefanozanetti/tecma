import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_ENV: z.enum(['dev-1', 'demo', 'prod']).default('dev-1'),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGO_URI: z.string().min(1),
  MONGO_DB_NAME: z.string().min(1),
  /** Deve coincidere con `MONGO_DB_NAME` (gate scritture accidentalmente su DB sbagliato). */
  ALLOWED_WRITE_DB: z.string().min(1).default('test-zanetti'),
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_JWT_EXPIRES_IN: z.string().default('15m'),
  AUTH_REFRESH_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  INTERNAL_API_KEY: z.string().min(16),
  /** Origini ammesse in staging/prod; in development l’API accetta anche qualsiasi `http://localhost:*`. */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:5177,http://localhost:5179'),
  SSO_JWKS_URI: z.string().optional(),
  SSO_JWT_ISSUER: z.string().optional(),
  SSO_JWT_AUDIENCE: z.string().optional(),
  REDIS_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  DATADOG_API_KEY: z.string().optional(),
  /**
   * Richieste al minuto (stesso IP) con @fastify/rate-limit globale.
   * Se assente: in `development` / `test` default 2000; altrimenti 100.
   */
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().optional(),
});

export type AppConfig = z.infer<typeof envSchema> & { corsOrigins: string[] };

export const loadEnv = (input: NodeJS.ProcessEnv = process.env): AppConfig => {
  const parsed = envSchema.parse(input);
  if (parsed.MONGO_DB_NAME !== parsed.ALLOWED_WRITE_DB) {
    throw new Error(
      `[DB_GUARD] MONGO_DB_NAME must equal ALLOWED_WRITE_DB='${parsed.ALLOWED_WRITE_DB}', got '${parsed.MONGO_DB_NAME}'`,
    );
  }

  process.env.ALLOWED_WRITE_DB = parsed.ALLOWED_WRITE_DB;

  return {
    ...parsed,
    corsOrigins: parsed.CORS_ORIGINS.split(',')
      .map((v) => v.trim())
      .filter(Boolean),
  };
};

/** Limite effettivo per il plugin rate-limit (coerente con `API_RATE_LIMIT_MAX` opzionale). */
export const resolveRateLimitMax = (config: AppConfig): number => {
  if (config.API_RATE_LIMIT_MAX != null) return config.API_RATE_LIMIT_MAX;
  if (config.NODE_ENV === 'development' || config.NODE_ENV === 'test') return 2000;
  return 100;
};
