import { Router } from "express";
import { queryQuotes } from "../../core/quotes/quotes.service.js";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";

export const quotesRoutes = Router();

quotesRoutes.post(
  "/quotes/query",
  requirePermission(PERMISSIONS.REQUESTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync((req) => queryQuotes(req.body))
);
