import { Router } from "express";
import { createProject } from "../../core/projects/projects.service.js";
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
} from "../../core/projects/project-config.service.js";
import { handleAsync } from "../asyncHandler.js";
import { getProjectContext } from "../requestContext.js";
import { requireAdmin } from "../authMiddleware.js";

export const projectsRoutes = Router();

projectsRoutes.post("/projects", requireAdmin, handleAsync((req) => createProject(req.body)));

projectsRoutes.get("/projects/:projectId", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectDetail(projectId, workspaceId, isAdmin);
}));
projectsRoutes.get("/projects/:projectId/policies", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectPolicies(projectId, workspaceId, isAdmin);
}));
projectsRoutes.put("/projects/:projectId/policies", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return putProjectPolicies(projectId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.get("/projects/:projectId/branding", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectBranding(projectId, workspaceId, isAdmin);
}));
projectsRoutes.put("/projects/:projectId/branding", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return putProjectBranding(projectId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.get("/projects/:projectId/email-config", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return getProjectEmailConfig(projectId, workspaceId, isAdmin);
}));
projectsRoutes.put("/projects/:projectId/email-config", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return putProjectEmailConfig(projectId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.get("/projects/:projectId/email-templates", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return listProjectEmailTemplates(projectId, workspaceId, isAdmin);
}));
projectsRoutes.post("/projects/:projectId/email-templates", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return createProjectEmailTemplate(projectId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.get("/projects/:projectId/email-templates/:templateId", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return getProjectEmailTemplate(projectId, templateId, workspaceId, isAdmin);
}));
projectsRoutes.patch("/projects/:projectId/email-templates/:templateId", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return patchProjectEmailTemplate(projectId, templateId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.delete("/projects/:projectId/email-templates/:templateId", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return deleteProjectEmailTemplate(projectId, templateId, workspaceId, isAdmin);
}));
projectsRoutes.get("/projects/:projectId/pdf-templates", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return listProjectPdfTemplates(projectId, workspaceId, isAdmin);
}));
projectsRoutes.post("/projects/:projectId/pdf-templates", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  return createProjectPdfTemplate(projectId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.get("/projects/:projectId/pdf-templates/:templateId", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return getProjectPdfTemplate(projectId, templateId, workspaceId, isAdmin);
}));
projectsRoutes.patch("/projects/:projectId/pdf-templates/:templateId", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return patchProjectPdfTemplate(projectId, templateId, workspaceId, isAdmin, req.body);
}));
projectsRoutes.delete("/projects/:projectId/pdf-templates/:templateId", handleAsync(async (req) => {
  const { projectId, workspaceId, isAdmin } = getProjectContext(req);
  const templateId = req.params.templateId ?? "";
  return deleteProjectPdfTemplate(projectId, templateId, workspaceId, isAdmin);
}));
