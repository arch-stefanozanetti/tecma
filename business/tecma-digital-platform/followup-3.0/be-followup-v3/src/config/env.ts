import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8080),
  APP_ENV: z.string().default("dev-1"),
  NODE_ENV: z.string().optional(),
  MONGO_URI: z.string().min(1),
  MONGO_DB_NAME: z.string().min(1),
  AUTH_JWT_SECRET: z.string().min(1).default("dev-followup-secret-change-me"),
  AUTH_JWT_EXPIRES_IN: z.string().default("15m"),
  AUTH_REFRESH_EXPIRES_DAYS: z.coerce.number().min(1).max(365).default(7),
  APP_PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  /** Origini CORS aggiuntive (virgola), oltre a APP_PUBLIC_URL */
  CORS_ORIGINS: z.string().optional().default(""),
  EMAIL_FROM: z.string().min(1).default("Followup <noreply@example.com>"),
  EMAIL_TRANSPORT: z.enum(["smtp", "mock"]).default("mock"),
  SES_SMTP_HOST: z.string().default("email-smtp.eu-central-1.amazonaws.com"),
  SES_SMTP_PORT: z.coerce.number().default(587),
  SES_SMTP_USER: z.string().optional(),
  SES_SMTP_PASS: z.string().optional(),
  INVITE_TOKEN_EXPIRES_HOURS: z.coerce.number().min(1).max(720).default(168),
  PASSWORD_RESET_TOKEN_EXPIRES_MINUTES: z.coerce.number().min(5).max(1440).default(60),
  /** JWKS dell'IdP per verifica firma JWT SSO (RS256/ES256); stringa vuota = disattivato */
  SSO_JWKS_URI: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? undefined : v),
    z.string().url().optional()
  ),
  /** Issuer atteso nel JWT SSO */
  SSO_JWT_ISSUER: z.string().optional(),
  /** Audience attesa (opzionale) */
  SSO_JWT_AUDIENCE: z.string().optional(),
  /** Alternativa a JWKS: segreto HMAC condiviso con il gateway (solo se fidato) */
  SSO_JWT_HS256_SECRET: z.string().optional()
});

const parsed = EnvSchema.parse({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV
});

function isProductionLike(): boolean {
  return (
    String(parsed.NODE_ENV || "").toLowerCase() === "production" ||
    ["production", "prod", "staging"].includes(String(parsed.APP_ENV || "").toLowerCase())
  );
}

if (isProductionLike()) {
  if (parsed.AUTH_JWT_SECRET.length < 32) {
    throw new Error(
      "AUTH_JWT_SECRET deve essere di almeno 32 caratteri in produzione/staging (APP_ENV/NODE_ENV)."
    );
  }
  if (parsed.AUTH_JWT_SECRET.includes("change-me") || parsed.AUTH_JWT_SECRET === "dev-followup-secret-change-me") {
    throw new Error("AUTH_JWT_SECRET non può usare il default di sviluppo in produzione/staging.");
  }
}

export const ENV = parsed;
export { isProductionLike };
