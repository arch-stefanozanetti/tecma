import { Router } from "express";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requireAdmin } from "../authMiddleware.js";
import { getWorkflowConfig } from "../../core/workflow/workflow.service.js";
import {
  listWorkflowsByWorkspace,
  getWorkflowWithStatesAndTransitions,
  createWorkflow,
  createWorkflowState,
  createWorkflowTransition,
} from "../../core/workflow/workflow-engine.service.js";
import {
  listCustomerNeeds,
  getCustomerNeedById,
  createCustomerNeed,
  updateCustomerNeed,
} from "../../core/product-discovery/customer-needs.service.js";
import {
  listInitiatives,
  listSuggestedRoadmap,
  getInitiativeById,
  createInitiative,
  updateInitiative,
} from "../../core/product-discovery/initiatives.service.js";
import {
  listOpportunities,
  listTopProblems,
  getOpportunityById,
  createOpportunity,
  updateOpportunity,
} from "../../core/product-discovery/opportunities.service.js";
import { listFeatures, getFeatureById, createFeature, updateFeature } from "../../core/product-discovery/features.service.js";

export const discoveryWorkflowRoutes = Router();

discoveryWorkflowRoutes.get(
  "/workflow/config",
  handleAsync((req) => {
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
  })
);

discoveryWorkflowRoutes.get(
  "/workspaces/:workspaceId/workflows",
  handleAsync((req) => listWorkflowsByWorkspace(req.params.workspaceId))
);
discoveryWorkflowRoutes.post("/workflows", requireAdmin, handleAsync((req) => createWorkflow(req.body)));
discoveryWorkflowRoutes.post("/workflows/states", requireAdmin, handleAsync((req) => createWorkflowState(req.body)));
discoveryWorkflowRoutes.post(
  "/workflows/transitions",
  requireAdmin,
  handleAsync((req) => createWorkflowTransition(req.body))
);

discoveryWorkflowRoutes.get(
  "/workflows/:workflowId",
  handleAsync(async (req) => {
    const detail = await getWorkflowWithStatesAndTransitions(req.params.workflowId);
    if (!detail) throw new HttpError("Workflow not found", 404);
    return detail;
  })
);

discoveryWorkflowRoutes.get(
  "/customer-needs",
  requireAdmin,
  handleAsync((req) => {
    const opportunityId = typeof req.query.opportunityId === "string" ? req.query.opportunityId : undefined;
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    return listCustomerNeeds({ opportunityId, status });
  })
);

discoveryWorkflowRoutes.post(
  "/customer-needs",
  requireAdmin,
  handleAsync((req) => {
    const createdBy = typeof req.user?.sub === "string" ? req.user.sub : undefined;
    return createCustomerNeed(req.body, createdBy);
  })
);

discoveryWorkflowRoutes.get("/customer-needs/:id", requireAdmin, handleAsync((req) => getCustomerNeedById(req.params.id)));
discoveryWorkflowRoutes.patch(
  "/customer-needs/:id",
  requireAdmin,
  handleAsync((req) => updateCustomerNeed(req.params.id, req.body))
);

discoveryWorkflowRoutes.get(
  "/opportunities",
  requireAdmin,
  handleAsync((req) => {
    const initiativeId = typeof req.query.initiativeId === "string" ? req.query.initiativeId : undefined;
    return listOpportunities({ initiativeId });
  })
);

discoveryWorkflowRoutes.post("/opportunities", requireAdmin, handleAsync((req) => createOpportunity(req.body)));
discoveryWorkflowRoutes.get("/opportunities/:id", requireAdmin, handleAsync((req) => getOpportunityById(req.params.id)));
discoveryWorkflowRoutes.patch(
  "/opportunities/:id",
  requireAdmin,
  handleAsync((req) => updateOpportunity(req.params.id, req.body))
);

discoveryWorkflowRoutes.get("/initiatives", requireAdmin, handleAsync(() => listInitiatives()));
discoveryWorkflowRoutes.post("/initiatives", requireAdmin, handleAsync((req) => createInitiative(req.body)));
discoveryWorkflowRoutes.get("/initiatives/:id", requireAdmin, handleAsync((req) => getInitiativeById(req.params.id)));
discoveryWorkflowRoutes.patch(
  "/initiatives/:id",
  requireAdmin,
  handleAsync((req) => updateInitiative(req.params.id, req.body))
);

discoveryWorkflowRoutes.get(
  "/product-discovery/suggested-roadmap",
  requireAdmin,
  handleAsync(() => listSuggestedRoadmap())
);
discoveryWorkflowRoutes.get("/product-discovery/top-problems", requireAdmin, handleAsync(() => listTopProblems()));

discoveryWorkflowRoutes.get(
  "/features",
  requireAdmin,
  handleAsync((req) => {
    const initiativeId = typeof req.query.initiativeId === "string" ? req.query.initiativeId : undefined;
    return listFeatures({ initiativeId });
  })
);

discoveryWorkflowRoutes.post("/features", requireAdmin, handleAsync((req) => createFeature(req.body)));
discoveryWorkflowRoutes.get("/features/:id", requireAdmin, handleAsync((req) => getFeatureById(req.params.id)));
discoveryWorkflowRoutes.patch("/features/:id", requireAdmin, handleAsync((req) => updateFeature(req.params.id, req.body)));
