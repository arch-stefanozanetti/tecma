import { Router } from "express";
import { handleAsync } from "../asyncHandler.js";
import { requireAdmin } from "../authMiddleware.js";
import { generateMlsFeedXml, runMlsReconciliation, upsertMlsPortalMapping } from "../../core/connectors/mls-feed.service.js";

export const mlsFeedRoutes = Router();
export const mlsFeedPublicRoutes = Router();

mlsFeedPublicRoutes.get(
  "/mls/feed/:workspaceId/:projectId.xml",
  handleAsync(async (req) => {
    const fromHeader = req.get("x-mls-api-key")?.trim() ?? "";
    const fromQuery = typeof req.query.apiKey === "string" ? req.query.apiKey : "";
    const apiKey = fromHeader || fromQuery;
    const xml = await generateMlsFeedXml({
      workspaceId: req.params.workspaceId,
      projectId: req.params.projectId,
      apiKey,
    });
    req.res?.setHeader("Content-Type", "application/xml; charset=utf-8");
    return req.res?.send(xml);
  }),
);

mlsFeedRoutes.post(
  "/workspaces/:workspaceId/mls/mappings",
  requireAdmin,
  handleAsync((req) =>
    upsertMlsPortalMapping({
      workspaceId: req.params.workspaceId,
      projectId: req.body?.projectId,
      portal: req.body?.portal,
      titlePrefix: req.body?.titlePrefix,
      listingBaseUrl: req.body?.listingBaseUrl,
    }),
  ),
);

mlsFeedRoutes.post(
  "/workspaces/:workspaceId/mls/reconcile",
  requireAdmin,
  handleAsync((req) => runMlsReconciliation(req.params.workspaceId)),
);
