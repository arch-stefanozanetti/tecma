import { Router } from "express";
import { z } from "zod";
import {
  upsertHCApartment,
  getHCApartment,
  queryHCApartments,
  createAssociation,
  queryAssociations,
  deleteAssociation,
  previewCompleteFlow,
  executeCompleteFlow,
  queryHCMaster,
  createHCMaster,
  updateHCMaster,
  deleteHCMaster,
  getTemplateConfiguration,
  saveTemplateConfiguration,
  validateTemplateConfiguration,
  queryClientsLite,
} from "../../core/future/future.service.js";
import { getClientCandidates, getApartmentCandidates } from "../../core/matching/matching.service.js";
import { handleAsync } from "../asyncHandler.js";
import { record as auditRecord } from "../../core/audit/audit-log.service.js";
import { safeAsync } from "../../core/shared/safeAsync.js";

export const hcRoutes = Router();

hcRoutes.post("/hc/apartments", handleAsync((req) => upsertHCApartment(req.body)));
hcRoutes.get("/hc/apartments/:apartmentId", handleAsync((req) => getHCApartment(req.params.apartmentId)));
hcRoutes.patch(
  "/hc/apartments/:apartmentId",
  handleAsync((req) => upsertHCApartment({ ...req.body, apartmentId: req.params.apartmentId }))
);
hcRoutes.post("/hc/apartments/query", handleAsync((req) => queryHCApartments(req.body)));

hcRoutes.post(
  "/associations/apartment-client",
  handleAsync(async (req) => {
    const result = await createAssociation(req.body);
    if (result?.association?._id && req.body.workspaceId) {
      safeAsync(auditRecord({
        action: "association.created",
        workspaceId: req.body.workspaceId,
        projectId: req.body.projectId,
        entityType: "association",
        entityId: String(result.association._id),
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
        payload: { apartmentId: req.body.apartmentId, clientId: req.body.clientId },
      }), {
        operation: "audit.association.created",
        workspaceId: req.body.workspaceId,
        projectId: req.body.projectId,
        entityType: "association",
        entityId: String(result.association._id),
        userId: req.user?.sub,
      });
    }
    return result;
  })
);

hcRoutes.post("/associations/query", handleAsync((req) => queryAssociations(req.body)));
hcRoutes.delete(
  "/associations/:id",
  handleAsync(async (req) => {
    const result = await deleteAssociation(req.params.id);
    const workspaceId = (result as { workspaceId?: string }).workspaceId ?? "";
    if (workspaceId) {
      safeAsync(auditRecord({
        action: "association.deleted",
        workspaceId,
        projectId: (result as { projectId?: string }).projectId,
        entityType: "association",
        entityId: req.params.id,
        actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      }), {
        operation: "audit.association.deleted",
        workspaceId,
        projectId: (result as { projectId?: string }).projectId,
        entityType: "association",
        entityId: req.params.id,
        userId: req.user?.sub,
      });
    }
    return { deleted: true };
  })
);

hcRoutes.post("/workflows/complete-flow/preview", handleAsync((req) => previewCompleteFlow(req.body)));
hcRoutes.post("/workflows/complete-flow/execute", handleAsync((req) => executeCompleteFlow(req.body)));

hcRoutes.post("/hc-master/:entity/query", handleAsync((req) => queryHCMaster(req.params.entity, req.body)));
hcRoutes.post("/hc-master/:entity", handleAsync((req) => createHCMaster(req.params.entity, req.body)));
hcRoutes.patch(
  "/hc-master/:entity/:id",
  handleAsync((req) => updateHCMaster(req.params.entity, req.params.id, req.body))
);
hcRoutes.delete("/hc-master/:entity/:id", handleAsync((req) => deleteHCMaster(req.params.entity, req.params.id)));

hcRoutes.get("/templates/configuration", handleAsync((req) => getTemplateConfiguration(req.query.projectId)));
hcRoutes.put(
  "/templates/configuration/:projectId",
  handleAsync((req) => saveTemplateConfiguration(req.params.projectId, req.body))
);
hcRoutes.post(
  "/templates/configuration/:projectId/validate",
  handleAsync((req) => validateTemplateConfiguration(req.body))
);

hcRoutes.post(
  "/clients/lite/query",
  handleAsync(async (req) => {
    const body = z
      .object({ workspaceId: z.string().min(1), projectIds: z.array(z.string().min(1)).min(1) })
      .parse(req.body);
    return { data: await queryClientsLite(body.workspaceId, body.projectIds) };
  })
);

hcRoutes.get(
  "/matching/clients/:id/candidates",
  handleAsync(async (req) => {
    const clientId = req.params.id;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    const projectIds =
      typeof req.query.projectIds === "string"
        ? req.query.projectIds
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : [];
    return getClientCandidates(clientId, workspaceId, projectIds);
  })
);

hcRoutes.get(
  "/matching/apartments/:id/candidates",
  handleAsync(async (req) => {
    const apartmentId = req.params.id;
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    const projectIds =
      typeof req.query.projectIds === "string"
        ? req.query.projectIds
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean)
        : [];
    return getApartmentCandidates(apartmentId, workspaceId, projectIds);
  })
);
