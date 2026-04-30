import { Router } from "express";
import { requireAdmin } from "../authMiddleware.js";
import { handleAsync } from "../asyncHandler.js";
import { evaluateScaleOutDecision } from "../../core/platform/scale-out-decision.service.js";

export const scaleOutRoutes = Router();

scaleOutRoutes.get(
  "/workspaces/:workspaceId/platform/scale-out-decision",
  requireAdmin,
  handleAsync((req) => evaluateScaleOutDecision(req.params.workspaceId)),
);

