import dotenv from "dotenv";
import { z } from "zod";
import { parseCorsOrigins } from "./corsOrigins.js";

dotenv.config();

/** Variabile d'ambiente booleana con default. */
function envBool(defaultValue: boolean) {
  return z.preprocess((v: unknown) => {
    if (v === undefined || v === null || v === "") return defaultValue;
    const s = String(v).toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
    return defaultValue;
  }, z.boolean());
}

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
  SSO_JWT_HS256_SECRET: z.string().optional(),
  /** API keys per consumer esterni platform API, JSON object: {"<key>":{"workspaceId":"...","projectIds":["..."]}} */
  PLATFORM_API_KEYS: z.string().default("{}"),
  /** Se env "true" / "1", i suggerimenti AI usano solo euristiche (no chiamate LLM). */
  AI_LLM_DISABLED: z.preprocess(
    (v) => v === "1" || String(v ?? "").toLowerCase() === "true",
    z.boolean()
  ),
  PLATFORM_RATE_LIMIT_PER_MIN: z.coerce.number().min(10).max(5000).default(120),

  /** Lunghezza minima password (set/reset/invite). */
  AUTH_PASSWORD_MIN_LENGTH: z.coerce.number().min(8).max(128).default(12),
  AUTH_PASSWORD_REQUIRE_UPPERCASE: envBool(true),
  AUTH_PASSWORD_REQUIRE_LOWERCASE: envBool(true),
  AUTH_PASSWORD_REQUIRE_DIGIT: envBool(true),
  /** Richiede carattere speciale (!@#$%^&*...); default false. */
  AUTH_PASSWORD_REQUIRE_SPECIAL: envBool(false),

  /** Tentativi falliti password entro la finestra → lockout. */
  AUTH_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().min(3).max(50).default(8),
  AUTH_LOCKOUT_WINDOW_MS: z.coerce.number().min(60_000).max(3_600_000).default(900_000),
  AUTH_LOCKOUT_DURATION_MS: z.coerce.number().min(60_000).max(86_400_000).default(1_800_000),

  /** Issuer mostrato nell'app authenticator */
  AUTH_MFA_ISSUER: z.string().min(1).max(80).default("FollowUp"),
  /** JWT temporaneo MFA (solo verifica TOTP). Es. 5m */
  AUTH_MFA_PENDING_EXPIRES_IN: z.string().default("5m"),
  /**
   * Chiave AES-256 (32 byte) in base64 standard. Opzionale: in assenza si deriva da AUTH_JWT_SECRET (solo compat dev).
   * In produzione impostare valore dedicato.
   */
  AUTH_FIELD_ENCRYPTION_KEY: z.string().optional().default(""),

  /** Se true, ogni utente con membership workspace deve avere MFA attivo per ricevere token completi. */
  AUTH_MFA_REQUIRED_GLOBALLY: z.preprocess(
    (v) => v === "1" || String(v ?? "").toLowerCase() === "true",
    z.boolean()
  ).default(false),

  /**
   * Path directory dove il job-runner scrive snapshot JSONL di `tz_security_audit` (SIEM/backup).
   * Vuoto = export schedulato disabilitato.
   */
  SECURITY_AUDIT_EXPORT_DIR: z.string().optional().default(""),
  DOCUSIGN_API_BASE_URL: z.string().url().optional(),
  DOCUSIGN_API_TOKEN: z.string().optional(),
  YOUSIGN_API_BASE_URL: z.string().url().optional(),
  YOUSIGN_API_TOKEN: z.string().optional(),
  /**
   * Segreto condiviso per POST /contracts/signature-requests/webhook (header Bearer o x-signature-webhook-secret).
   * Obbligatorio in produzione/staging (min 16 caratteri).
   */
  SIGNATURE_WEBHOOK_SECRET: z.string().optional().default(""),
  /**
   * Opzionale: IP o CIDR IPv4 (virgola) da cui accettare il webhook firme oltre al segreto.
   * Esempio: "203.0.113.10,198.51.100.0/24". Vuoto = qualsiasi IP (solo segreto + rate limit).
   */
  SIGNATURE_WEBHOOK_ALLOWED_CIDRS: z.string().optional().default(""),
  /** In produzione/staging: false nasconde GET /v1/openapi.json e /v1/docs (health e auth restano). */
  PUBLIC_API_DOCS_ENABLED: envBool(true),
});

const parsed = EnvSchema.parse({
  ...process.env,
  NODE_ENV: process.env.NODE_ENV
});

const CORS_ORIGINS_LIST = parseCorsOrigins(parsed.CORS_ORIGINS);

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
  const sigSecret = (parsed.SIGNATURE_WEBHOOK_SECRET ?? "").trim();
  if (!sigSecret || sigSecret.length < 16) {
    throw new Error(
      "SIGNATURE_WEBHOOK_SECRET è obbligatorio in produzione/staging (minimo 16 caratteri) per proteggere il webhook firme."
    );
  }
}

export const ENV = {
  ...parsed,
  CORS_ORIGINS_LIST,
};
export { isProductionLike };
