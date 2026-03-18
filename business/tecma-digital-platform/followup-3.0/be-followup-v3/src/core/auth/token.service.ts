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

function jwtSecret(): string {
  return process.env.AUTH_JWT_SECRET || ENV.AUTH_JWT_SECRET;
}

function accessExpiresIn(): string {
  return process.env.AUTH_JWT_EXPIRES_IN || ENV.AUTH_JWT_EXPIRES_IN;
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, jwtSecret(), { expiresIn: accessExpiresIn() } as jwt.SignOptions);

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  const decoded = jwt.verify(token, jwtSecret()) as Partial<AccessTokenPayload> & { sub?: string; email?: string };

  let perms: string[] = [];
  if (Array.isArray(decoded.permissions)) {
    perms = (decoded.permissions as string[]).filter((p) => typeof p === "string");
  }
  const isAdminFlag = Boolean(decoded.isAdmin);
  if (perms.length === 0 && isAdminFlag) {
    perms = ["*"];
  }
  const isAdmin = isAdminFlag || perms.includes("*");
  if (perms.length === 0 && isAdmin) {
    perms = ["*"];
  }

  return {
    sub: String(decoded.sub ?? ""),
    email: String(decoded.email ?? ""),
    role: decoded.role ?? null,
    isAdmin,
    permissions: perms,
    projectId: decoded.projectId != null && decoded.projectId !== "" ? String(decoded.projectId) : null
  };
};
