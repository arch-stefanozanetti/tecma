import rateLimit from "express-rate-limit";

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
