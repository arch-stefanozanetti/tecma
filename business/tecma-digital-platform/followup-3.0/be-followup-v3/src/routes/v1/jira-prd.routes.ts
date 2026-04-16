import { Router } from "express";
import { z } from "zod";
import { handleAsync } from "../asyncHandler.js";
import { requireTecmaAdmin } from "../authMiddleware.js";
import {
  getCatalogForApi,
  getPublishStatus,
  publishSelections,
} from "../../core/jira-prd/jira-prd.service.js";

export const jiraPrdRoutes = Router();

const PublishBodySchema = z.object({
  idTemaList: z.array(z.string().min(1)).min(1),
  force: z.boolean().optional(),
});

jiraPrdRoutes.get(
  "/jira-prd/catalog",
  requireTecmaAdmin,
  handleAsync(async () => {
    const { data } = getCatalogForApi();
    return { data };
  })
);

jiraPrdRoutes.get(
  "/jira-prd/status",
  requireTecmaAdmin,
  handleAsync(async () => {
    return getPublishStatus();
  })
);

jiraPrdRoutes.post(
  "/jira-prd/publish",
  requireTecmaAdmin,
  handleAsync(async (req) => {
    const body = PublishBodySchema.parse(req.body ?? {});
    return publishSelections({ idTemaList: body.idTemaList, force: body.force === true });
  })
);
