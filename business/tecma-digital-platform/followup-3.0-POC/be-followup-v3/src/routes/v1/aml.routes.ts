import { Router } from "express";
import { z } from "zod";
import { handleAsync } from "../asyncHandler.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { requireWorkspaceEntitled } from "../workspaceEntitlementMiddleware.js";
import {
  listAmlChecksForClient,
  startAmlCheckForClient,
} from "../../core/aml/aml-checks.service.js";
import { getSumsubConfig } from "../../core/aml/aml-config.service.js";

const entitledIntegrations = requireWorkspaceEntitled("integrations", (req) => req.params.workspaceId);

export const amlRoutes = Router();

/** Catalogo connettori AML (roadmap + disponibilità). */
amlRoutes.get(
  "/workspaces/:workspaceId/aml/catalog",
  requirePermission(PERMISSIONS.INTEGRATIONS_READ),
  entitledIntegrations,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId;
    const sumsub = await getSumsubConfig(workspaceId);
    return {
      data: {
        providers: [
          {
            id: "sumsub",
            name: "Sumsub",
            kind: "kyc_aml",
            available: true,
            configured: !!sumsub?.config?.levelName && !!sumsub?.config?.appTokenMasked,
            capabilities: { supportsHostedLink: true, supportsSdkWeb: true },
          },
          {
            id: "onfido",
            name: "Onfido",
            kind: "identity",
            available: false,
            comingSoon: true,
            capabilities: { supportsHostedLink: true, supportsSdkWeb: true },
          },
          {
            id: "complyadvantage",
            name: "ComplyAdvantage",
            kind: "screening",
            available: false,
            comingSoon: true,
            capabilities: { supportsHostedLink: false, supportsSdkWeb: false },
          },
          {
            id: "trulioo",
            name: "Trulioo",
            kind: "kyc_aml",
            available: false,
            comingSoon: true,
            capabilities: { supportsHostedLink: true, supportsSdkWeb: true },
          },
          {
            id: "veriff",
            name: "Veriff",
            kind: "identity",
            available: false,
            comingSoon: true,
            capabilities: { supportsHostedLink: true, supportsSdkWeb: true },
          },
        ],
        disclaimer:
          "I connettori \"In arrivo\" sono indicativi di roadmap prodotto e non costituiscono impegno contrattuale.",
      },
    };
  })
);

amlRoutes.get(
  "/workspaces/:workspaceId/clients/:clientId/aml/checks",
  requirePermission(PERMISSIONS.CLIENTS_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync(async (req) => {
    const { workspaceId, clientId } = req.params;
    const checks = await listAmlChecksForClient(workspaceId, clientId);
    return { data: checks };
  })
);

amlRoutes.post(
  "/workspaces/:workspaceId/clients/:clientId/aml/checks",
  requirePermission(PERMISSIONS.CLIENTS_UPDATE),
  requireCanAccessWorkspace("workspaceId"),
  entitledIntegrations,
  handleAsync(async (req) => {
    const body = z.object({ providerId: z.enum(["sumsub"]) }).parse(req.body ?? {});
    const userId = req.user?.sub;
    const result = await startAmlCheckForClient(req.params.workspaceId, req.params.clientId, body.providerId, userId);
    return {
      data: {
        check: result.check,
        sdkAccessToken: result.sdkAccessToken,
      },
    };
  })
);
