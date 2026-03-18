import type { Request, Response, NextFunction } from "express";
import { hasAllPermissions, hasAnyPermission } from "../core/rbac/permissions.js";
import { HttpError } from "../types/http.js";
import { sendError } from "./asyncHandler.js";

export function requirePermission(...required: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, new HttpError("Unauthorized", 401));
      return;
    }
    const granted = req.user.permissions ?? [];
    if (!hasAllPermissions(granted, required)) {
      sendError(res, new HttpError("Permesso negato", 403));
      return;
    }
    next();
  };
}

export function requireAnyPermission(...required: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, new HttpError("Unauthorized", 401));
      return;
    }
    const granted = req.user.permissions ?? [];
    if (!hasAnyPermission(granted, required)) {
      sendError(res, new HttpError("Permesso negato", 403));
      return;
    }
    next();
  };
}
