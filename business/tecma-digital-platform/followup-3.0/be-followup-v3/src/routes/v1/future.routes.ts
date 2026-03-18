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
  queryClientsLite
} from "../../core/future/future.service.js";
import { record as auditRecord } from "../../core/audit/audit-log.service.js";
import { handleAsync } from "../asyncHandler.js";

export const futureRoutes = Router();

futureRoutes.post("/hc/apartments", handleAsync((req) => upsertHCApartment(req.body)));
futureRoutes.get("/hc/apartments/:apartmentId", handleAsync((req) => getHCApartment(req.params.apartmentId)));
futureRoutes.patch("/hc/apartments/:apartmentId", handleAsync((req) => upsertHCApartment({ ...req.body, apartmentId: req.params.apartmentId })));
futureRoutes.post("/hc/apartments/query", handleAsync((req) => queryHCApartments(req.body)));

futureRoutes.post("/associations/apartment-client", handleAsync(async (req) => {
  const result = await createAssociation(req.body);
  if (result?.association?._id && req.body.workspaceId) {
    auditRecord({
      action: "association.created",
      workspaceId: req.body.workspaceId,
      projectId: req.body.projectId,
      entityType: "association",
      entityId: String(result.association._id),
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
      payload: { apartmentId: req.body.apartmentId, clientId: req.body.clientId },
    }).catch(() => {});
  }
  return result;
}));
futureRoutes.post("/associations/query", handleAsync((req) => queryAssociations(req.body)));
futureRoutes.delete("/associations/:id", handleAsync(async (req) => {
  const result = await deleteAssociation(req.params.id);
  const workspaceId = (result as { workspaceId?: string }).workspaceId ?? "";
  if (workspaceId) {
    auditRecord({
      action: "association.deleted",
      workspaceId,
      projectId: (result as { projectId?: string }).projectId,
      entityType: "association",
      entityId: req.params.id,
      actor: { type: "user", userId: req.user?.sub, email: req.user?.email },
    }).catch(() => {});
  }
  return { deleted: true };
}));

futureRoutes.post("/workflows/complete-flow/preview", handleAsync((req) => previewCompleteFlow(req.body)));
futureRoutes.post("/workflows/complete-flow/execute", handleAsync((req) => executeCompleteFlow(req.body)));

futureRoutes.post("/hc-master/:entity/query", handleAsync((req) => queryHCMaster(req.params.entity, req.body)));
futureRoutes.post("/hc-master/:entity", handleAsync((req) => createHCMaster(req.params.entity, req.body)));
futureRoutes.patch("/hc-master/:entity/:id", handleAsync((req) => updateHCMaster(req.params.entity, req.params.id, req.body)));
futureRoutes.delete("/hc-master/:entity/:id", handleAsync((req) => deleteHCMaster(req.params.entity, req.params.id)));

futureRoutes.get("/templates/configuration", handleAsync((req) => getTemplateConfiguration(req.query.projectId)));
futureRoutes.put("/templates/configuration/:projectId", handleAsync((req) => saveTemplateConfiguration(req.params.projectId, req.body)));
futureRoutes.post("/templates/configuration/:projectId/validate", handleAsync((req) => validateTemplateConfiguration(req.body)));

futureRoutes.post("/clients/lite/query", handleAsync(async (req) => {
  const body = z.object({ workspaceId: z.string().min(1), projectIds: z.array(z.string().min(1)).min(1) }).parse(req.body);
  return { data: await queryClientsLite(body.workspaceId, body.projectIds) };
}));
