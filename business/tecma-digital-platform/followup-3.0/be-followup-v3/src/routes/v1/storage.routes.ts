import { Router } from "express";
import type { Request } from "express";
import { z } from "zod";
import { handleAsync } from "../asyncHandler.js";
import { requireCanAccessWorkspace } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { getClientIp } from "../requestMeta.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";
import {
  bootstrapProjectFolders,
  createStorageFolder,
  createStorageUploadUrl,
  listStorageObjects,
} from "../../core/storage/storage.service.js";

export const storageRoutes = Router();
const withWorkspaceAccess = requireCanAccessWorkspace("workspaceId");
const resolveAudit = (req: Request) => ({
  actorUserId: typeof req.user?.sub === "string" ? req.user.sub : undefined,
  ip: getClientIp(req),
  userAgent: req.get("user-agent") ?? null,
});

const UploadSchema = z.object({
  bucket: z.string().optional(),
  prefix: z.string().optional(),
  projectId: z.string().optional(),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().nonnegative().optional(),
});

const FolderSchema = z.object({
  bucket: z.string().optional(),
  prefix: z.string().min(1),
  projectId: z.string().optional(),
});

const BootstrapSchema = z.object({
  bucket: z.string().optional(),
  projectId: z.string().min(1),
});

storageRoutes.get(
  "/workspaces/:workspaceId/storage/list",
  requirePermission(PERMISSIONS.APARTMENTS_READ),
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;
    const requestedBucket = typeof req.query.bucket === "string" ? req.query.bucket : undefined;
    const requestedPrefix = typeof req.query.prefix === "string" ? req.query.prefix : undefined;
    const isTecmaAdmin = req.user?.system_role === "tecma_admin";
    return {
      data: await listStorageObjects({
        workspaceId,
        projectId,
        requestedBucket,
        requestedPrefix,
        isTecmaAdmin,
        audit: { ...resolveAudit(req), workspaceId, projectId },
      }),
    };
  })
);

storageRoutes.post(
  "/workspaces/:workspaceId/storage/upload-url",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const input = UploadSchema.parse(req.body ?? {});
    const isTecmaAdmin = req.user?.system_role === "tecma_admin";
    return {
      data: await createStorageUploadUrl({
        workspaceId,
        projectId: input.projectId,
        requestedBucket: input.bucket,
        requestedPrefix: input.prefix,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        isTecmaAdmin,
        audit: { ...resolveAudit(req), workspaceId, projectId: input.projectId },
      }),
    };
  })
);

storageRoutes.post(
  "/workspaces/:workspaceId/storage/folders",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const input = FolderSchema.parse(req.body ?? {});
    const isTecmaAdmin = req.user?.system_role === "tecma_admin";
    return {
      data: await createStorageFolder({
        workspaceId,
        projectId: input.projectId,
        requestedBucket: input.bucket,
        requestedPrefix: input.prefix,
        isTecmaAdmin,
        audit: { ...resolveAudit(req), workspaceId, projectId: input.projectId },
      }),
    };
  })
);

storageRoutes.post(
  "/workspaces/:workspaceId/storage/bootstrap",
  requirePermission(PERMISSIONS.APARTMENTS_UPDATE),
  withWorkspaceAccess,
  handleAsync(async (req) => {
    const workspaceId = req.params.workspaceId ?? "";
    const input = BootstrapSchema.parse(req.body ?? {});
    const isTecmaAdmin = req.user?.system_role === "tecma_admin";
    return {
      data: await bootstrapProjectFolders({
        workspaceId,
        projectId: input.projectId,
        requestedBucket: input.bucket,
        isTecmaAdmin,
        audit: { ...resolveAudit(req), workspaceId, projectId: input.projectId },
      }),
    };
  })
);

