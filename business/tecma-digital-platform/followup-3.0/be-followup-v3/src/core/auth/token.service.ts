import jwt from "jsonwebtoken";
import { ENV } from "../../config/env.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: string | null;
  isAdmin: boolean;
}

const JWT_SECRET = ENV.AUTH_JWT_SECRET;
const ACCESS_TOKEN_EXPIRES_IN = ENV.AUTH_JWT_EXPIRES_IN;

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN } as jwt.SignOptions);

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, JWT_SECRET) as AccessTokenPayload;

