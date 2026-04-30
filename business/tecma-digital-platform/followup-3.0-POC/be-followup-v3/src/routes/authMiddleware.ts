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
    const hint = !authHeader
      ? "Header mancante: invia Authorization: Bearer <token> (effettua login per ottenere il token)."
      : "Formato non valido: usa Authorization: Bearer <token>.";
    sendError(res, new HttpError("Missing or invalid Authorization header", 401, "MISSING_AUTH", hint));
    return;
  }
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    sendError(res, new HttpError("Invalid or expired token", 401, "INVALID_TOKEN"));
  }
}

/**
 * Middleware that requires req.user.isAdmin === true (legacy: permission-based admin).
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

/**
 * Middleware that requires TECMA global admin (system_role === "tecma_admin").
 * Use for operations that only TECMA can perform (e.g. create workspace, list all workspaces).
 * Must be used after requireAuth.
 */
export function requireTecmaAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, new HttpError("Unauthorized", 401));
    return;
  }
  const isTecma = req.user.system_role === "tecma_admin" || req.user.isTecmaAdmin === true;
  if (!isTecma) {
    sendError(res, new HttpError("TECMA admin required", 403));
    return;
  }
  next();
}
