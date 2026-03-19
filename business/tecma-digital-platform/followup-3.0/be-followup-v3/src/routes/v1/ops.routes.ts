import { Router } from "express";
import { requireAdmin } from "../authMiddleware.js";
import { handleAsync } from "../asyncHandler.js";
import { HttpError } from "../../types/http.js";
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
  handleAsync((req) => {
    const workspaceId = typeof req.query.workspaceId === "string" ? req.query.workspaceId.trim() : "";
    if (!workspaceId) throw new HttpError("workspaceId query required", 400, { code: "WORKSPACE_REQUIRED" });
    return acknowledgeOperationalAlert(req.params.id, workspaceId);
  }),
);
