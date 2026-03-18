import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../core/auth/token.service.js";
import { sendError } from "./asyncHandler.js";
import { HttpError } from "../types/http.js";

/**
 * Middleware that requires a valid JWT in Authorization: Bearer <token>.
 * On success sets req.user from the token payload; on missing or invalid token returns 401.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    sendError(res, new HttpError("Missing or invalid Authorization header", 401));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    sendError(res, new HttpError("Invalid or expired token", 401));
  }
}

/**
 * Middleware that requires req.user.isAdmin === true.
 * Must be used after requireAuth.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, new HttpError("Unauthorized", 401));
    return;
  }
  const isPrivileged =
    req.user.isAdmin === true || (Array.isArray(req.user.permissions) && req.user.permissions.includes("*"));
  if (!isPrivileged) {
    sendError(res, new HttpError("Admin role required", 403));
    return;
  }
  next();
}
