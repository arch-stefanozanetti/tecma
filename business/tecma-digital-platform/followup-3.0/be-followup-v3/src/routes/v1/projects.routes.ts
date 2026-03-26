import { Router } from "express";
import { createProject, updateProject } from "../../core/projects/projects.service.js";
import {
  listProjectAccess,
  grantProjectAccess,
  revokeProjectAccess,
} from "../../core/projects/project-access.service.js";
import {
  getProjectDetail,
  getProjectPolicies,
  putProjectPolicies,
  getProjectBranding,
  putProjectBranding,
  getProjectEmailConfig,
  putProjectEmailConfig,
  listProjectEmailTemplates,
  createProjectEmailTemplate,
  getProjectEmailTemplate,
  patchProjectEmailTemplate,
  deleteProjectEmailTemplate,
  listProjectPdfTemplates,
  createProjectPdfTemplate,
  getProjectPdfTemplate,
  patchProjectPdfTemplate,
  deleteProjectPdfTemplate,
  getProjectMarketingSettings,
  putProjectMarketingSettings,
  getProjectLegacyOverrides,
  putProjectLegacyOverrides,
} from "../../core/projects/project-config.service.js";
import {
  getProjectWorkflowSettings,
  putProjectWorkflowSettings,
} from "../../core/projects/project-workflow-settings.service.js";
import { handleAsync } from "../asyncHandler.js";
import { getProjectContext } from "../requestContext.js";
import { requireAdmin } from "../authMiddleware.js";
import { requireCanAccessProject } from "../accessMiddleware.js";
import { requirePermission } from "../permissionMiddleware.js";
import { PERMISSIONS } from "../../core/rbac/permissions.js";

export const projectsRoutes = Router();

projectsRoutes.post("/projects", requireAdmin, handleAsync((req) => createProject(req.body)));
projectsRoutes.patch("/projects/:projectId", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return updateProject(projectId, workspaceId, isAdmin, req.body);
}));

projectsRoutes.get("/projects/:projectId/access", requirePermission(PERMISSIONS.SETTINGS_READ), requireCanAccessProject("workspaceId", "projectId"), handleAsync(async (req) => {
  const projectId = req.params.projectId ?? "";
  return listProjectAccess(projectId);
}));
projectsRoutes.post("/projects/:projectId/access", requirePermission(PERMISSIONS.SETTINGS_UPDATE), requireCanAccessProject("workspaceId", "projectId"), handleAsync(async (req) => {
  const projectId = req.params.projectId ?? "";
  const body = req.body as { workspaceId?: string; role?: "owner" | "collaborator" | "viewer" };
  const workspaceId = body.workspaceId ?? "";
  const role = body.role ?? "viewer";
  return grantProjectAccess(projectId, workspaceId, role);
}));
projectsRoutes.delete("/projects/:projectId/access/:workspaceId", requirePermission(PERMISSIONS.SETTINGS_UPDATE), requireCanAccessProject("workspaceId", "projectId"), handleAsync(async (req) => {
  const projectId = req.params.projectId ?? "";
  const workspaceId = req.params.workspaceId ?? "";
  return revokeProjectAccess(projectId, workspaceId);
}));

projectsRoutes.get("/projects/:projectId", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectDetail(projectId, workspaceId, isAdmin);
}));
projectsRoutes.get("/projects/:projectId/policies", requirePermission(PERMISSIONS.SETTINGS_READ), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectPolicies(projectId, workspaceId, isAdmin);
}));
projectsRoutes.put("/projects/:projectId/policies", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return putProjectPolicies(projectId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.get("/projects/:projectId/branding", requirePermission(PERMISSIONS.SETTINGS_READ), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectBranding(projectId, workspaceId, isAdmin);
}));
projectsRoutes.put("/projects/:projectId/branding", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return putProjectBranding(projectId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.get("/projects/:projectId/email-config", requirePermission(PERMISSIONS.SETTINGS_READ), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectEmailConfig(projectId, workspaceId, isAdmin);
}));
projectsRoutes.put("/projects/:projectId/email-config", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return putProjectEmailConfig(projectId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.get("/projects/:projectId/email-templates", requirePermission(PERMISSIONS.SETTINGS_READ), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return listProjectEmailTemplates(projectId, workspaceId, isAdmin);
}));
projectsRoutes.post("/projects/:projectId/email-templates", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return createProjectEmailTemplate(projectId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.get("/projects/:projectId/email-templates/:templateId", requirePermission(PERMISSIONS.SETTINGS_READ), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return getProjectEmailTemplate(projectId, templateId, workspaceId, isAdmin);
}));
projectsRoutes.patch("/projects/:projectId/email-templates/:templateId", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return patchProjectEmailTemplate(projectId, templateId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.delete("/projects/:projectId/email-templates/:templateId", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return deleteProjectEmailTemplate(projectId, templateId, workspaceId, isAdmin);
}));
projectsRoutes.get("/projects/:projectId/pdf-templates", requirePermission(PERMISSIONS.SETTINGS_READ), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return listProjectPdfTemplates(projectId, workspaceId, isAdmin);
}));
projectsRoutes.post("/projects/:projectId/pdf-templates", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return createProjectPdfTemplate(projectId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.get("/projects/:projectId/pdf-templates/:templateId", requirePermission(PERMISSIONS.SETTINGS_READ), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return getProjectPdfTemplate(projectId, templateId, workspaceId, isAdmin);
}));
projectsRoutes.patch("/projects/:projectId/pdf-templates/:templateId", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return patchProjectPdfTemplate(projectId, templateId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.delete("/projects/:projectId/pdf-templates/:templateId", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return deleteProjectPdfTemplate(projectId, templateId, workspaceId, isAdmin);
}));

projectsRoutes.get("/projects/:projectId/marketing-settings", requirePermission(PERMISSIONS.SETTINGS_READ), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectMarketingSettings(projectId, workspaceId, isAdmin);
}));
projectsRoutes.put("/projects/:projectId/marketing-settings", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return putProjectMarketingSettings(projectId, workspaceId, isAdmin, req.body);
}));

projectsRoutes.get("/projects/:projectId/workflow-settings", requirePermission(PERMISSIONS.SETTINGS_READ), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectWorkflowSettings(projectId, workspaceId, isAdmin);
}));
projectsRoutes.put("/projects/:projectId/workflow-settings", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return putProjectWorkflowSettings(projectId, workspaceId, isAdmin, req.body);
}));

projectsRoutes.get("/projects/:projectId/legacy-overrides", requirePermission(PERMISSIONS.SETTINGS_READ), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectLegacyOverrides(projectId, workspaceId, isAdmin);
}));
projectsRoutes.put("/projects/:projectId/legacy-overrides", requirePermission(PERMISSIONS.SETTINGS_UPDATE), handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return putProjectLegacyOverrides(projectId, workspaceId, isAdmin, req.body);
}));
