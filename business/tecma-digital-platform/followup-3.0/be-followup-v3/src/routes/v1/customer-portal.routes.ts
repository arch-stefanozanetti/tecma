import { Router } from "express";
import { handleAsync } from "../asyncHandler.js";
import {
  createCustomerPortalMagicLink,
  exchangeCustomerPortalMagicLink,
  getCustomerPortalOverview,
  logoutCustomerPortalSession,
} from "../../core/auth/customer-portal.service.js";
import { portalExchangeRateLimiter } from "../rateLimitMiddleware.js";

export const customerPortalRoutes = Router();
export const customerPortalPublicRoutes = Router();

/**
 * Endpoint interno (JWT richiesto perché montato sotto v1Router protetto) per generare magic link.
 */
customerPortalRoutes.post(
  "/portal/magic-links",
  handleAsync((req) => createCustomerPortalMagicLink(req.body)),
);

/**
 * Endpoint pubblico (montato anche in server.ts su /v1/portal/*) per exchange token.
 */
customerPortalPublicRoutes.post(
  "/portal/auth/exchange",
  portalExchangeRateLimiter,
  handleAsync((req) => exchangeCustomerPortalMagicLink(req.body)),
);

/**
 * Endpoint pubblico (montato anche in server.ts su /v1/portal/*).
 */
customerPortalPublicRoutes.post(
  "/portal/overview",
  handleAsync((req) => getCustomerPortalOverview(req.body)),
);

customerPortalPublicRoutes.post(
  "/portal/logout",
  handleAsync((req) => logoutCustomerPortalSession(req.body)),
);
