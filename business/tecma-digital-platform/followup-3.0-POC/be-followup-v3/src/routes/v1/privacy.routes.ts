import { Router } from "express";
import { handleAsync } from "../asyncHandler.js";
import { requireAdmin } from "../authMiddleware.js";
import {
  eraseClientData,
  exportClientPrivacyBundle,
  revokeClientConsent,
  runPrivacyRetentionJob,
  upsertClientConsent,
} from "../../core/privacy/privacy.service.js";

export const privacyRoutes = Router();

privacyRoutes.post(
  "/privacy/clients/:clientId/consents",
  requireAdmin,
  handleAsync((req) =>
    upsertClientConsent({
      ...req.body,
      workspaceId: req.body?.workspaceId ?? req.query.workspaceId,
      clientId: req.params.clientId,
    }),
  ),
);

privacyRoutes.delete(
  "/privacy/clients/:clientId/consents/:consentType",
  requireAdmin,
  handleAsync((req) =>
    revokeClientConsent({
      workspaceId: req.query.workspaceId,
      clientId: req.params.clientId,
      consentType: req.params.consentType,
      source: "manual",
      actorId: req.user?.sub,
    }),
  ),
);

privacyRoutes.get(
  "/privacy/clients/:clientId/export",
  requireAdmin,
  handleAsync((req) => {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    return exportClientPrivacyBundle(workspaceId, req.params.clientId);
  }),
);

privacyRoutes.post(
  "/privacy/clients/:clientId/erase",
  requireAdmin,
  handleAsync((req) =>
    eraseClientData({
      ...req.body,
      workspaceId: req.body?.workspaceId ?? req.query.workspaceId,
      clientId: req.params.clientId,
      actorId: req.user?.sub,
    }),
  ),
);

privacyRoutes.post(
  "/privacy/retention/run",
  requireAdmin,
  handleAsync((req) => runPrivacyRetentionJob(req.body)),
);

