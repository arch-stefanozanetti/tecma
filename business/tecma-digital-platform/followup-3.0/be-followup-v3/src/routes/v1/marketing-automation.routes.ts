import { Router } from "express";
import { handleAsync } from "../asyncHandler.js";
import { createMarketingWorkflow, listMarketingWorkflows, runDueMarketingAutomations } from "../../core/automations/marketing-automation.service.js";
import { requireAdmin } from "../authMiddleware.js";

export const marketingAutomationRoutes = Router();

marketingAutomationRoutes.get(
  "/workspaces/:workspaceId/marketing-workflows",
  requireAdmin,
  handleAsync((req) => listMarketingWorkflows(req.params.workspaceId)),
);

marketingAutomationRoutes.post(
  "/workspaces/:workspaceId/marketing-workflows",
  requireAdmin,
  handleAsync((req) => createMarketingWorkflow({ ...req.body, workspaceId: req.params.workspaceId })),
);

marketingAutomationRoutes.post(
  "/marketing-workflows/run-due",
  requireAdmin,
  handleAsync(() => runDueMarketingAutomations()),
);

