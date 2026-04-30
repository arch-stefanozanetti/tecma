import { Router } from "express";
import { requireAdmin } from "../authMiddleware.js";
import { handleAsync } from "../asyncHandler.js";
import { acknowledgeOperationalAlert, listOperationalAlerts } from "../../core/ops/operational-alerts.service.js";

export const opsRoutes = Router();

opsRoutes.get(
  "/workspaces/:workspaceId/ops/alerts",
  requireAdmin,
  handleAsync((req) => listOperationalAlerts(req.params.workspaceId)),
);

opsRoutes.post(
  "/ops/alerts/:id/ack",
  requireAdmin,
  handleAsync((req) => acknowledgeOperationalAlert(req.params.id)),
);

