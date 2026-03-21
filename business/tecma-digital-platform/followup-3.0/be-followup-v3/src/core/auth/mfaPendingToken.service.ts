/**
 * JWT di breve durata emesso dopo password corretta quando serve secondo fattore (TOTP).
 */
import jwt from "jsonwebtoken";
import { ENV } from "../../config/env.js";
import { HttpError } from "../../types/http.js";

const AUD = "followup_mfa_pending";

export interface MfaPendingPayload {
  sub: string;
  email: string;
}

function secret(): string {
  return process.env.AUTH_JWT_SECRET || ENV.AUTH_JWT_SECRET;
}

export function signMfaPendingToken(payload: MfaPendingPayload): string {
  return jwt.sign(
    { sub: payload.sub, email: payload.email, aud: AUD },
    secret(),
    { expiresIn: ENV.AUTH_MFA_PENDING_EXPIRES_IN } as jwt.SignOptions
  );
}

export function verifyMfaPendingToken(token: string): MfaPendingPayload {
  try {
    const decoded = jwt.verify(token, secret()) as {
      sub?: string;
      email?: string;
      aud?: string;
    };
    if (decoded.aud !== AUD) {
      throw new HttpError("Token MFA non valido", 401, "INVALID_MFA_TOKEN");
    }
    const sub = String(decoded.sub ?? "");
    const email = String(decoded.email ?? "");
    if (!sub || !email) {
      throw new HttpError("Token MFA non valido", 401, "INVALID_MFA_TOKEN");
    }
    return { sub, email };
  } catch (e) {
    if (e instanceof HttpError) throw e;
    throw new HttpError("Token MFA scaduto o non valido", 401, "INVALID_MFA_TOKEN");
  }
}
