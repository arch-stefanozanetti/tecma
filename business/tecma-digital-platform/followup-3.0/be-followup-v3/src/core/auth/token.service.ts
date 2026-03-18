import jwt from "jsonwebtoken";
import { ENV } from "../../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string | null;
  isAdmin: boolean;
  /** Permessi effettivi; "*" = admin completo */
  permissions: string[];
  projectId: string | null;
}

const JWT_SECRET = ENV.AUTH_JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = ENV.AUTH_JWT_EXPIRES_IN;

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN } as jwt.SignOptions);

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, JWT_SECRET) as Partial<AccessTokenPayload> & { sub?: string; email?: string };
  const perms = Array.isArray(decoded.permissions)
    ? (decoded.permissions as string[]).filter((p) => typeof p === "string")
    : decoded.isAdmin
      ? ["*"]
      : [];
  const isAdmin = Boolean(decoded.isAdmin) || perms.includes("*");
  return {
    sub: String(decoded.sub ?? ""),
    email: String(decoded.email ?? ""),
    role: decoded.role ?? null,
    isAdmin,
    permissions: perms.length ? perms : isAdmin ? ["*"] : [],
    projectId: decoded.projectId != null && decoded.projectId !== "" ? String(decoded.projectId) : null
  };
};

