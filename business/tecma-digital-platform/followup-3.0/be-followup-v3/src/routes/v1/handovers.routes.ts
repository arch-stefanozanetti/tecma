import { Router } from "express";
import {
  queryHandovers,
  getHandoverById,
  getOrCreateHandover,
  getHandoverForApartment,
  patchHandover,
} from "../../core/post-delivery/handovers.service.js";
import { HttpError } from "../../types/http.js";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace, requireCanAccessProject } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";

export const handoversRoutes = Router();

handoversRoutes.post(
  "/handovers/query",
  requirePermission(PERMISSIONS.POST_DELIVERY_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync((req) => queryHandovers(req.body))
);

/** Crea la sessione consegna per l’unità se non esiste (idempotente). */
handoversRoutes.post(
  "/handovers",
  requirePermission(PERMISSIONS.POST_DELIVERY_UPDATE),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync((req) => getOrCreateHandover(req.body, { userId: req.user?.sub }))
);

handoversRoutes.get(
  "/handovers/for-apartment",
  requirePermission(PERMISSIONS.POST_DELIVERY_READ),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync((req) => {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId : "";
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
    const apartmentId = typeof req.query.apartmentId === "string" ? req.query.apartmentId : "";
    if (!workspaceId || !projectId || !apartmentId) {
      throw new HttpError("workspaceId, projectId e apartmentId sono obbligatori", 400);
    }
    return getHandoverForApartment(workspaceId, projectId, apartmentId);
  })
);

handoversRoutes.get(
  "/handovers/:id",
  requirePermission(PERMISSIONS.POST_DELIVERY_READ),
  requireCanAccessWorkspace("workspaceId"),
  handleAsync((req) => getHandoverById(req.params.id, String(req.query.workspaceId ?? "")))
);

handoversRoutes.patch(
  "/handovers/:id",
  requirePermission(PERMISSIONS.POST_DELIVERY_UPDATE),
  requireCanAccessProject("workspaceId", "projectId"),
  handleAsync((req) => patchHandover(req.params.id, req.body, { userId: req.user?.sub }))
);
