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
  AUTH_REFRESH_EXPIRES_DAYS: z.coerce.number().min(1).max(365).default(7)
});

export const ENV = EnvSchema.parse(process.env);
