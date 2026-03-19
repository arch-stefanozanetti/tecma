import { Router } from "express";
import { handleAsync } from "../asyncHandler.js";
import { applySignatureWebhook, createSignatureRequest, getSignatureStatusForRequest } from "../../core/contracts/signature.service.js";

export const contractsRoutes = Router();
export const contractsPublicRoutes = Router();

contractsRoutes.post(
  "/contracts/signature-requests",
  handleAsync((req) =>
    createSignatureRequest({
      ...req.body,
      actorUserId: req.user?.sub,
    }),
  ),
);

contractsPublicRoutes.post(
  "/contracts/signature-requests/webhook",
  handleAsync((req) => applySignatureWebhook(req.body)),
);

contractsRoutes.get(
  "/contracts/:requestId/signature-status",
  handleAsync((req) => {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    return getSignatureStatusForRequest(workspaceId, req.params.requestId);
  }),
);
