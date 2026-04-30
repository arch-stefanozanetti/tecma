import { ENV } from "../../config/env.js";
import { HttpError } from "../../types/http.js";

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/;

/**
 * Valida la password rispetto alla policy configurata (ENV).
 * @throws HttpError 400 se non conforme
 */
export function assertPasswordMeetsPolicy(password: string): void {
  const min = ENV.AUTH_PASSWORD_MIN_LENGTH;
  if (password.length < min) {
    throw new HttpError(`La password deve essere di almeno ${min} caratteri`, 400, "PASSWORD_POLICY");
  }
  if (ENV.AUTH_PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    throw new HttpError("La password deve contenere almeno una lettera maiuscola", 400, "PASSWORD_POLICY");
  }
  if (ENV.AUTH_PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    throw new HttpError("La password deve contenere almeno una lettera minuscola", 400, "PASSWORD_POLICY");
  }
  if (ENV.AUTH_PASSWORD_REQUIRE_DIGIT && !/[0-9]/.test(password)) {
    throw new HttpError("La password deve contenere almeno una cifra", 400, "PASSWORD_POLICY");
  }
  if (ENV.AUTH_PASSWORD_REQUIRE_SPECIAL && !SPECIAL_RE.test(password)) {
    throw new HttpError(
      "La password deve contenere almeno un carattere speciale (!@#$%...)",
      400,
      "PASSWORD_POLICY"
    );
  }
}
