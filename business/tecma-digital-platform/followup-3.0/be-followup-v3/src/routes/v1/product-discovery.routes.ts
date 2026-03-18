import { Router } from "express";
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
import {
  listFeatures,
  getFeatureById,
  createFeature,
  updateFeature,
} from "../../core/product-discovery/features.service.js";
import { requireAdmin } from "../authMiddleware.js";
import { handleAsync } from "../asyncHandler.js";

export const productDiscoveryRoutes = Router();

productDiscoveryRoutes.get("/customer-needs", requireAdmin, handleAsync(async (req) => {
  const opportunityId = typeof req.query.opportunityId === "string" ? req.query.opportunityId : undefined;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  return listCustomerNeeds({ opportunityId, status });
}));
productDiscoveryRoutes.post("/customer-needs", requireAdmin, handleAsync(async (req) => {
  const createdBy = typeof req.user?.sub === "string" ? req.user.sub : undefined;
  return createCustomerNeed(req.body, createdBy);
}));
productDiscoveryRoutes.get("/customer-needs/:id", requireAdmin, handleAsync((req) => getCustomerNeedById(req.params.id)));
productDiscoveryRoutes.patch("/customer-needs/:id", requireAdmin, handleAsync((req) => updateCustomerNeed(req.params.id, req.body)));

productDiscoveryRoutes.get("/opportunities", requireAdmin, handleAsync(async (req) => {
  const initiativeId = typeof req.query.initiativeId === "string" ? req.query.initiativeId : undefined;
  return listOpportunities({ initiativeId });
}));
productDiscoveryRoutes.post("/opportunities", requireAdmin, handleAsync((req) => createOpportunity(req.body)));
productDiscoveryRoutes.get("/opportunities/:id", requireAdmin, handleAsync((req) => getOpportunityById(req.params.id)));
productDiscoveryRoutes.patch("/opportunities/:id", requireAdmin, handleAsync((req) => updateOpportunity(req.params.id, req.body)));

productDiscoveryRoutes.get("/initiatives", requireAdmin, handleAsync(() => listInitiatives()));
productDiscoveryRoutes.post("/initiatives", requireAdmin, handleAsync((req) => createInitiative(req.body)));
productDiscoveryRoutes.get("/initiatives/:id", requireAdmin, handleAsync((req) => getInitiativeById(req.params.id)));
productDiscoveryRoutes.patch("/initiatives/:id", requireAdmin, handleAsync((req) => updateInitiative(req.params.id, req.body)));

productDiscoveryRoutes.get("/product-discovery/suggested-roadmap", requireAdmin, handleAsync(() => listSuggestedRoadmap()));
productDiscoveryRoutes.get("/product-discovery/top-problems", requireAdmin, handleAsync(() => listTopProblems()));

productDiscoveryRoutes.get("/features", requireAdmin, handleAsync(async (req) => {
  const initiativeId = typeof req.query.initiativeId === "string" ? req.query.initiativeId : undefined;
  return listFeatures({ initiativeId });
}));
productDiscoveryRoutes.post("/features", requireAdmin, handleAsync((req) => createFeature(req.body)));
productDiscoveryRoutes.get("/features/:id", requireAdmin, handleAsync((req) => getFeatureById(req.params.id)));
productDiscoveryRoutes.patch("/features/:id", requireAdmin, handleAsync((req) => updateFeature(req.params.id, req.body)));
