import { z } from 'zod';

// =============================================================================
// Common helpers
// =============================================================================

const ObjectIdLike = z.union([z.string(), z.unknown()]);

// =============================================================================
// Roles & status enums — single source of truth
// =============================================================================

export type WorkspaceRole = 'owner' | 'admin' | 'collaborator' | 'viewer';

export const WorkspaceRoleSchema = z.enum(['owner', 'admin', 'collaborator', 'viewer']);

export const SystemRoleSchema = z.enum(['tecma_admin', 'user']);
export type SystemRole = z.infer<typeof SystemRoleSchema>;

export const ProjectRoleSchema = z.enum(['project_admin', 'project_member', 'project_viewer']);
export type ProjectRole = z.infer<typeof ProjectRoleSchema>;

/**
 * Lifecycle generico di User (può essere "invited" prima di accettare).
 * Mantiene anche le legacy `suspended` e `deactivated` per retro-compat.
 */
export const UserStatusSchema = z.enum([
  'active',
  'invited',
  'disabled',
  'suspended',
  'deactivated',
  'deleted',
]);
export type UserStatus = z.infer<typeof UserStatusSchema>;

/** Lifecycle Workspace/Project (non hanno fase 'invited'). */
export const EntityStatusSchema = z.enum(['active', 'archived', 'suspended', 'deleted']);
export type EntityStatus = z.infer<typeof EntityStatusSchema>;

/**
 * @deprecated usare `UserStatusSchema` o `EntityStatusSchema`.
 * Mantenuto per retro-compat con codice che già lo importa.
 */
export const RecordStatusSchema = UserStatusSchema;
export type RecordStatus = z.infer<typeof RecordStatusSchema>;

// Audit
export const AuditOutcomeSchema = z.enum(['success', 'failure']);
export type AuditOutcome = z.infer<typeof AuditOutcomeSchema>;

/**
 * Severity standard (info/warn/error) + alias per retro-compat:
 * - 'warning' è equivalente a 'warn' nel DB legacy
 * - 'critical' è equivalente a 'error'
 */
export const AuditSeveritySchema = z.enum(['info', 'warn', 'warning', 'error', 'critical']);
export type AuditSeverity = z.infer<typeof AuditSeveritySchema>;

// =============================================================================
// User
// =============================================================================

export const UserSchema = z.object({
  _id: ObjectIdLike,
  email: z.string().email(),
  status: UserStatusSchema.default('active'),

  // Display
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  /** @deprecated usa firstName/lastName */
  name: z.string().optional(),

  // RBAC
  systemRole: SystemRoleSchema.optional(),
  /** @deprecated usa `systemRole` (camelCase). Tenuto per legacy DB/JWT payload. */
  system_role: z.string().optional(),
  /**
   * Workspace in cui nasce l'identità utente.
   * Obbligatorio per utenti non-Tecma nuovi; assente per identità Tecma globali.
   */
  homeWorkspaceId: ObjectIdLike.optional(),
  /**
   * Permessi addizionali rispetto a quelli del ruolo workspace effettivo.
   * Validati da shared-rbac (`isValidPermissionId`); la wildcard `*`
   * e ammessa solo se l'attore e platform admin.
   */
  permissionsOverride: z.array(z.string().min(1)).optional(),
  /** @deprecated usa `permissionsOverride` (camelCase). */
  permissions_override: z.array(z.string().min(1)).optional(),

  // Lifecycle timestamps
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  passwordUpdatedAt: z.string().optional(),
  firstLoginAt: z.string().optional(),
  lastLoginAt: z.string().optional(),
  deactivatedAt: z.string().optional(),
  deactivatedBy: ObjectIdLike.optional(),
  deletedAt: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;

// =============================================================================
// Workspace
// =============================================================================

const WorkspaceBrandingSchema = z
  .object({
    logoUrl: z.string().url().optional(),
    primaryColor: z.string().optional(),
    faviconUrl: z.string().url().optional(),
  })
  .strict();

const WorkspaceBillingSchema = z
  .object({
    plan: z.string().optional(),
    billingEmail: z.string().email().optional(),
    vatNumber: z.string().optional(),
    billingAddress: z.string().optional(),
  })
  .strict();

const WorkspaceSettingsSchema = z
  .object({
    defaultProjectMode: z.string().optional(),
    mfaRequired: z.boolean().optional(),
    sessionTimeoutMinutes: z.number().int().positive().optional(),
    allowedDomains: z.array(z.string()).optional(),
  })
  .strict();

/** Slug: lowercase letters, digits, dashes, underscores. */
const SlugSchema = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);

export const WorkspaceSchema = z.object({
  _id: ObjectIdLike,
  name: z.string().min(1),
  slug: SlugSchema.optional(),
  ownerUserId: ObjectIdLike.optional(),
  status: EntityStatusSchema.default('active'),
  branding: WorkspaceBrandingSchema.optional(),
  billing: WorkspaceBillingSchema.optional(),
  settings: WorkspaceSettingsSchema.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archivedAt: z.string().optional(),
  suspendedAt: z.string().optional(),
  deactivatedAt: z.string().optional(),
  deletedAt: z.string().optional(),
});

export type Workspace = z.infer<typeof WorkspaceSchema>;

// =============================================================================
// Project
// =============================================================================

export const ProjectModeSchema = z.enum(['sale', 'rent', 'mixed']);
export type ProjectMode = z.infer<typeof ProjectModeSchema>;

export const ProjectSchema = z.object({
  _id: ObjectIdLike,
  workspaceId: ObjectIdLike,
  code: z.string().min(1),
  displayName: z.string().min(1),
  mode: ProjectModeSchema.optional(),
  status: EntityStatusSchema.default('active'),
  metadata: z.record(z.unknown()).optional(),
  createdBy: ObjectIdLike.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archivedAt: z.string().optional(),
  suspendedAt: z.string().optional(),
  deletedAt: z.string().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

// =============================================================================
// Workspace Member (membership record in tz_user_workspaces)
// =============================================================================

export const WorkspaceMemberSchema = z.object({
  _id: ObjectIdLike,
  workspaceId: ObjectIdLike,
  userId: ObjectIdLike,
  role: WorkspaceRoleSchema,
  status: UserStatusSchema.default('active'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deactivatedAt: z.string().optional(),
  deletedAt: z.string().optional(),
});

export type WorkspaceMember = z.infer<typeof WorkspaceMemberSchema>;

// =============================================================================
// Invitations & invite tokens
// =============================================================================

export const InvitationSchema = z.object({
  email: z.string().email(),
  workspaceId: z.string().min(1),
  role: WorkspaceRoleSchema,
  projectIds: z.array(z.string().min(1)).default([]),
});

export type Invitation = z.infer<typeof InvitationSchema>;

export const InviteTokenSchema = z.object({
  _id: ObjectIdLike,
  tokenHash: z.string().min(32),
  userId: ObjectIdLike,
  workspaceId: ObjectIdLike.optional(),
  status: z.enum(['active', 'used', 'expired', 'revoked']).default('active'),
  expiresAt: z.string(),
  usedAt: z.string().optional(),
  createdAt: z.string().optional(),
});

export type InviteToken = z.infer<typeof InviteTokenSchema>;

// =============================================================================
// Workspace user project assignments (tz_workspace_user_projects)
// =============================================================================

export const WorkspaceUserProjectSchema = z.object({
  _id: ObjectIdLike,
  workspaceId: ObjectIdLike,
  userId: ObjectIdLike,
  projectId: ObjectIdLike,
  status: z.enum(['active', 'revoked']).default('active'),
  assignedBy: ObjectIdLike.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type WorkspaceUserProject = z.infer<typeof WorkspaceUserProjectSchema>;

// =============================================================================
// Role definitions (tz_roleDefinitions): override DB dei permessi per ruolo
// =============================================================================

export const RoleDefinitionSchema = z.object({
  _id: ObjectIdLike,
  /** Chiave ruolo (es. 'admin', 'collaborator', 'tecma_admin'). */
  roleKey: z.string().min(1),
  /** Lista permessi (id catalogo o '*'). */
  permissions: z.array(z.string().min(1)),
  label: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type RoleDefinition = z.infer<typeof RoleDefinitionSchema>;

// =============================================================================
// Workspace Assets (tz_assets): branding logo, email header, attachments
// =============================================================================

export const AssetKindSchema = z.enum([
  'workspace.logo',
  'workspace.email-header',
  'workspace.favicon',
  'project.logo',
  'project.branding',
  'project.email-header',
  'apartment.floorplan',
  'apartment.gallery',
  'generic',
]);
export type AssetKind = z.infer<typeof AssetKindSchema>;

export const AssetStatusSchema = z.enum(['pending', 'active', 'deleted']);
export type AssetStatus = z.infer<typeof AssetStatusSchema>;

export const AssetSchema = z.object({
  _id: ObjectIdLike,
  workspaceId: z.string().min(1),
  /** Optional project scope (per project-level assets). */
  projectId: z.string().min(1).optional(),
  kind: AssetKindSchema.default('generic'),
  fileName: z.string().min(1),
  contentType: z.string().min(1),
  /** Size in bytes (informational, not enforced if storage is external). */
  byteSize: z.number().int().nonnegative().optional(),
  /** Storage location key (e.g. S3 key) when feature flag is on. */
  storageKey: z.string().min(1).optional(),
  /** Inline base64 fallback when feature flag is off (dev/test). Truncated in list responses. */
  inlineData: z.string().optional(),
  status: AssetStatusSchema.default('active'),
  uploadedBy: ObjectIdLike.optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  deletedAt: z.string().optional(),
});

export type Asset = z.infer<typeof AssetSchema>;

// =============================================================================
// Audit Event (tz_authEvents)
// =============================================================================

export const AuditEventSchema = z.object({
  _id: ObjectIdLike,
  eventType: z.string().min(1),
  actorUserId: z.string().min(1),
  userId: z.string().optional(),
  workspaceId: z.string().optional(),
  projectId: z.string().optional(),
  targetUserId: z.string().optional(),
  outcome: AuditOutcomeSchema.optional(),
  severity: AuditSeveritySchema.default('info'),
  ip: z.string().optional(),
  userAgent: z.string().optional(),
  traceId: z.string().optional(),
  details: z.record(z.unknown()).optional(),
  createdAt: z.string(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// =============================================================================
// API response wrappers (legacy, non Zod)
// =============================================================================

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    status: number;
    traceId?: string;
    details?: Array<{ field: string; messageDetail: string[] }>;
  };
}

export interface PaginationInfo {
  totalDocs: number;
  page: number;
  perPage: number;
  totalPages: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage?: number | null;
  nextPage?: number | null;
}

export interface ApiDataResponse<T> {
  data: T;
}

export interface ApiListResponse<T> {
  data: T[];
  paginationInfo: PaginationInfo;
}
