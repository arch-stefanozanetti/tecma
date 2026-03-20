import { Router } from "express";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import {
  getUploadUrl,
  createAsset,
  listAssets,
  getDownloadUrl,
  deleteAsset,
} from "../../core/assets/assets.service.js";

export const assetsRoutes = Router();

const withWorkspaceAccess = requireCanAccessWorkspace("workspaceId");

assetsRoutes.post(
  "/workspaces/:workspaceId/assets/upload-url",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const userId = typeof req.user?.sub === "string" ? req.user.sub : "";
    return getUploadUrl(workspaceId, userId, req.body);
  })
);

assetsRoutes.post(
  "/workspaces/:workspaceId/assets",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const userId = typeof req.user?.sub === "string" ? req.user.sub : "";
    const created = await createAsset(workspaceId, userId, req.body);
    return { data: created };
  })
);

assetsRoutes.get(
  "/workspaces/:workspaceId/assets",
  requirePermission(PERMISSIONS.APARTMENTS_READ),
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const apartmentId = typeof req.query.apartmentId === "string" ? req.query.apartmentId : undefined;
    const type = typeof req.query.type === "string" ? req.query.type : undefined;
    const list = await listAssets(workspaceId, { projectId, apartmentId, type: type as "image" | "document" | "planimetry" | "branding" | undefined });
    return { data: list };
  })
);

assetsRoutes.get(
  "/workspaces/:workspaceId/assets/:assetId/download-url",
  requirePermission(PERMISSIONS.APARTMENTS_READ),
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const assetId = req.params.assetId ?? "";
    return getDownloadUrl(workspaceId, assetId);
  })
);

assetsRoutes.delete(
  "/workspaces/:workspaceId/assets/:assetId",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const assetId = req.params.assetId ?? "";
    await deleteAsset(workspaceId, assetId);
    return { deleted: true };
  })
);
