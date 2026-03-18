import jwt from "jsonwebtoken";
import jwksRsa from "jwks-rsa";
import { ENV } from "../../config/env.js";
import { HttpError } from "../../types/http.js";

const RSA_ALGS: jwt.Algorithm[] = ["RS256", "RS384", "RS512", "ES256"];

function effectiveJwksUri(): string | undefined {
  if (Object.prototype.hasOwnProperty.call(process.env, "SSO_JWKS_URI")) {
    const v = process.env.SSO_JWKS_URI;
    return v && v.length > 0 ? v : undefined;
  }
  return ENV.SSO_JWKS_URI;
}

function effectiveHs256Secret(): string | undefined {
  if (Object.prototype.hasOwnProperty.call(process.env, "SSO_JWT_HS256_SECRET")) {
    const v = process.env.SSO_JWT_HS256_SECRET;
    return v && v.length > 0 ? v : undefined;
  }
  return ENV.SSO_JWT_HS256_SECRET;
}

function ssoIssuer(): string | undefined {
  return process.env.SSO_JWT_ISSUER || ENV.SSO_JWT_ISSUER || undefined;
}

function ssoAudience(): string | undefined {
  return process.env.SSO_JWT_AUDIENCE || ENV.SSO_JWT_AUDIENCE || undefined;
}

/**
 * Verifica firma e claim del JWT SSO (JWKS IdP oppure HS256 con segreto condiviso).
 * Mai usare jwt.decode per decisioni di autenticazione.
 */
export async function verifySsoJwtAndGetPayload(ssoJwt: string): Promise<Record<string, unknown>> {
  const jwksUri = effectiveJwksUri();
  if (jwksUri) {
    const client = jwksRsa({
      jwksUri,
      cache: true,
      cacheMaxAge: 600_000,
      rateLimit: true
    });
    const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
      if (!header.kid) {
        callback(new Error("Token SSO: kid mancante"));
        return;
      }
      client.getSigningKey(header.kid, (err, key) => {
        if (err) {
          callback(err);
          return;
        }
        callback(null, key?.getPublicKey());
      });
    };
    return new Promise((resolve, reject) => {
      jwt.verify(
        ssoJwt,
        getKey,
        {
          algorithms: RSA_ALGS,
          ...(ssoIssuer() ? { issuer: ssoIssuer() } : {}),
          ...(ssoAudience() ? { audience: ssoAudience() } : {})
        },
        (err, decoded) => {
          if (err || !decoded || typeof decoded !== "object") {
            reject(new HttpError("Token SSO non valido", 401));
            return;
          }
          resolve(decoded as Record<string, unknown>);
        }
      );
    });
  }

  const hs256 = effectiveHs256Secret();
  if (hs256) {
    try {
      const decoded = jwt.verify(ssoJwt, hs256, {
        algorithms: ["HS256"],
        ...(ssoIssuer() ? { issuer: ssoIssuer() } : {}),
        ...(ssoAudience() ? { audience: ssoAudience() } : {})
      });
      if (!decoded || typeof decoded !== "object") {
        throw new HttpError("Token SSO non valido", 401);
      }
      return decoded as Record<string, unknown>;
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError("Token SSO non valido", 401);
    }
  }

  throw new HttpError(
    "Exchange SSO non configurato: impostare SSO_JWKS_URI (IdP) oppure SSO_JWT_HS256_SECRET (es. gateway interno).",
    503
  );
}
