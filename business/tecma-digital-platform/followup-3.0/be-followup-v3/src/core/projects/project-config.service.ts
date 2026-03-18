/**
 * Barrel: config progetto (policies, branding, email, pdf).
 * Implementazioni in project-access, project-detail, project-policies, project-branding, project-email, project-pdf.
 */
export { ensureProjectInWorkspace } from "./project-access.js";
export type { ProjectDetailRow } from "./project-detail.service.js";
export { getProjectDetail } from "./project-detail.service.js";
export type { ProjectPoliciesRow } from "./project-policies.service.js";
export { getProjectPolicies, putProjectPolicies } from "./project-policies.service.js";
export type { ProjectBrandingRow } from "./project-branding.service.js";
export {
  getProjectBranding,
  getProjectBrandingInternal,
  putProjectBranding,
} from "./project-branding.service.js";
export type { ProjectEmailConfigRow, ProjectEmailTemplateRow } from "./project-email.service.js";
export {
  getProjectEmailConfig,
  putProjectEmailConfig,
  listProjectEmailTemplates,
  createProjectEmailTemplate,
  getProjectEmailTemplate,
  patchProjectEmailTemplate,
  deleteProjectEmailTemplate,
} from "./project-email.service.js";
export type { ProjectPdfTemplateRow } from "./project-pdf.service.js";
export {
  listProjectPdfTemplates,
  createProjectPdfTemplate,
  getProjectPdfTemplate,
  patchProjectPdfTemplate,
  deleteProjectPdfTemplate,
} from "./project-pdf.service.js";
