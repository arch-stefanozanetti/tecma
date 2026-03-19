import { Router } from "express";
import { listWorkspaceMembershipRoles } from "../../core/rbac/roleDefinitions.service.js";
import { handleAsync } from "../asyncHandler.js";

export const workspaceRolesRoutes = Router();

workspaceRolesRoutes.get(
  "/workspace-roles",
  handleAsync(async () => {
    const data = await listWorkspaceMembershipRoles();
    return { data };
  })
);
