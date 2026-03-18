import { Router } from "express";
import { HttpError } from "../../types/http.js";
import { getWorkflowConfig } from "../../core/workflow/workflow.service.js";
import {
  listWorkflowsByWorkspace,
  getWorkflowWithStatesAndTransitions,
  createWorkflow,
  createWorkflowState,
  createWorkflowTransition,
} from "../../core/workflow/workflow-engine.service.js";
import { requireAdmin } from "../authMiddleware.js";
import { handleAsync } from "../asyncHandler.js";

export const workflowRoutes = Router();

workflowRoutes.get("/workflow/config", handleAsync(async (req) => {
  const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
  const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
  const flowType = (typeof req.query.flowType === "string" ? req.query.flowType : "sell") as "rent" | "sell";
  if (!workspaceId || !projectId) {
    throw new HttpError("Missing workspaceId or projectId query params", 400);
  }
  if (flowType !== "rent" && flowType !== "sell") {
    throw new HttpError("flowType must be rent or sell", 400);
  }
  return getWorkflowConfig(workspaceId, projectId, flowType);
}));

workflowRoutes.get("/workspaces/:workspaceId/workflows", handleAsync((req) =>
  listWorkflowsByWorkspace(req.params.workspaceId)
));
workflowRoutes.post("/workflows", requireAdmin, handleAsync((req) => createWorkflow(req.body)));
workflowRoutes.post("/workflows/states", requireAdmin, handleAsync((req) => createWorkflowState(req.body)));
workflowRoutes.post("/workflows/transitions", requireAdmin, handleAsync((req) => createWorkflowTransition(req.body)));
workflowRoutes.get("/workflows/:workflowId", handleAsync(async (req) => {
  const detail = await getWorkflowWithStatesAndTransitions(req.params.workflowId);
  if (!detail) throw new HttpError("Workflow not found", 404);
  return detail;
}));
