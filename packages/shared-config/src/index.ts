import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_ENV: z.enum(['dev-1', 'demo', 'prod']).default('dev-1'),
  PORT: z.coerce.number().int().positive().default(8080),
  MONGO_URI: z.string().min(1),
  MONGO_DB_NAME: z.string().min(1),
  /**
   * Connessione opzionale dedicata alla sola scrittura audit append-only.
   * In staging/prod va popolata con un utente Mongo che abbia solo `insert`
   * su `tz_authEvents`; se assente, l'API usa la connessione applicativa.
   */
  AUDIT_MONGO_URI: z.string().trim().min(1).optional(),
  AUDIT_MONGO_DB_NAME: z.string().trim().min(1).optional(),
  /** Deve coincidere con `MONGO_DB_NAME` (gate scritture accidentalmente su DB sbagliato). */
  ALLOWED_WRITE_DB: z.string().min(1),
  AUTH_JWT_SECRET: z.string().min(32),
  AUTH_JWT_KID: z.string().trim().min(1).optional(),
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
  /**
   * Profilo per i rate limit per-rotta sensibili (login, password-reset, invite, ecc.).
   * - `strict`: limiti bassi (5-30/min). Comportamento di default in `staging`/`production`.
   * - `loose`: limiti alti (10000/min, di fatto disattivati). Default in `development`/`test`
   *   per evitare 429 spuri durante lo sviluppo locale e i test integration.
   * Override esplicito utile per i test che VOGLIONO verificare il 429.
   */
  API_RATE_LIMIT_PROFILE: z.enum(['strict', 'loose']).optional(),

  // SMTP (AWS SES o altro). In `production` almeno SMTP_URL o SMTP_HOST è obbligatorio
  // (verificato a runtime in `createMailPort`). In dev/test sono opzionali.
  SMTP_URL: z.string().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
  /**
   * `auto`: invia via SMTP quando SMTP è configurato, anche in locale.
   * `mock`: logga senza inviare.
   * `smtp`: richiede SMTP configurato e fallisce all'avvio se manca.
   */
  SMTP_DELIVERY_MODE: z.enum(['auto', 'mock', 'smtp']).default('auto'),

  // URL pubblico del frontend per costruire link in email.
  APP_PUBLIC_URL: z.string().url().optional(),
  AUTH_PASSWORD_RESET_URL: z.string().url().optional(),
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

/**
 * Profilo applicato ai rate limit per-rotta sensibili.
 * Override esplicito: `API_RATE_LIMIT_PROFILE`.
 * Default per ambiente:
 * - `staging` / `production` → `strict`
 * - `development` / `test` → `loose`
 */
export const resolveRateLimitProfile = (config: AppConfig): 'strict' | 'loose' => {
  if (config.API_RATE_LIMIT_PROFILE != null) return config.API_RATE_LIMIT_PROFILE;
  return config.NODE_ENV === 'production' || config.NODE_ENV === 'staging' ? 'strict' : 'loose';
};
