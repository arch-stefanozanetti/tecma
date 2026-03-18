import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8080),
  APP_ENV: z.string().default("dev-1"),
  MONGO_URI: z.string().min(1),
  /** Unico DB usato dall'app (es. test-zanetti). Tutti i dati vengono letti e scritti qui. */
  MONGO_DB_NAME: z.string().min(1),
  AUTH_JWT_SECRET: z.string().default("dev-followup-secret-change-me"),
  AUTH_JWT_EXPIRES_IN: z.string().default("15m"),
  AUTH_REFRESH_EXPIRES_DAYS: z.coerce.number().min(1).max(365).default(7),
  /** Base URL frontend per link invito / reset password */
  APP_PUBLIC_URL: z.string().url().default("http://localhost:5173"),
  /** Mittente email (SES) */
  EMAIL_FROM: z.string().min(1).default("Followup <noreply@example.com>"),
  /** mock = solo log in memoria (test); smtp = AWS SES */
  EMAIL_TRANSPORT: z.enum(["smtp", "mock"]).default("mock"),
  SES_SMTP_HOST: z.string().default("email-smtp.eu-central-1.amazonaws.com"),
  SES_SMTP_PORT: z.coerce.number().default(587),
  SES_SMTP_USER: z.string().optional(),
  SES_SMTP_PASS: z.string().optional(),
  /** Durata token invito (ore) */
  INVITE_TOKEN_EXPIRES_HOURS: z.coerce.number().min(1).max(720).default(168),
  /** Durata token reset password (minuti) */
  PASSWORD_RESET_TOKEN_EXPIRES_MINUTES: z.coerce.number().min(5).max(1440).default(60)
});

export const ENV = EnvSchema.parse(process.env);
