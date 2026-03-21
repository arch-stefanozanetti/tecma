import type { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { ENV } from "../config/env.js";

const skipRateLimit =
  process.env.NODE_ENV === "test" ||
  process.env.VITEST === "true" ||
  process.env.DISABLE_AUTH_RATE_LIMIT === "1";

/** Limite su login per ridurre brute-force: 10 richieste per 15 minuti per IP. */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Troppi tentativi di accesso, riprova tra 15 minuti." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit
});

/** Limite su API pubbliche (listati senza JWT): 60 richieste al minuto per IP. */
export const publicApiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { error: "Limite richieste superato, riprova tra un minuto." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit
});

/** Refresh token: stesso ordine di grandezza del login per IP */
export const refreshRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Troppi refresh, riprova tra 15 minuti." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit
});

/** Limite per consumer esterni via API key piattaforma. */
export const platformApiKeyRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: ENV.PLATFORM_RATE_LIMIT_PER_MIN,
  message: { error: "Platform API rate limit exceeded, retry in one minute." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit,
  keyGenerator: (req) => req.get("x-api-key") ?? ipKeyGenerator(req.ip ?? "")
});

/** Webhook firme (segreto condiviso): limite per IP per ridurre tentativi di forza bruta sul segreto. */
export const signatureWebhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: "Troppe richieste al webhook firme, riprova tra un minuto." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit
});

/** Exchange magic-link portale cliente: limite stretto per prevenire brute-force token. */
export const portalExchangeRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Troppi tentativi di accesso al portale, riprova tra un'ora." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit
});

/** MFA dopo login (token pending): bucket dedicato, non condivide il contatore con POST /auth/login. */
export const mfaVerifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Troppi tentativi MFA, riprova tra 15 minuti." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit
});

/** Setup/disabilitazione MFA (JWT richiesto): per utente (sub), fallback IP. */
export const mfaSetupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Troppe operazioni MFA, riprova tra 15 minuti." },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => skipRateLimit,
  keyGenerator: (req: Request) => {
    const sub = req.user?.sub;
    if (typeof sub === "string" && sub.length > 0) return `mfa-setup:${sub}`;
    return ipKeyGenerator(req.ip ?? "");
  }
});
