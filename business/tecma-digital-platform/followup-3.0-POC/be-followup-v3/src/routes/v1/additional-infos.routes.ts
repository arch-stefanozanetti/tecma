import { Router } from "express";
import {
  listByWorkspace as listAdditionalInfos,
  createAdditionalInfo,
  updateAdditionalInfo,
  deleteAdditionalInfo,
} from "../../core/additional-infos/additional-infos.service.js";
import { requireAdmin } from "../authMiddleware.js";
import { handleAsync } from "../asyncHandler.js";

export const additionalInfosRoutes = Router();

additionalInfosRoutes.get("/workspaces/:workspaceId/additional-infos", handleAsync((req) =>
  listAdditionalInfos(req.params.workspaceId).then((rows) => ({ data: rows }))
));
additionalInfosRoutes.post("/additional-infos", requireAdmin, handleAsync((req) => createAdditionalInfo(req.body)));
additionalInfosRoutes.patch("/additional-infos/:id", requireAdmin, handleAsync((req) =>
  updateAdditionalInfo(req.params.id, req.body)
));
additionalInfosRoutes.delete("/additional-infos/:id", requireAdmin, handleAsync((req) =>
  deleteAdditionalInfo(req.params.id)
));
