import crypto from 'node:crypto';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

import { MongoRepository } from '@followup/db';
import {
  hasPermission,
  isTecmaPlatformAdmin,
  normalizeSystemRole,
  PERMISSIONS,
  type Permission,
} from '@followup/shared-rbac';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { toPublicPlatformApiKey } from '../../lib/platformApiKeyPublic.js';
import {
  buildMongoSkip,
  buildMongoSort,
  buildPaginationInfo,
  parsePaginationQuery,
} from '../../lib/pagination.js';
import {
  workspaceInvitationCreateRateLimit,
  workspaceMemberUpdateRateLimit,
  workspacesCreateRateLimit,
} from '../../lib/rateLimitProfiles.js';
import { ensureEncryptedSecret, maskedSecret } from '../../lib/secrets.js';
import {
  activeAccessStatusFilter,
  activeMembershipStatusFilter,
  activeResourceStatusFilter,
  buildUserWorkspaceMembershipFilter,
  expandForStringOrObjectIdIn,
  mongoPrimaryKeyFilter,
  normalizeToStringId,
  workspaceIdFieldFilter,
} from '../../lib/mongoIdentity.js';
import { resolveUserIdentityCandidates } from '../../lib/userIdentity.js';
import { buildSoftDeleteFields, enqueueLifecycleNotice } from '../../lib/lifecycleRetention.js';
import {
  normalizeUserEmail,
  resolveWorkspaceScopedIdentityByEmail,
  userIdFromRecord,
} from '../../lib/workspaceScopedIdentity.js';
import {
  WORKSPACE_PLATFORM_API_KEY_HEADER,
  incrementWorkspacePlatformApiKeyUsage,
  resolveWorkspacePlatformKey,
  type ResolvedWorkspacePlatformKey,
} from '../../lib/workspacePlatformKeyConsumer.js';
import { listWorkspacesForRequester } from './listWorkspacesForRequester.js';
import {
  createdObjectSchema,
  listSchema,
  okDeletedSchema,
  singleObjectSchema,
} from '../../schemas/routeHelpers.js';

const createWorkspaceSchema = z.object({
  name: z.string().min(2),
  mfaRequired: z.boolean().default(false),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).optional(),
  mfaRequired: z.boolean().optional(),
});

const lifecycleReasonSchema = z
  .object({
    reason: z.string().min(1).max(120).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

const createMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'collaborator', 'viewer']),
});

const updateMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'collaborator', 'viewer']).optional(),
  /** `all` = vede tutti i progetti del workspace. `assigned` = solo quelli linkati esplicitamente. */
  accessScope: z.enum(['all', 'assigned']).optional(),
  /** Hex color `#RRGGBB` per visualizzazione calendario (POC parity). */
  calendarDisplayColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Colore richiesto in formato #RRGGBB')
    .optional(),
});

const entitlementUpdateSchema = z.object({
  status: z.enum(['enabled', 'disabled']),
  metadata: z.record(z.unknown()).optional(),
});

const aiConfigSchema = z
  .object({
    provider: z.enum(['claude', 'openai', 'gemini']),
    apiKey: z.string().min(8).max(512).optional(),
    model: z.string().min(1).max(120).optional(),
    temperature: z.number().min(0).max(2).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

const sliceForPagination = <T>(rows: T[], page: number, perPage: number): T[] => {
  const start = (page - 1) * perPage;
  return rows.slice(start, start + perPage);
};

const additionalInfoCreateSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(0).max(10_000).default(''),
  sortOrder: z.number().int().nonnegative().optional(),
});

const additionalInfoUpdateSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  value: z.string().min(0).max(10_000).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const brandingSchema = z
  .object({
    logoUrl: z.string().url().optional(),
    emailHeaderUrl: z.string().url().optional(),
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Colore richiesto in formato #RRGGBB')
      .optional(),
    footerText: z.string().max(500).optional(),
  })
  .strict();

const KNOWN_FEATURES = [
  'ai',
  'analytics',
  'connectors-marketing',
  'email-templates',
  'pdf-templates',
] as const;
const workspaceEntitlementListAllowedSortFields = ['feature', 'status', 'updatedAt'] as const;
const workspaceAdditionalInfoListAllowedSortFields = [
  'sortOrder',
  'createdAt',
  'updatedAt',
] as const;
const workspaceClientListAllowedSortFields = [
  'createdAt',
  'updatedAt',
  'email',
  'firstName',
  'lastName',
  'status',
] as const;

const ACTIVE_FILTER = activeResourceStatusFilter();
const PRIVILEGED_WORKSPACE_ROLES = new Set(['owner', 'admin']);
const hashOpaqueToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const buildInviteAcceptUrl = (token: string): string => {
  const base = (process.env.APP_PUBLIC_URL ?? 'http://localhost:5177').replace(/\/+$/, '');
  return `${base}/invite-accept?token=${encodeURIComponent(token)}`;
};

const decodePathValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const escapeRegexLiteral = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const randomWorkspaceApiKey = (): string => `wk_${crypto.randomBytes(32).toString('base64url')}`;

const sanitizeAiConfigForResponse = (
  doc: Record<string, unknown> | null,
): Record<string, unknown> | null => {
  if (doc == null) return null;
  const sanitized = { ...doc } as Record<string, unknown>;
  const secretMask = maskedSecret(sanitized.apiKey);
  if (secretMask != null) {
    sanitized.apiKey = secretMask;
  }
  return sanitized;
};

const addMemberProjectBodySchema = z.object({
  projectId: z.string().min(1),
});

const entityAssignmentParamsSchema = z.object({
  workspaceId: z.string().min(1),
  entityType: z.enum(['client', 'apartment', 'request']),
  entityId: z.string().min(1).max(256),
});

const entityAssignmentCreateSchema = z.object({
  userId: z.string().min(1),
});

const entityTimelineTypeSchema = z.enum([
  'note',
  'call',
  'email',
  'meeting',
  'assignment',
  'status_change',
  'document',
  'system',
]);

const entityTimelineCreateSchema = z
  .object({
    projectId: z.string().trim().min(1).max(120).optional(),
    type: entityTimelineTypeSchema.default('note'),
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().max(2000).optional(),
  })
  .strict();

const platformApiKeyCreateSchema = z.object({
  label: z.string().min(2).max(120),
  projectIds: z.array(z.string().min(1)).max(100).optional(),
  scopes: z.array(z.string().min(1).max(120)).max(100).optional(),
});

const workspaceInviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(['owner', 'admin', 'collaborator', 'viewer']).default('viewer'),
  projectIds: z.array(z.string().min(1)).max(100).optional(),
});

const clientProjectVisibilitySchema = z
  .object({
    mode: z.enum(['workspace', 'projects']).default('workspace'),
    projectIds: z.array(z.string().min(1)).max(100).default([]),
  })
  .strict();

const clientGdprSchema = z
  .object({
    consentSource: z.enum(['corporate_site', 'project_site', 'manual', 'import']).default('manual'),
    privacyAccepted: z.boolean().default(false),
    marketingConsent: z.boolean().default(false),
    profilingConsent: z.boolean().default(false),
    consentText: z.string().max(2000).optional(),
  })
  .strict();

const clientRequiredStringSchema = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const clientOptionalStringSchema = (maxLength: number) =>
  z.string().trim().max(maxLength).optional();
const clientOptionalNumberSchema = z.number().finite().nonnegative().optional();
const clientTagsSchema = z.array(z.string().trim().min(1).max(80)).max(30).default([]);
const clientStatusSchema = z.enum([
  'lead',
  'prospect',
  'client',
  'contacted',
  'negotiation',
  'won',
  'lost',
]);

const clientFamilySchema = z
  .object({
    householdSize: z.number().int().min(0).max(30).optional(),
    spouseName: clientOptionalStringSchema(160),
    children: z.number().int().min(0).max(20).optional(),
    notes: clientOptionalStringSchema(2000),
  })
  .strict()
  .default({});

const clientProfilingSchema = z
  .object({
    budget: clientOptionalNumberSchema,
    motivation: clientOptionalStringSchema(500),
    preferredTypology: clientOptionalStringSchema(120),
    preferredRooms: z.number().int().min(0).max(30).optional(),
    preferredSurfaceMin: clientOptionalNumberSchema,
    preferredSurfaceMax: clientOptionalNumberSchema,
    preferredPriceMin: clientOptionalNumberSchema,
    preferredPriceMax: clientOptionalNumberSchema,
    notes: clientOptionalStringSchema(2000),
    tags: clientTagsSchema.optional(),
  })
  .strict()
  .default({});

const clientMarketingSchema = z
  .object({
    source: clientOptionalStringSchema(120),
    campaign: clientOptionalStringSchema(160),
    medium: clientOptionalStringSchema(120),
    content: clientOptionalStringSchema(240),
  })
  .strict()
  .default({});

const clientAdditionalInfoSchema = z.record(z.unknown()).default({});

const clientProjectProfileSchema = z
  .object({
    projectId: z.string().trim().min(1).max(120),
    budget: clientOptionalNumberSchema,
    interestLevel: z.enum(['low', 'medium', 'high', 'hot']).optional(),
    preferredTypology: clientOptionalStringSchema(120),
    preferredRooms: z.number().int().min(0).max(30).optional(),
    preferredSurfaceMin: clientOptionalNumberSchema,
    preferredSurfaceMax: clientOptionalNumberSchema,
    preferredPriceMin: clientOptionalNumberSchema,
    preferredPriceMax: clientOptionalNumberSchema,
    notes: clientOptionalStringSchema(2000),
    tags: clientTagsSchema.optional(),
  })
  .strict();

const clientCreateSchema = z
  .object({
    email: z.string().trim().email(),
    firstName: clientRequiredStringSchema(120),
    lastName: clientRequiredStringSchema(120),
    fullName: clientOptionalStringSchema(240),
    phone: clientRequiredStringSchema(80),
    city: clientRequiredStringSchema(120),
    status: clientStatusSchema,
    source: clientOptionalStringSchema(120),
    budget: clientOptionalNumberSchema,
    motivation: clientOptionalStringSchema(500),
    notes: clientOptionalStringSchema(5000),
    family: clientFamilySchema,
    profiling: clientProfilingSchema,
    marketing: clientMarketingSchema,
    additionalInfo: clientAdditionalInfoSchema,
    projectProfiles: z.array(clientProjectProfileSchema).max(100).default([]),
    projectVisibility: clientProjectVisibilitySchema.default({ mode: 'workspace', projectIds: [] }),
    gdpr: clientGdprSchema.default({
      consentSource: 'manual',
      privacyAccepted: false,
      marketingConsent: false,
      profilingConsent: false,
    }),
  })
  .strict();

const clientUpdateSchema = clientCreateSchema
  .partial()
  .extend({
    projectVisibility: clientProjectVisibilitySchema.optional(),
    gdpr: clientGdprSchema.optional(),
    family: clientFamilySchema.optional(),
    profiling: clientProfilingSchema.optional(),
    marketing: clientMarketingSchema.optional(),
    additionalInfo: clientAdditionalInfoSchema.optional(),
    projectProfiles: z.array(clientProjectProfileSchema).max(100).optional(),
  })
  .strict();

type WorkspaceUserDocument = {
  _id: ObjectId | string;
  email: string;
  fullName?: string;
  passwordHash?: string;
  status?: string;
  systemRole?: string;
  system_role?: string;
  homeWorkspaceId?: string;
  permissionsOverride?: string[];
  createdAt?: string;
  updatedAt?: string;
};

type WorkspaceDocument = {
  _id: string;
  name: string;
  mfaRequired?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
  deleteReason?: string;
  purgeEligibleAt?: string;
  archivedAt?: string;
  archivedBy?: string;
  suspendedAt?: string;
  suspendedBy?: string;
  suspendReason?: string;
  restoredAt?: string;
  restoredBy?: string;
};

type WorkspaceMemberDocument = {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  workspaceId: string;
  role?: string;
  accessScope?: string;
  access_scope?: string;
  calendarDisplayColor?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
};

type WorkspaceProjectDocument = {
  _id: string;
  workspaceId: string;
  projectId: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
};

type WorkspaceUserProjectDocument = {
  _id: string;
  workspaceId: string;
  userId: ObjectId | string;
  projectId: string;
  role?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type AuthSessionDocument = {
  _id: unknown;
  userId?: ObjectId | string;
  revokedAt?: string;
  revokedReason?: string;
  updatedAt?: string;
};

type InviteTokenDocument = {
  _id: string;
  tokenHash: string;
  userId: ObjectId | string;
  workspaceId?: string;
  role?: string;
  projectIds?: string[];
  status?: string;
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  revokedAt?: string;
};

type EntityAssignmentDocument = {
  _id: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  userId: ObjectId | string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type EntityTimelineDocument = {
  _id: string;
  workspaceId: string;
  projectId?: string;
  entityType: 'client' | 'apartment' | 'request';
  entityId: string;
  type: z.infer<typeof entityTimelineTypeSchema>;
  title: string;
  description?: string;
  actorUserId: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
};

type PlatformApiKeyDocument = {
  _id: string;
  workspaceId: string;
  label?: string;
  name?: string;
  tokenHash?: string;
  encryptedTokenHash?: string;
  projectIds?: string[];
  scopes?: string[];
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  lastUsedAt?: string;
  revokedAt?: string;
};

type PlatformApiKeyUsageDocument = {
  _id: string;
  workspaceId: string;
  keyId?: string;
  day?: string;
  requests?: number;
  errors?: number;
};

type WorkspaceEntitlementDocument = {
  _id: string;
  workspaceId: string;
  feature: string;
  status?: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

type WorkspaceAiConfigDocument = {
  _id: string;
  workspaceId: string;
  provider?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  enabled?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type WorkspaceAdditionalInfoDocument = {
  _id: string;
  workspaceId: string;
  label: string;
  value?: string;
  sortOrder?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
};

type WorkspaceClientDocument = {
  _id: string;
  workspaceId?: string;
  workspace_id?: string;
  firstName?: string;
  fullName?: string;
  email?: string;
  emailLower?: string;
  lastName?: string;
  phone?: string;
  city?: string;
  status?: string;
  source?: string;
  budget?: number;
  motivation?: string;
  notes?: string;
  family?: Record<string, unknown>;
  profiling?: Record<string, unknown>;
  marketing?: Record<string, unknown>;
  additionalInfo?: Record<string, unknown>;
  projectProfiles?: Array<{
    projectId: string;
    budget?: number;
    interestLevel?: string;
    preferredTypology?: string;
    preferredRooms?: number;
    preferredSurfaceMin?: number;
    preferredSurfaceMax?: number;
    preferredPriceMin?: number;
    preferredPriceMax?: number;
    notes?: string;
    tags?: string[];
  }>;
  projectVisibility?: {
    mode?: 'workspace' | 'projects';
    projectIds?: string[];
  };
  gdpr?: {
    consentSource?: string;
    privacyAccepted?: boolean;
    marketingConsent?: boolean;
    profilingConsent?: boolean;
    consentText?: string;
    updatedAt?: string;
  };
  createdAt?: string;
  updatedAt?: string;
};

type WorkspaceBrandingDocument = {
  _id: string;
  workspaceId: string;
  logoUrl?: string;
  emailHeaderUrl?: string;
  primaryColor?: string;
  footerText?: string;
  createdAt?: string;
  updatedAt?: string;
};

const normalizeEmailLower = (email: string): string => email.trim().toLowerCase();

const normalizeClientFullName = (payload: {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  email?: string;
}): string => {
  const explicit = payload.fullName?.trim();
  if (explicit != null && explicit !== '') return explicit;
  const joined = `${payload.firstName ?? ''} ${payload.lastName ?? ''}`.trim();
  return joined || payload.email?.trim() || '';
};

const normalizeClientVisibility = (
  visibility: z.infer<typeof clientProjectVisibilitySchema> | undefined,
): { mode: 'workspace' | 'projects'; projectIds: string[] } => {
  if (visibility == null || visibility.mode === 'workspace') {
    return { mode: 'workspace', projectIds: [] };
  }
  return { mode: 'projects', projectIds: [...new Set(visibility.projectIds)] };
};

async function assertClientVisibilityProjects(
  app: FastifyInstance,
  workspaceId: string,
  visibility: { mode: 'workspace' | 'projects'; projectIds: string[] },
): Promise<boolean> {
  if (visibility.mode === 'workspace') return true;
  if (visibility.projectIds.length === 0) return false;
  const projectIds = expandForStringOrObjectIdIn(visibility.projectIds);
  const [ownedCount, linkedCount] = await Promise.all([
    app.mongoDb.collection('tz_projects').countDocuments({
      _id: { $in: projectIds },
      ...workspaceIdFieldFilter(workspaceId),
      ...activeResourceStatusFilter(),
    } as any),
    app.mongoDb.collection('tz_workspace_projects').countDocuments({
      workspaceId,
      projectId: { $in: visibility.projectIds },
      ...activeAccessStatusFilter(),
    } as any),
  ]);
  return ownedCount + linkedCount >= visibility.projectIds.length;
}

async function assertClientProjectProfilesProjects(
  app: FastifyInstance,
  workspaceId: string,
  projectProfiles: Array<{ projectId: string }> | undefined,
): Promise<boolean> {
  const projectIds = [
    ...new Set((projectProfiles ?? []).map((profile) => profile.projectId).filter(Boolean)),
  ];
  if (projectIds.length === 0) return true;
  return assertClientVisibilityProjects(app, workspaceId, { mode: 'projects', projectIds });
}

const entityPermission = (
  entityType: 'client' | 'apartment' | 'request',
  mode: 'read' | 'write',
): Permission => {
  if (entityType === 'client') {
    return mode === 'read' ? PERMISSIONS.CLIENTS_READ : PERMISSIONS.CLIENTS_UPDATE;
  }
  if (entityType === 'apartment') {
    return mode === 'read' ? PERMISSIONS.APARTMENTS_READ : PERMISSIONS.APARTMENTS_UPDATE;
  }
  return mode === 'read' ? PERMISSIONS.REQUESTS_READ : PERMISSIONS.REQUESTS_UPDATE;
};

const requesterHasPermission = (
  user: { permissions?: string[]; systemRole?: string; system_role?: string } | undefined,
  permission: Permission,
): boolean => {
  if (isTecmaPlatformAdmin(normalizeSystemRole(user))) return true;
  return hasPermission(user?.permissions ?? [], permission);
};

async function assertEntityInWorkspace(
  app: FastifyInstance,
  workspaceId: string,
  entityType: 'client' | 'apartment' | 'request',
  entityId: string,
): Promise<boolean> {
  if (entityType === 'client') {
    const client = await app.mongoDb.collection('tz_clients').findOne({
      $and: [
        mongoPrimaryKeyFilter(entityId),
        { $or: [{ workspaceId }, { workspace_id: workspaceId }] },
        ACTIVE_FILTER,
      ],
    } as any);
    return client != null;
  }
  if (entityType === 'apartment') {
    const apartment = await app.mongoDb.collection('tz_apartments').findOne({
      ...mongoPrimaryKeyFilter(entityId),
      ...workspaceIdFieldFilter(workspaceId),
      ...ACTIVE_FILTER,
    } as any);
    return apartment != null;
  }
  const request = await app.mongoDb.collection('tz_requests').findOne({
    ...mongoPrimaryKeyFilter(entityId),
    ...workspaceIdFieldFilter(workspaceId),
    ...ACTIVE_FILTER,
  } as any);
  return request != null;
}

async function buildClientVisibilityFilterForRequester(
  app: FastifyInstance,
  workspaceId: string,
  user: { sub?: string; email?: string; systemRole?: string; system_role?: string } | undefined,
): Promise<Record<string, unknown> | null> {
  if (user?.sub == null) return { _id: { $exists: false } };
  if (isTecmaPlatformAdmin(normalizeSystemRole(user))) return null;

  const identityCandidates = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
  const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
    ...buildUserWorkspaceMembershipFilter(workspaceId, identityCandidates),
    ...activeMembershipStatusFilter(),
  } as any);
  if (membership == null) return { _id: { $exists: false } };

  const accessScope = String(
    (membership as { accessScope?: unknown; access_scope?: unknown }).accessScope ??
      (membership as { access_scope?: unknown }).access_scope ??
      '',
  ).toLowerCase();
  const role = String((membership as { role?: unknown }).role ?? '').toLowerCase();
  if (['owner', 'admin'].includes(role) || accessScope === 'all' || accessScope === 'workspace') {
    return null;
  }

  const assignments = await app.mongoDb
    .collection('tz_workspace_user_projects')
    .find({
      workspaceId,
      userId: { $in: expandForStringOrObjectIdIn(identityCandidates) },
      ...activeAccessStatusFilter(),
    } as any)
    .toArray();
  const assignedProjectIds = [
    ...new Set(
      assignments
        .map((row) => normalizeToStringId((row as { projectId?: unknown }).projectId))
        .filter((id): id is string => id != null),
    ),
  ];

  if (assignedProjectIds.length === 0) return { _id: { $exists: false } };
  return {
    $or: [
      { 'projectVisibility.mode': { $exists: false } },
      { 'projectVisibility.mode': 'workspace' },
      { 'projectVisibility.projectIds': { $in: assignedProjectIds } },
    ],
  };
}

export const workspacesRoutes = async (app: FastifyInstance): Promise<void> => {
  const usersRepo = new MongoRepository<WorkspaceUserDocument>(
    app.mongoDb.collection<WorkspaceUserDocument>('tz_users'),
  );
  const workspacesRepo = new MongoRepository<WorkspaceDocument>(
    app.mongoDb.collection<WorkspaceDocument>('tz_workspaces'),
  );
  const membersRepo = new MongoRepository<WorkspaceMemberDocument>(
    app.mongoDb.collection<WorkspaceMemberDocument>('tz_user_workspaces'),
  );
  const workspaceProjectsRepo = new MongoRepository<WorkspaceProjectDocument>(
    app.mongoDb.collection<WorkspaceProjectDocument>('tz_workspace_projects'),
  );
  const workspaceUserProjectsRepo = new MongoRepository<WorkspaceUserProjectDocument>(
    app.mongoDb.collection<WorkspaceUserProjectDocument>('tz_workspace_user_projects'),
  );
  const authSessionsRepo = new MongoRepository<AuthSessionDocument>(
    app.mongoDb.collection<AuthSessionDocument>('tz_authSessions'),
  );
  const inviteTokensRepo = new MongoRepository<InviteTokenDocument>(
    app.mongoDb.collection<InviteTokenDocument>('tz_inviteTokens'),
  );
  const entityAssignmentsRepo = new MongoRepository<EntityAssignmentDocument>(
    app.mongoDb.collection<EntityAssignmentDocument>('tz_workspace_entity_assignments'),
  );
  const entityTimelineRepo = new MongoRepository<EntityTimelineDocument>(
    app.mongoDb.collection<EntityTimelineDocument>('tz_entity_timeline'),
  );
  const platformApiKeysRepo = new MongoRepository<PlatformApiKeyDocument>(
    app.mongoDb.collection<PlatformApiKeyDocument>('tz_workspace_platform_api_keys'),
  );
  const platformApiKeyUsageRepo = new MongoRepository<PlatformApiKeyUsageDocument>(
    app.mongoDb.collection<PlatformApiKeyUsageDocument>('tz_workspace_platform_api_key_usage'),
  );
  const workspaceListAllowedSortFields = ['name', 'createdAt', 'updatedAt'] as const;
  const workspaceMemberListAllowedSortFields = [
    'role',
    'userId',
    'createdAt',
    'updatedAt',
  ] as const;
  const memberProjectAssignmentAllowedSortFields = [
    'projectId',
    'role',
    'createdAt',
    'updatedAt',
  ] as const;
  const entityAssignmentAllowedSortFields = [
    'entityType',
    'entityId',
    'userId',
    'createdAt',
    'updatedAt',
  ] as const;
  const entityTimelineAllowedSortFields = ['createdAt', 'type'] as const;
  const platformApiKeyAllowedSortFields = ['name', 'createdAt', 'updatedAt', 'lastUsedAt'] as const;

  const createEntityTimelineEvent = async (input: {
    workspaceId: string;
    projectId?: string;
    entityType: 'client' | 'apartment' | 'request';
    entityId: string;
    type: z.infer<typeof entityTimelineTypeSchema>;
    title: string;
    description?: string;
    actorUserId: string;
    createdAt?: string;
  }): Promise<EntityTimelineDocument> => {
    const now = input.createdAt ?? new Date().toISOString();
    const doc: EntityTimelineDocument = {
      _id: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      entityType: input.entityType,
      entityId: input.entityId,
      type: input.type,
      title: input.title,
      description: input.description,
      actorUserId: input.actorUserId,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await entityTimelineRepo.create(doc);
    return doc;
  };

  app.get(
    '/v1/workspaces',
    {
      preHandler: [app.authenticate, app.requirePermission('workspaces.read')],
      schema: listSchema(
        'listWorkspaces',
        'Workspaces',
        'Elenco workspace',
        'Elenco workspace visibili al chiamante. Per Tecma SuperAdmin restituisce tutti i record in `tz_workspaces`; per gli altri utenti solo i workspace con membership risolta da sub/email/ObjectId.',
      ),
    },
    async (request: FastifyRequest, reply) => {
      const paginationParams = parsePaginationQuery(request.query, workspaceListAllowedSortFields);
      const sortEntries = Object.entries(buildMongoSort(paginationParams, 'name'));
      const allRows = await listWorkspacesForRequester(app, {
        sub: (request.user as { sub: string }).sub,
        email: (request.user as { email: string }).email,
        systemRole: (request.user as { systemRole?: string }).systemRole,
        system_role: (request.user as { system_role?: string }).system_role,
      });
      const start = buildMongoSkip(paginationParams);
      const data = [...allRows]
        .sort((a, b) => {
          for (const [field, dir] of sortEntries) {
            const av = String((a as Record<string, unknown>)[field] ?? '');
            const bv = String((b as Record<string, unknown>)[field] ?? '');
            const cmp = av.localeCompare(bv, 'it', { numeric: true, sensitivity: 'base' });
            if (cmp !== 0) return dir === 1 ? cmp : -cmp;
          }
          return 0;
        })
        .slice(start, start + paginationParams.perPage);
      return reply.send({
        data,
        paginationInfo: buildPaginationInfo(allRows.length, paginationParams),
      });
    },
  );

  app.post(
    '/v1/workspaces',
    {
      config: { rateLimit: workspacesCreateRateLimit(app.config) },
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...createdObjectSchema('createWorkspace', 'Workspaces', 'Crea workspace'),
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 2 },
            mfaRequired: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = createWorkspaceSchema.parse(request.body);
      const now = new Date().toISOString();

      const doc = {
        _id: crypto.randomUUID(),
        name: payload.name,
        owner_user_id: (request.user as { sub?: string } | undefined)?.sub,
        mfaRequired: payload.mfaRequired,
        createdAt: now,
        updatedAt: now,
      };

      await workspacesRepo.create(doc);
      await app.auditService.authEvent({
        eventType: 'workspaces.create',
        userId: (request.user as { sub?: string } | undefined)?.sub ?? 'system',
        details: { workspaceId: doc._id, isTecmaAdmin: true },
      });
      return reply.status(201).send({ data: doc });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId',
    {
      preHandler: [
        app.authenticate,
        app.requirePermission('workspaces.read'),
        app.requireCanAccessWorkspace(),
      ],
      schema: {
        ...singleObjectSchema('getWorkspaceById', 'Workspaces', 'Dettaglio workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const workspace = await workspacesRepo.findOne({ _id: params.workspaceId, ...ACTIVE_FILTER });
      if (!workspace) {
        return reply.status(404).send({
          error: { code: 'WorkspaceNotFound', message: 'Workspace not found', status: 404 },
        });
      }
      return reply.send({ data: workspace });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema('patchWorkspace', 'Workspaces', 'Aggiorna workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2 },
            mfaRequired: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = updateWorkspaceSchema.parse(request.body);
      const actor = request.user as { sub?: string; systemRole?: string; system_role?: string };
      await workspacesRepo.updateOne(
        { _id: params.workspaceId, ...ACTIVE_FILTER },
        { $set: { ...payload, updatedAt: new Date().toISOString() } },
      );
      if (isTecmaPlatformAdmin(normalizeSystemRole(actor))) {
        await app.auditService.authEvent({
          eventType: 'workspaces.update.tecma_admin',
          userId: actor.sub ?? 'system',
          details: { workspaceId: params.workspaceId, patch: payload },
        });
      }
      const workspace = await workspacesRepo.findOne({ _id: params.workspaceId, ...ACTIVE_FILTER });
      return reply.send({ data: workspace });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...okDeletedSchema('deleteWorkspace', 'Workspaces', 'Elimina workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const now = new Date().toISOString();
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const softDeleteFields = buildSoftDeleteFields({
        actorId,
        now,
        reason: 'workspace_deleted_by_tecma',
      });
      const workspaceUpdate = await workspacesRepo.updateOne(
        { _id: params.workspaceId, ...ACTIVE_FILTER },
        { $set: softDeleteFields },
      );
      if (workspaceUpdate.matchedCount === 0) {
        return reply.status(404).send({
          error: { code: 'WorkspaceNotFound', message: 'Workspace not found', status: 404 },
        });
      }

      await membersRepo.updateMany(
        { workspaceId: params.workspaceId, ...ACTIVE_FILTER } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            deletedReason: 'workspace_deleted_by_tecma',
            deleteReason: 'workspace_deleted_by_tecma',
            purgeEligibleAt: softDeleteFields.purgeEligibleAt,
            updatedAt: now,
          },
        } as any,
      );
      await workspaceProjectsRepo.updateMany(
        { workspaceId: params.workspaceId, ...ACTIVE_FILTER } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            deletedReason: 'workspace_deleted_by_tecma',
            deleteReason: 'workspace_deleted_by_tecma',
            purgeEligibleAt: softDeleteFields.purgeEligibleAt,
            updatedAt: now,
          },
        } as any,
      );
      await workspaceUserProjectsRepo.updateMany(
        { workspaceId: params.workspaceId, ...ACTIVE_FILTER } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            deletedReason: 'workspace_deleted_by_tecma',
            deleteReason: 'workspace_deleted_by_tecma',
            purgeEligibleAt: softDeleteFields.purgeEligibleAt,
            updatedAt: now,
          },
        } as any,
      );
      await app.auditService.authEvent({
        eventType: 'workspaces.delete',
        userId: actorId,
        details: {
          workspaceId: params.workspaceId,
          retentionDays: 90,
          purgeEligibleAt: softDeleteFields.purgeEligibleAt,
        },
      });
      await enqueueLifecycleNotice(app, {
        entityType: 'workspace',
        entityId: params.workspaceId,
        eventType: 'workspace.soft_deleted',
        actorId,
        reason: 'workspace_deleted_by_tecma',
        purgeEligibleAt: String(softDeleteFields.purgeEligibleAt),
        recipients: [{ kind: 'tecma' }],
      });
      return reply.send({ data: { deleted: true } });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/archive',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...singleObjectSchema('archiveWorkspace', 'Workspaces', 'Archivia workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const now = new Date().toISOString();

      const ws = await workspacesRepo.findOne({
        _id: params.workspaceId,
        status: { $nin: ['deleted', 'deactivated', 'suspended'] },
      } as any);
      if (ws == null) {
        return reply.status(404).send({
          error: { code: 'WorkspaceNotFound', message: 'Workspace not found', status: 404 },
        });
      }
      if (String((ws as { status?: unknown }).status) === 'archived') {
        return reply.status(409).send({
          error: { code: 'AlreadyArchived', message: 'Workspace is already archived', status: 409 },
        });
      }

      await workspacesRepo.updateOne(
        { _id: params.workspaceId },
        { $set: { status: 'archived', archivedAt: now, archivedBy: actorId, updatedAt: now } },
      );
      await app.auditService.authEvent({
        eventType: 'workspaces.archive',
        userId: actorId,
        details: { workspaceId: params.workspaceId },
      });
      return reply.send({ data: { archived: true } });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/restore',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...singleObjectSchema('restoreWorkspace', 'Workspaces', 'Ripristina workspace archiviato'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const now = new Date().toISOString();

      const ws = await workspacesRepo.findOne({ _id: params.workspaceId });
      if (ws == null || String((ws as { status?: unknown }).status) === 'deleted') {
        return reply.status(404).send({
          error: { code: 'WorkspaceNotFound', message: 'Workspace not found', status: 404 },
        });
      }
      if (String((ws as { status?: unknown }).status) !== 'archived') {
        return reply.status(409).send({
          error: { code: 'NotArchived', message: 'Workspace is not archived', status: 409 },
        });
      }

      await workspacesRepo.updateOne(
        { _id: params.workspaceId },
        {
          $set: { status: 'active', restoredAt: now, restoredBy: actorId, updatedAt: now },
          $unset: { archivedAt: '', archivedBy: '' },
        },
      );
      await app.auditService.authEvent({
        eventType: 'workspaces.restore',
        userId: actorId,
        details: { workspaceId: params.workspaceId },
      });
      return reply.send({ data: { restored: true } });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/suspend',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...singleObjectSchema('suspendWorkspace', 'Workspaces', 'Sospendi workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            reason: { type: 'string', minLength: 1, maxLength: 120 },
            note: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = lifecycleReasonSchema.parse(request.body ?? {});
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const now = new Date().toISOString();

      const ws = await workspacesRepo.findOne({ _id: params.workspaceId });
      if (ws == null || String((ws as { status?: unknown }).status) === 'deleted') {
        return reply.status(404).send({
          error: { code: 'WorkspaceNotFound', message: 'Workspace not found', status: 404 },
        });
      }
      if (String((ws as { status?: unknown }).status) === 'suspended') {
        return reply.status(409).send({
          error: {
            code: 'AlreadySuspended',
            message: 'Workspace is already suspended',
            status: 409,
          },
        });
      }

      const reason = payload.reason ?? 'billing';
      await workspacesRepo.updateOne(
        { _id: params.workspaceId },
        {
          $set: {
            status: 'suspended',
            suspendedAt: now,
            suspendedBy: actorId,
            suspendReason: reason,
            suspendNote: payload.note,
            updatedAt: now,
          },
        },
      );
      await app.auditService.authEvent({
        eventType: 'workspaces.suspend',
        userId: actorId,
        details: { workspaceId: params.workspaceId, reason },
      });
      await enqueueLifecycleNotice(app, {
        entityType: 'workspace',
        entityId: params.workspaceId,
        eventType: 'workspace.suspended',
        actorId,
        reason,
        recipients: [{ kind: 'tecma' }],
      });
      return reply.send({ data: { suspended: true } });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/resume',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...singleObjectSchema('resumeWorkspace', 'Workspaces', 'Riattiva workspace sospeso'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            reason: { type: 'string', minLength: 1, maxLength: 120 },
            note: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = lifecycleReasonSchema.parse(request.body ?? {});
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const now = new Date().toISOString();

      const ws = await workspacesRepo.findOne({ _id: params.workspaceId });
      if (ws == null || String((ws as { status?: unknown }).status) === 'deleted') {
        return reply.status(404).send({
          error: { code: 'WorkspaceNotFound', message: 'Workspace not found', status: 404 },
        });
      }
      if (String((ws as { status?: unknown }).status) !== 'suspended') {
        return reply.status(409).send({
          error: { code: 'NotSuspended', message: 'Workspace is not suspended', status: 409 },
        });
      }

      await workspacesRepo.updateOne(
        { _id: params.workspaceId },
        {
          $set: {
            status: 'active',
            resumedAt: now,
            resumedBy: actorId,
            resumeReason: payload.reason ?? 'manual',
            resumeNote: payload.note,
            updatedAt: now,
          },
          $unset: { suspendedAt: '', suspendedBy: '', suspendReason: '', suspendNote: '' },
        },
      );
      await app.auditService.authEvent({
        eventType: 'workspaces.resume',
        userId: actorId,
        details: { workspaceId: params.workspaceId, reason: payload.reason ?? 'manual' },
      });
      return reply.send({ data: { resumed: true } });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/transfer-ownership',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireWorkspaceRole(['owner'])],
      schema: {
        ...singleObjectSchema(
          'transferWorkspaceOwnership',
          'Workspaces',
          'Trasferisci proprietà workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['newOwnerId'],
          properties: {
            newOwnerId: { type: 'string', description: 'UserId del nuovo owner' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const body = request.body as { newOwnerId: string };
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const now = new Date().toISOString();

      // Validate new owner is an active member with at least admin role.
      const newOwnerMembership = await membersRepo.findOne({
        workspaceId: params.workspaceId,
        userId: body.newOwnerId,
        ...ACTIVE_FILTER,
      });
      if (newOwnerMembership == null) {
        return reply.status(404).send({
          error: {
            code: 'MemberNotFound',
            message: 'New owner must be an existing workspace member',
            status: 404,
          },
        });
      }
      const newOwnerRole = String((newOwnerMembership as { role?: unknown }).role ?? '');
      if (!PRIVILEGED_WORKSPACE_ROLES.has(newOwnerRole)) {
        return reply.status(409).send({
          error: {
            code: 'InvalidNewOwnerRole',
            message: 'New owner must currently be owner or admin',
            status: 409,
          },
        });
      }
      if (body.newOwnerId === actorId) {
        return reply.status(409).send({
          error: {
            code: 'SameOwner',
            message: 'New owner must be a different user',
            status: 409,
          },
        });
      }

      // Demote current owner to admin, promote new owner to owner.
      await membersRepo.updateOne(
        { workspaceId: params.workspaceId, userId: actorId, ...ACTIVE_FILTER },
        { $set: { role: 'admin', updatedAt: now } },
      );
      await membersRepo.updateOne(
        { workspaceId: params.workspaceId, userId: body.newOwnerId, ...ACTIVE_FILTER },
        { $set: { role: 'owner', updatedAt: now } },
      );
      await app.auditService.authEvent({
        eventType: 'workspaces.transfer_ownership',
        userId: actorId,
        details: {
          workspaceId: params.workspaceId,
          previousOwnerId: actorId,
          newOwnerId: body.newOwnerId,
        },
      });
      return reply.send({ data: { transferred: true, newOwnerId: body.newOwnerId } });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/members',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema('listWorkspaceMembers', 'Workspaces', 'Membri workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: workspaceMemberListAllowedSortFields },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const paginationParams = parsePaginationQuery(
        request.query,
        workspaceMemberListAllowedSortFields,
      );
      const filter = { workspaceId: params.workspaceId, ...ACTIVE_FILTER };
      const totalDocs = await membersRepo.count(filter);
      const members = await membersRepo.listPaginated(filter, {
        skip: buildMongoSkip(paginationParams),
        limit: paginationParams.perPage,
        sort: buildMongoSort(paginationParams, 'createdAt'),
      });
      return reply.send({
        data: members,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/members',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...createdObjectSchema('addWorkspaceMember', 'Workspaces', 'Aggiungi membro'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['userId', 'role'],
          properties: {
            userId: { type: 'string' },
            role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = createMemberSchema.parse(request.body);
      const doc = {
        _id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        userId: payload.userId,
        role: payload.role,
        access_scope: 'workspace',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await membersRepo.create(doc);
      return reply.status(201).send({ data: doc });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId/members/:userId',
    {
      config: { rateLimit: workspaceMemberUpdateRateLimit(app.config) },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'patchWorkspaceMember',
          'Workspaces',
          'Aggiorna ruolo membro / access scope / colore calendario',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
            accessScope: {
              type: 'string',
              enum: ['all', 'assigned'],
              description: 'Strategia di visibilita progetti per il membro',
            },
            calendarDisplayColor: {
              type: 'string',
              pattern: '^#[0-9A-Fa-f]{6}$',
              description: 'Colore visualizzazione calendario (#RRGGBB)',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; userId: string };
      const payload = updateMemberSchema.parse(request.body);
      const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (payload.role != null) update.role = payload.role;
      if (payload.accessScope != null) update.accessScope = payload.accessScope;
      if (payload.calendarDisplayColor != null) {
        update.calendarDisplayColor = payload.calendarDisplayColor;
      }
      await membersRepo.updateOne(
        { workspaceId: params.workspaceId, userId: params.userId, ...ACTIVE_FILTER },
        { $set: update },
      );
      const member = await membersRepo.findOne({
        workspaceId: params.workspaceId,
        userId: params.userId,
        ...ACTIVE_FILTER,
      });
      return reply.send({ data: member });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/members/:userId',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...okDeletedSchema('removeWorkspaceMember', 'Workspaces', 'Rimuovi membro'),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; userId: string };
      const now = new Date().toISOString();
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const targetUser = await usersRepo.findOne({
        _id: { $in: expandForStringOrObjectIdIn([params.userId]) },
        status: { $ne: 'deleted' },
      } as any);
      const targetIsHomeIdentity =
        targetUser != null &&
        String((targetUser as { homeWorkspaceId?: unknown }).homeWorkspaceId ?? '') ===
          params.workspaceId;

      const result = await membersRepo.updateOne(
        { workspaceId: params.workspaceId, userId: params.userId, ...ACTIVE_FILTER },
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            updatedAt: now,
          },
        },
      );
      if (result.matchedCount === 0) {
        return reply.status(404).send({
          error: {
            code: 'WorkspaceMemberNotFound',
            message: 'Workspace member not found',
            status: 404,
          },
        });
      }

      if (targetIsHomeIdentity) {
        const softDeleteFields = buildSoftDeleteFields({
          actorId,
          now,
          reason: 'home_workspace_member_removed',
        });
        await usersRepo.updateOne(
          { _id: { $in: expandForStringOrObjectIdIn([params.userId]) } } as any,
          { $set: softDeleteFields, $inc: { authTokenVersion: 1 } } as any,
        );
        const membershipsResult = await membersRepo.updateMany(
          {
            userId: { $in: expandForStringOrObjectIdIn([params.userId]) },
            status: { $ne: 'deleted' },
          } as any,
          {
            $set: {
              status: 'deleted',
              deletedAt: now,
              deletedBy: actorId,
              deletedReason: 'home_workspace_member_removed',
              deleteReason: 'home_workspace_member_removed',
              purgeEligibleAt: softDeleteFields.purgeEligibleAt,
              updatedAt: now,
            },
          } as any,
        );
        const projectGrantsResult = await workspaceUserProjectsRepo.updateMany(
          {
            userId: { $in: expandForStringOrObjectIdIn([params.userId]) },
            status: { $ne: 'revoked' },
          } as any,
          {
            $set: {
              status: 'revoked',
              revokedAt: now,
              revokedBy: actorId,
              revokedReason: 'user_identity_deleted',
              updatedAt: now,
            },
          } as any,
        );
        const sessionsRevoked = await authSessionsRepo.deleteMany({ userId: params.userId });
        await inviteTokensRepo.updateMany(
          { userId: params.userId, status: 'active' } as any,
          {
            $set: { status: 'revoked', revokedAt: now, revokedBy: actorId, updatedAt: now },
          } as any,
        );
        await app.auditService.authEvent({
          eventType: 'user.identity.deleted',
          actorUserId: actorId,
          targetUserId: params.userId,
          workspaceId: params.workspaceId,
          outcome: 'success',
          details: {
            reason: 'home_workspace_member_removed',
            purgeEligibleAt: softDeleteFields.purgeEligibleAt,
            cascadeMembershipsDeleted: membershipsResult.modifiedCount,
            cascadeProjectGrantsRevoked: projectGrantsResult.modifiedCount,
            revokedAuthSessions: sessionsRevoked.deletedCount,
          },
        });
        return reply.send({
          data: {
            deleted: true,
            identityDeleted: true,
            cascadeMembershipsDeleted: membershipsResult.modifiedCount,
            cascadeRevokedProjectGrants: projectGrantsResult.modifiedCount,
            revokedAuthSessions: sessionsRevoked.deletedCount,
          },
        });
      }

      const cascadeResult = await workspaceUserProjectsRepo.updateMany(
        {
          workspaceId: params.workspaceId,
          userId: params.userId,
          status: { $ne: 'revoked' },
        } as any,
        {
          $set: {
            status: 'revoked',
            revokedAt: now,
            revokedBy: actorId,
            revokedReason: 'workspace_member_removed',
            updatedAt: now,
          },
        } as any,
      );
      await usersRepo.updateMany(
        { _id: { $in: expandForStringOrObjectIdIn([params.userId]) } } as any,
        { $inc: { authTokenVersion: 1 }, $set: { updatedAt: now } } as any,
      );

      // Audit dell'azione (cascade incluso) per tracciabilità.
      await app.auditService.authEvent({
        eventType: 'user.workspace_link.removed',
        actorUserId: actorId,
        targetUserId: params.userId,
        workspaceId: params.workspaceId,
        outcome: 'success',
        details: {
          cascadeRevokedProjectGrants: cascadeResult.modifiedCount,
        },
      });

      return reply.send({
        data: {
          deleted: true,
          cascadeRevokedProjectGrants: cascadeResult.modifiedCount,
        },
      });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/members/:userId/projects',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema(
          'listMemberProjectAssignments',
          'Workspaces',
          'Progetti assegnati al membro nel workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: memberProjectAssignmentAllowedSortFields },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; userId: string };
      const paginationParams = parsePaginationQuery(
        request.query,
        memberProjectAssignmentAllowedSortFields,
      );
      const filter = {
        workspaceId: params.workspaceId,
        userId: params.userId,
        ...ACTIVE_FILTER,
      };
      const totalDocs = await workspaceUserProjectsRepo.count(filter);
      const rows = await workspaceUserProjectsRepo.listPaginated(filter, {
        sort: buildMongoSort(paginationParams, 'createdAt'),
        skip: buildMongoSkip(paginationParams),
        limit: paginationParams.perPage,
      });
      return reply.send({
        data: rows,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/members/:userId/projects',
    {
      config: {
        rateLimit: {
          max: 40,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...createdObjectSchema(
          'addMemberProjectAssignment',
          'Workspaces',
          'Assegna progetto a un membro del workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; userId: string };
      const payload = addMemberProjectBodySchema.parse(request.body);

      const member = await membersRepo.findOne({
        workspaceId: params.workspaceId,
        userId: params.userId,
        ...ACTIVE_FILTER,
      });
      if (member == null) {
        return reply.status(404).send({
          error: {
            code: 'WorkspaceMemberNotFound',
            message: 'User is not a member of this workspace',
            status: 404,
          },
        });
      }

      const link = await workspaceProjectsRepo.findOne({
        workspaceId: params.workspaceId,
        projectId: payload.projectId,
        ...ACTIVE_FILTER,
      });
      if (link == null) {
        return reply.status(400).send({
          error: {
            code: 'ProjectNotInWorkspace',
            message: 'Project is not associated with this workspace',
            status: 400,
          },
        });
      }

      const existing = await workspaceUserProjectsRepo.findOne({
        workspaceId: params.workspaceId,
        userId: params.userId,
        projectId: payload.projectId,
        ...ACTIVE_FILTER,
      });
      if (existing != null) {
        return reply.status(409).send({
          error: {
            code: 'AssignmentExists',
            message: 'Project assignment already exists for this member',
            status: 409,
          },
        });
      }

      const now = new Date().toISOString();
      const doc = {
        _id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        userId: params.userId,
        projectId: payload.projectId,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await workspaceUserProjectsRepo.create(doc);
      return reply.status(201).send({ data: doc });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/members/:userId/projects/:projectId',
    {
      config: {
        rateLimit: {
          max: 40,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...okDeletedSchema(
          'removeMemberProjectAssignment',
          'Workspaces',
          'Rimuovi assegnazione progetto per un membro',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId', 'projectId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
            projectId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as {
        workspaceId: string;
        userId: string;
        projectId: string;
      };
      const now = new Date().toISOString();
      const res = await workspaceUserProjectsRepo.updateOne(
        {
          workspaceId: params.workspaceId,
          userId: params.userId,
          projectId: params.projectId,
          status: { $ne: 'deleted' },
        } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: (request.user as { sub?: string } | undefined)?.sub ?? 'system',
            updatedAt: now,
          },
        },
      );
      if (res.matchedCount === 0) {
        return reply.status(404).send({
          error: {
            code: 'AssignmentNotFound',
            message: 'Project assignment not found for this member',
            status: 404,
          },
        });
      }
      return reply.send({ data: { deleted: true } });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/entities/:entityType/:entityId/assignments',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema(
          'listWorkspaceEntityAssignments',
          'Workspaces',
          'Elenco assegnazioni utenti per una entita del workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'entityType', 'entityId'],
          properties: {
            workspaceId: { type: 'string' },
            entityType: { type: 'string' },
            entityId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: entityAssignmentAllowedSortFields },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          },
        },
      },
    },
    async (request, reply) => {
      const rawParams = request.params as {
        workspaceId: string;
        entityType: string;
        entityId: string;
      };
      const params = entityAssignmentParamsSchema.parse({
        workspaceId: rawParams.workspaceId,
        entityType: decodePathValue(rawParams.entityType),
        entityId: decodePathValue(rawParams.entityId),
      });
      const paginationParams = parsePaginationQuery(
        request.query,
        entityAssignmentAllowedSortFields,
      );
      const filter = {
        workspaceId: params.workspaceId,
        entityType: params.entityType,
        entityId: params.entityId,
        ...ACTIVE_FILTER,
      };
      const totalDocs = await entityAssignmentsRepo.count(filter as any);
      const rows = await entityAssignmentsRepo.listPaginated(filter as any, {
        sort: buildMongoSort(paginationParams, 'createdAt'),
        skip: buildMongoSkip(paginationParams),
        limit: paginationParams.perPage,
      });
      return reply.send({
        data: rows,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/entities/:entityType/:entityId/assignments',
    {
      config: {
        rateLimit: {
          max: 50,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...createdObjectSchema(
          'createWorkspaceEntityAssignment',
          'Workspaces',
          'Assegna utente a entita workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'entityType', 'entityId'],
          properties: {
            workspaceId: { type: 'string' },
            entityType: { type: 'string' },
            entityId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const rawParams = request.params as {
        workspaceId: string;
        entityType: string;
        entityId: string;
      };
      const params = entityAssignmentParamsSchema.parse({
        workspaceId: rawParams.workspaceId,
        entityType: decodePathValue(rawParams.entityType),
        entityId: decodePathValue(rawParams.entityId),
      });
      const payload = entityAssignmentCreateSchema.parse(request.body);
      const now = new Date().toISOString();
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';

      const membership = await membersRepo.findOne({
        workspaceId: params.workspaceId,
        userId: payload.userId,
        ...ACTIVE_FILTER,
      });
      if (membership == null) {
        return reply.status(404).send({
          error: {
            code: 'WorkspaceMemberNotFound',
            message: 'User is not an active member of this workspace',
            status: 404,
          },
        });
      }

      const existing = await entityAssignmentsRepo.findOne({
        workspaceId: params.workspaceId,
        entityType: params.entityType,
        entityId: params.entityId,
        userId: payload.userId,
      });

      if (existing != null && String((existing as { status?: unknown }).status) !== 'deleted') {
        return reply.status(409).send({
          error: {
            code: 'EntityAssignmentExists',
            message: 'Entity assignment already exists',
            status: 409,
          },
        });
      }

      if (existing == null) {
        const doc = {
          _id: crypto.randomUUID(),
          workspaceId: params.workspaceId,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: payload.userId,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };
        await entityAssignmentsRepo.create(doc);
        await app.auditService.authEvent({
          eventType: 'workspaces.entity_assignment.create',
          userId: actorId,
          details: {
            workspaceId: params.workspaceId,
            entityType: params.entityType,
            entityId: params.entityId,
            targetUserId: payload.userId,
          },
        });
        await createEntityTimelineEvent({
          workspaceId: params.workspaceId,
          entityType: params.entityType,
          entityId: params.entityId,
          type: 'assignment',
          title: 'Utente assegnato',
          description: payload.userId,
          actorUserId: actorId,
          createdAt: now,
        });
        return reply.status(201).send({ data: doc });
      }

      await entityAssignmentsRepo.updateOne(
        { _id: (existing as { _id: string })._id },
        {
          $set: {
            status: 'active',
            updatedAt: now,
          },
          $unset: { deletedAt: '', deletedBy: '' },
        },
      );
      const reactivated = await entityAssignmentsRepo.findOne({
        _id: (existing as { _id: string })._id,
      });
      await app.auditService.authEvent({
        eventType: 'workspaces.entity_assignment.reactivate',
        userId: actorId,
        details: {
          workspaceId: params.workspaceId,
          entityType: params.entityType,
          entityId: params.entityId,
          targetUserId: payload.userId,
        },
      });
      await createEntityTimelineEvent({
        workspaceId: params.workspaceId,
        entityType: params.entityType,
        entityId: params.entityId,
        type: 'assignment',
        title: 'Utente assegnato',
        description: payload.userId,
        actorUserId: actorId,
        createdAt: now,
      });
      return reply.status(201).send({ data: reactivated });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/entities/:entityType/:entityId/assignments/:userId',
    {
      config: {
        rateLimit: {
          max: 50,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...okDeletedSchema(
          'deleteWorkspaceEntityAssignment',
          'Workspaces',
          'Rimuovi assegnazione utente da entita workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'entityType', 'entityId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            entityType: { type: 'string' },
            entityId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const rawParams = request.params as {
        workspaceId: string;
        entityType: string;
        entityId: string;
        userId: string;
      };
      const params = entityAssignmentParamsSchema.parse({
        workspaceId: rawParams.workspaceId,
        entityType: decodePathValue(rawParams.entityType),
        entityId: decodePathValue(rawParams.entityId),
      });
      const targetUserId = decodePathValue(rawParams.userId);
      const now = new Date().toISOString();
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const result = await entityAssignmentsRepo.updateOne(
        {
          workspaceId: params.workspaceId,
          entityType: params.entityType,
          entityId: params.entityId,
          userId: targetUserId,
          ...ACTIVE_FILTER,
        },
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            updatedAt: now,
          },
        },
      );
      if (result.matchedCount === 0) {
        return reply.status(404).send({
          error: {
            code: 'EntityAssignmentNotFound',
            message: 'Entity assignment not found',
            status: 404,
          },
        });
      }
      await app.auditService.authEvent({
        eventType: 'workspaces.entity_assignment.delete',
        userId: actorId,
        details: {
          workspaceId: params.workspaceId,
          entityType: params.entityType,
          entityId: params.entityId,
          targetUserId,
        },
      });
      await createEntityTimelineEvent({
        workspaceId: params.workspaceId,
        entityType: params.entityType,
        entityId: params.entityId,
        type: 'assignment',
        title: 'Assegnazione rimossa',
        description: targetUserId,
        actorUserId: actorId,
        createdAt: now,
      });
      return reply.send({ data: { deleted: true } });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/entities/:entityType/:entityId/timeline',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema(
          'listWorkspaceEntityTimeline',
          'Workspaces',
          'Timeline eventi per entita workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'entityType', 'entityId'],
          properties: {
            workspaceId: { type: 'string' },
            entityType: { type: 'string', enum: ['client', 'apartment', 'request'] },
            entityId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: entityTimelineAllowedSortFields },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        },
      },
    },
    async (request, reply) => {
      const rawParams = request.params as {
        workspaceId: string;
        entityType: string;
        entityId: string;
      };
      const params = entityAssignmentParamsSchema.parse({
        workspaceId: rawParams.workspaceId,
        entityType: decodePathValue(rawParams.entityType),
        entityId: decodePathValue(rawParams.entityId),
      });
      const user = request.user as
        | { sub?: string; permissions?: string[]; systemRole?: string; system_role?: string }
        | undefined;
      if (!requesterHasPermission(user, entityPermission(params.entityType, 'read'))) {
        return reply.status(403).send({
          error: { code: 'Forbidden', message: 'Missing required permission', status: 403 },
        });
      }
      if (
        !(await assertEntityInWorkspace(
          app,
          params.workspaceId,
          params.entityType,
          params.entityId,
        ))
      ) {
        return reply.status(404).send({
          error: { code: 'WorkspaceEntityNotFound', message: 'Entity not found', status: 404 },
        });
      }
      const paginationParams = parsePaginationQuery(request.query, entityTimelineAllowedSortFields);
      const filter = {
        workspaceId: params.workspaceId,
        entityType: params.entityType,
        entityId: params.entityId,
        ...ACTIVE_FILTER,
      };
      const [totalDocs, rows] = await Promise.all([
        entityTimelineRepo.count(filter as any),
        entityTimelineRepo.listPaginated(filter as any, {
          sort: buildMongoSort(paginationParams, 'createdAt'),
          skip: buildMongoSkip(paginationParams),
          limit: paginationParams.perPage,
        }),
      ]);
      return reply.send({
        data: rows,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/entities/:entityType/:entityId/timeline',
    {
      config: {
        rateLimit: {
          max: 80,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...createdObjectSchema(
          'createWorkspaceEntityTimelineEvent',
          'Workspaces',
          'Crea evento timeline per entita workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'entityType', 'entityId'],
          properties: {
            workspaceId: { type: 'string' },
            entityType: { type: 'string', enum: ['client', 'apartment', 'request'] },
            entityId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['title'],
          additionalProperties: false,
          properties: {
            projectId: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'note',
                'call',
                'email',
                'meeting',
                'assignment',
                'status_change',
                'document',
                'system',
              ],
            },
            title: { type: 'string', minLength: 1, maxLength: 180 },
            description: { type: 'string', maxLength: 2000 },
          },
        },
      },
    },
    async (request, reply) => {
      const rawParams = request.params as {
        workspaceId: string;
        entityType: string;
        entityId: string;
      };
      const params = entityAssignmentParamsSchema.parse({
        workspaceId: rawParams.workspaceId,
        entityType: decodePathValue(rawParams.entityType),
        entityId: decodePathValue(rawParams.entityId),
      });
      const payload = entityTimelineCreateSchema.parse(request.body);
      const user = request.user as
        | { sub?: string; permissions?: string[]; systemRole?: string; system_role?: string }
        | undefined;
      if (!requesterHasPermission(user, entityPermission(params.entityType, 'write'))) {
        return reply.status(403).send({
          error: { code: 'Forbidden', message: 'Missing required permission', status: 403 },
        });
      }
      if (
        !(await assertEntityInWorkspace(
          app,
          params.workspaceId,
          params.entityType,
          params.entityId,
        ))
      ) {
        return reply.status(404).send({
          error: { code: 'WorkspaceEntityNotFound', message: 'Entity not found', status: 404 },
        });
      }
      if (payload.projectId != null) {
        const projectOk = await assertClientVisibilityProjects(app, params.workspaceId, {
          mode: 'projects',
          projectIds: [payload.projectId],
        });
        if (!projectOk) {
          return reply.status(400).send({
            error: {
              code: 'InvalidTimelineProject',
              message: 'Timeline project must reference an active project in this workspace',
              status: 400,
            },
          });
        }
      }
      const actorId = user?.sub ?? 'system';
      const doc = await createEntityTimelineEvent({
        workspaceId: params.workspaceId,
        projectId: payload.projectId,
        entityType: params.entityType,
        entityId: params.entityId,
        type: payload.type,
        title: payload.title,
        description: payload.description,
        actorUserId: actorId,
      });
      await app.auditService.authEvent({
        eventType: 'workspaces.entity_timeline.create',
        userId: actorId,
        details: {
          workspaceId: params.workspaceId,
          entityType: params.entityType,
          entityId: params.entityId,
          timelineId: doc._id,
          type: doc.type,
        },
      });
      return reply.status(201).send({ data: doc });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/users/:userId/assignments',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema(
          'listWorkspaceUserEntityAssignments',
          'Workspaces',
          'Elenco assegnazioni entita per utente',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: entityAssignmentAllowedSortFields },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; userId: string };
      const paginationParams = parsePaginationQuery(
        request.query,
        entityAssignmentAllowedSortFields,
      );
      const filter = {
        workspaceId: params.workspaceId,
        userId: decodePathValue(params.userId),
        ...ACTIVE_FILTER,
      };
      const totalDocs = await entityAssignmentsRepo.count(filter as any);
      const rows = await entityAssignmentsRepo.listPaginated(filter as any, {
        sort: buildMongoSort(paginationParams, 'createdAt'),
        skip: buildMongoSkip(paginationParams),
        limit: paginationParams.perPage,
      });
      return reply.send({
        data: rows,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/platform-api-keys',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...listSchema(
          'listWorkspacePlatformApiKeys',
          'Workspaces',
          'Elenco API key piattaforma del workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: platformApiKeyAllowedSortFields },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const paginationParams = parsePaginationQuery(request.query, platformApiKeyAllowedSortFields);
      const filter = {
        workspaceId: params.workspaceId,
        ...ACTIVE_FILTER,
      };
      const totalDocs = await platformApiKeysRepo.count(filter);
      const rows = await platformApiKeysRepo.listPaginated(filter, {
        sort: buildMongoSort(paginationParams, 'createdAt'),
        skip: buildMongoSkip(paginationParams),
        limit: paginationParams.perPage,
      });
      const data = rows
        .map((r) => toPublicPlatformApiKey(r as Record<string, unknown>))
        .filter(Boolean);
      return reply.send({ data, paginationInfo: buildPaginationInfo(totalDocs, paginationParams) });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/platform-api-keys',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...createdObjectSchema(
          'createWorkspacePlatformApiKey',
          'Workspaces',
          'Crea API key piattaforma per workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['label'],
          properties: {
            label: { type: 'string', minLength: 2, maxLength: 120 },
            projectIds: { type: 'array', items: { type: 'string' } },
            scopes: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = platformApiKeyCreateSchema.parse(request.body);
      const now = new Date().toISOString();
      const token = randomWorkspaceApiKey();
      const tokenHash = hashOpaqueToken(token);
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const doc = {
        _id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        label: payload.label,
        projectIds: payload.projectIds ?? [],
        scopes: payload.scopes ?? [],
        tokenHash,
        tokenPreview: maskedSecret(token),
        status: 'active',
        createdAt: now,
        updatedAt: now,
        createdBy: actorId,
      };
      await platformApiKeysRepo.create(doc);
      await app.auditService.authEvent({
        eventType: 'workspaces.platform_api_key.create',
        userId: actorId,
        details: { workspaceId: params.workspaceId, keyId: doc._id, label: doc.label },
      });
      const keyPublic = toPublicPlatformApiKey(doc as Record<string, unknown>);
      return reply.status(201).send({
        data: {
          key: keyPublic,
          apiKeyMasked: doc.tokenPreview,
        },
      });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/platform-api-keys/:keyId/rotate',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'rotateWorkspacePlatformApiKey',
          'Workspaces',
          'Ruota una API key piattaforma workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'keyId'],
          properties: {
            workspaceId: { type: 'string' },
            keyId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; keyId: string };
      const now = new Date().toISOString();
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const existing = await platformApiKeysRepo.findOne({
        _id: params.keyId,
        workspaceId: params.workspaceId,
        ...ACTIVE_FILTER,
      });
      if (existing == null) {
        return reply.status(404).send({
          error: {
            code: 'PlatformApiKeyNotFound',
            message: 'Platform API key not found',
            status: 404,
          },
        });
      }
      const token = randomWorkspaceApiKey();
      await platformApiKeysRepo.updateOne(
        { _id: params.keyId, workspaceId: params.workspaceId },
        {
          $set: {
            tokenHash: hashOpaqueToken(token),
            tokenPreview: maskedSecret(token),
            updatedAt: now,
            rotatedAt: now,
            rotatedBy: actorId,
          },
        },
      );
      const updated = await platformApiKeysRepo.findOne({
        _id: params.keyId,
        workspaceId: params.workspaceId,
      });
      await app.auditService.authEvent({
        eventType: 'workspaces.platform_api_key.rotate',
        userId: actorId,
        details: { workspaceId: params.workspaceId, keyId: params.keyId },
      });
      const keyPublic = toPublicPlatformApiKey(updated as Record<string, unknown>);
      return reply.send({
        data: {
          key: keyPublic,
          apiKeyMasked: (updated as { tokenPreview?: string }).tokenPreview ?? maskedSecret(token),
        },
      });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/platform-api-keys/:keyId',
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 minute',
        },
      },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...okDeletedSchema(
          'revokeWorkspacePlatformApiKey',
          'Workspaces',
          'Revoca una API key piattaforma workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'keyId'],
          properties: {
            workspaceId: { type: 'string' },
            keyId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; keyId: string };
      const now = new Date().toISOString();
      const actorId = (request.user as { sub?: string } | undefined)?.sub ?? 'system';
      const result = await platformApiKeysRepo.updateOne(
        {
          _id: params.keyId,
          workspaceId: params.workspaceId,
          ...ACTIVE_FILTER,
        },
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            updatedAt: now,
          },
        },
      );
      if (result.matchedCount === 0) {
        return reply.status(404).send({
          error: {
            code: 'PlatformApiKeyNotFound',
            message: 'Platform API key not found',
            status: 404,
          },
        });
      }
      await app.auditService.authEvent({
        eventType: 'workspaces.platform_api_key.revoke',
        userId: actorId,
        details: { workspaceId: params.workspaceId, keyId: params.keyId },
      });
      return reply.send({ data: { deleted: true } });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/platform-api-keys/usage',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'getWorkspacePlatformApiKeysUsage',
          'Workspaces',
          'Statistiche di utilizzo API key piattaforma workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const dateFrom =
        typeof (request.query as { dateFrom?: unknown }).dateFrom === 'string'
          ? ((request.query as { dateFrom?: string }).dateFrom ?? null)
          : null;
      const dateTo =
        typeof (request.query as { dateTo?: unknown }).dateTo === 'string'
          ? ((request.query as { dateTo?: string }).dateTo ?? null)
          : null;
      const usageRows = await platformApiKeyUsageRepo.findMany({
        workspaceId: params.workspaceId,
        ...(dateFrom != null || dateTo != null
          ? {
              day: {
                ...(dateFrom != null ? { $gte: dateFrom } : {}),
                ...(dateTo != null ? { $lte: dateTo } : {}),
              },
            }
          : {}),
      } as any);
      const summary = {
        workspaceId: params.workspaceId,
        totalRequests: usageRows.reduce((acc, row) => acc + Number((row as any).requests ?? 0), 0),
        totalErrors: usageRows.reduce((acc, row) => acc + Number((row as any).errors ?? 0), 0),
        items: usageRows,
      };
      return reply.send({ data: summary });
    },
  );

  /**
   * Verifica una workspace platform key (header `x-workspace-platform-key`) senza JWT.
   * Incrementa il contatore usage per workspace/giorno/chiave.
   */
  app.get(
    '/v1/workspaces/:workspaceId/platform-api-keys/verify',
    {
      config: {
        rateLimit: {
          max: 120,
          timeWindow: '1 minute',
        },
      },
      schema: {
        tags: ['Workspaces'],
        operationId: 'verifyWorkspacePlatformApiKey',
        description:
          'Verifica credenziali server-to-server con workspace platform key (`wk_…`). Richiede `x-api-key` interno e header `x-workspace-platform-key`. Nessun Bearer JWT.',
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        headers: {
          type: 'object',
          required: ['x-workspace-platform-key'],
          properties: {
            'x-workspace-platform-key': {
              type: 'string',
              minLength: 8,
              description: 'Workspace platform key da verificare (prefisso wk_)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['data'],
            properties: {
              data: {
                type: 'object',
                required: ['workspaceId', 'keyId', 'scopes', 'projectIds'],
                properties: {
                  workspaceId: { type: 'string' },
                  keyId: { type: 'string' },
                  scopes: { type: 'array', items: { type: 'string' } },
                  projectIds: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
          401: { $ref: 'ErrorResponse#' },
          500: { $ref: 'ErrorResponse#' },
        },
      },
      preHandler: [
        async (request, reply) => {
          const params = request.params as { workspaceId: string };
          const rawHeader =
            request.headers[WORKSPACE_PLATFORM_API_KEY_HEADER] ??
            request.headers['x-workspace-platform-key'];
          const rawKey = typeof rawHeader === 'string' ? rawHeader : undefined;
          const resolved = await resolveWorkspacePlatformKey({
            db: app.mongoDb,
            workspaceId: params.workspaceId,
            rawKey,
          });
          if (resolved == null) {
            return reply.status(401).send({
              error: {
                code: 'WorkspacePlatformApiKeyInvalid',
                message: 'Missing or invalid workspace platform API key',
                status: 401,
              },
            });
          }
          (
            request as FastifyRequest & { workspacePlatformKey?: ResolvedWorkspacePlatformKey }
          ).workspacePlatformKey = resolved;
          await incrementWorkspacePlatformApiKeyUsage({
            db: app.mongoDb,
            workspaceId: resolved.workspaceId,
            platformApiKeyId: resolved.keyId,
          });
        },
      ],
    },
    async (request, reply) => {
      const ctx = (
        request as FastifyRequest & { workspacePlatformKey?: ResolvedWorkspacePlatformKey }
      ).workspacePlatformKey;
      if (ctx == null) {
        return reply.status(500).send({
          error: {
            code: 'InternalError',
            message: 'Platform key context missing',
            status: 500,
          },
        });
      }
      return reply.send({
        data: {
          workspaceId: ctx.workspaceId,
          keyId: ctx.keyId,
          scopes: ctx.scopes,
          projectIds: ctx.projectIds,
        },
      });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/invitations',
    {
      config: { rateLimit: workspaceInvitationCreateRateLimit(app.config) },
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...createdObjectSchema(
          'createWorkspaceInvitation',
          'Workspaces',
          'Invito utente nel workspace (opz. progetti) + notifica mail',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['email', 'fullName'],
          properties: {
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string', minLength: 2 },
            role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
            projectIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = workspaceInviteSchema.parse(request.body);
      const actor = request.user as { sub?: string };
      const wsId = params.workspaceId;
      const emailLower = normalizeUserEmail(payload.email);
      const now = new Date().toISOString();
      const requestedProjectIds = [...new Set(payload.projectIds ?? [])];
      for (const projectId of requestedProjectIds) {
        const link = await workspaceProjectsRepo.findOne({
          workspaceId: wsId,
          projectId,
          ...ACTIVE_FILTER,
        });
        if (link == null) {
          return reply.status(400).send({
            error: {
              code: 'ProjectNotInWorkspace',
              message: `Project ${projectId} is not associated with this workspace`,
              status: 400,
            },
          });
        }
      }

      let targetUserId: string;
      let createdUserId: string | null = null;
      const createdAssignments: string[] = [];
      const reactivatedAssignmentIds: string[] = [];
      let createdMembership = false;
      let reactivatedMembershipId: string | null = null;

      const identityLookup = await resolveWorkspaceScopedIdentityByEmail(app, emailLower);
      if (identityLookup.kind === 'ambiguous') {
        await app.auditService.authEvent({
          eventType: 'user.identity.ambiguous_invite_blocked',
          userId: actor.sub ?? 'system',
          details: { workspaceId: wsId, invitedEmail: emailLower, count: identityLookup.count },
        });
        return reply.status(409).send({
          error: {
            code: 'AmbiguousUserIdentity',
            message:
              'Questa email esiste in più workspace. Contatta Tecma per scegliere l’identità corretta.',
            status: 409,
          },
        });
      }
      if (identityLookup.kind === 'tecma') {
        return reply.status(409).send({
          error: {
            code: 'TecmaIdentityCannotBeInvited',
            message: 'Gli utenti Tecma sono identità globali e non vanno invitati nei workspace.',
            status: 409,
          },
        });
      }
      if (identityLookup.kind === 'single') {
        targetUserId = userIdFromRecord(identityLookup.user);
        const existingHomeWorkspaceId = String(identityLookup.user.homeWorkspaceId ?? '').trim();
        if (existingHomeWorkspaceId === wsId) {
          return reply.status(409).send({
            error: {
              code: 'DuplicateWorkspaceEmail',
              message: 'Esiste già un utente con questa email in questo workspace',
              status: 409,
            },
          });
        }
        if (existingHomeWorkspaceId === '') {
          await usersRepo.updateOne(
            { _id: identityLookup.user._id } as any,
            { $set: { homeWorkspaceId: wsId, updatedAt: now } } as any,
          );
        }
      } else {
        const randomSecret = crypto.randomBytes(32).toString('base64url');
        const passwordHash = await bcrypt.hash(randomSecret, 12);
        const doc = {
          _id: new ObjectId(),
          email: emailLower,
          fullName: payload.fullName,
          passwordHash,
          systemRole: 'user',
          role: payload.role,
          homeWorkspaceId: wsId,
          status: 'invited' as const,
          createdAt: now,
          updatedAt: now,
        };
        await usersRepo.create(doc);
        targetUserId = doc._id.toString();
        createdUserId = targetUserId;
      }

      const existingMembership = await membersRepo.findOne({
        workspaceId: wsId,
        userId: targetUserId,
      } as any);
      let createdMembershipId: string | null = null;
      if (existingMembership == null) {
        createdMembershipId = crypto.randomUUID();
        await membersRepo.create({
          _id: createdMembershipId,
          workspaceId: wsId,
          userId: targetUserId,
          role: payload.role,
          access_scope: 'workspace',
          createdAt: now,
          updatedAt: now,
          status: 'active',
        });
        createdMembership = true;
      } else if ((existingMembership as { status?: string }).status === 'deleted') {
        reactivatedMembershipId = (existingMembership as { _id: string })._id;
        await membersRepo.updateOne({ _id: reactivatedMembershipId } as any, {
          $set: {
            status: 'active',
            role: payload.role,
            updatedAt: now,
          },
          $unset: { deletedAt: '', deletedBy: '' },
        });
      }

      try {
        for (const projectId of requestedProjectIds) {
          const row = await workspaceUserProjectsRepo.findOne({
            workspaceId: wsId,
            userId: targetUserId,
            projectId,
          } as any);
          if (row == null) {
            const assignId = crypto.randomUUID();
            await workspaceUserProjectsRepo.create({
              _id: assignId,
              workspaceId: wsId,
              userId: targetUserId,
              projectId,
              createdAt: now,
              updatedAt: now,
              status: 'active',
            });
            createdAssignments.push(assignId);
          } else if ((row as { status?: string }).status === 'deleted') {
            reactivatedAssignmentIds.push((row as { _id: string })._id);
            await workspaceUserProjectsRepo.updateOne(
              { _id: (row as { _id: string })._id } as any,
              {
                $set: {
                  status: 'active',
                  updatedAt: now,
                  deletedAt: null,
                  deletedBy: null,
                },
              },
            );
          }
        }

        const inviteToken = crypto.randomBytes(48).toString('base64url');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        await inviteTokensRepo.updateMany(
          {
            userId: targetUserId,
            workspaceId: wsId,
            status: 'active',
          } as any,
          { $set: { status: 'revoked', revokedAt: now, updatedAt: now } } as any,
        );
        await inviteTokensRepo.create({
          _id: crypto.randomUUID(),
          tokenHash: hashOpaqueToken(inviteToken),
          userId: targetUserId,
          workspaceId: wsId,
          role: payload.role,
          projectIds: requestedProjectIds,
          status: 'active',
          expiresAt,
          createdAt: now,
          createdBy: actor.sub ?? 'system',
        });

        await app.mail.sendTemplate({
          to: emailLower,
          flowKey: 'workspace_invite',
          vars: { workspaceId: wsId, inviteUrl: buildInviteAcceptUrl(inviteToken) },
        });
      } catch (error) {
        for (const assignmentId of createdAssignments) {
          await workspaceUserProjectsRepo.updateOne({ _id: assignmentId } as any, {
            $set: {
              status: 'deleted',
              deletedAt: now,
              deletedBy: actor.sub ?? 'system',
              updatedAt: now,
            },
          });
        }
        for (const assignmentId of reactivatedAssignmentIds) {
          await workspaceUserProjectsRepo.updateOne({ _id: assignmentId } as any, {
            $set: {
              status: 'deleted',
              deletedAt: now,
              deletedBy: actor.sub ?? 'system',
              updatedAt: now,
            },
          });
        }
        if (createdMembership) {
          await membersRepo.updateOne({ _id: createdMembershipId } as any, {
            $set: {
              status: 'deleted',
              deletedAt: now,
              deletedBy: actor.sub ?? 'system',
              updatedAt: now,
            },
          });
        } else if (reactivatedMembershipId != null) {
          await membersRepo.updateOne({ _id: reactivatedMembershipId } as any, {
            $set: {
              status: 'deleted',
              deletedAt: now,
              deletedBy: actor.sub ?? 'system',
              updatedAt: now,
            },
          });
        }
        if (createdUserId != null) {
          await usersRepo.updateOne({ _id: new ObjectId(createdUserId) } as any, {
            $set: {
              status: 'deleted',
              deletedAt: now,
              deletedBy: actor.sub ?? 'system',
              updatedAt: now,
            },
          });
        }
        throw error;
      }

      await app.auditService.authEvent({
        eventType: 'workspaces.invitation.created',
        userId: actor.sub ?? 'system',
        details: { workspaceId: wsId, invitedEmail: emailLower, projectIds: requestedProjectIds },
      });

      return reply.status(201).send({
        data: {
          accepted: true,
          userId: targetUserId,
          workspaceId: wsId,
          email: emailLower,
        },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // M2: Workspace advanced sections (entitlements, ai-config, additional-infos,
  //     branding). Tutte usano collection dedicate `tz_workspace_*`.
  // ---------------------------------------------------------------------------

  const entitlementsRepo = new MongoRepository<WorkspaceEntitlementDocument>(
    app.mongoDb.collection<WorkspaceEntitlementDocument>('tz_workspace_entitlements'),
  );
  const aiConfigRepo = new MongoRepository<WorkspaceAiConfigDocument>(
    app.mongoDb.collection<WorkspaceAiConfigDocument>('tz_workspace_ai_config'),
  );
  const additionalInfosRepo = new MongoRepository<WorkspaceAdditionalInfoDocument>(
    app.mongoDb.collection<WorkspaceAdditionalInfoDocument>('tz_additional_infos'),
  );
  const clientsRepo = new MongoRepository<WorkspaceClientDocument>(
    app.mongoDb.collection<WorkspaceClientDocument>('tz_clients'),
  );
  const brandingRepo = new MongoRepository<WorkspaceBrandingDocument>(
    app.mongoDb.collection<WorkspaceBrandingDocument>('tz_workspace_branding'),
  );

  app.get(
    '/v1/workspaces/:workspaceId/entitlements',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema('listWorkspaceEntitlements', 'Workspaces', 'Entitlements workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: {
              type: 'string',
              enum: workspaceEntitlementListAllowedSortFields as unknown as string[],
            },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
            searchText: { type: 'string', minLength: 1, maxLength: 120 },
            status: { type: 'string', minLength: 1, maxLength: 60 },
            city: { type: 'string', minLength: 1, maxLength: 120 },
            consentSource: {
              type: 'string',
              enum: ['corporate_site', 'project_site', 'manual', 'import', 'all'],
            },
            visibilityMode: { type: 'string', enum: ['workspace', 'projects', 'all'] },
            gdpr: { type: 'string', enum: ['all', 'complete', 'missing'] },
            missingData: { type: 'string', enum: ['all', 'yes'] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const paginationParams = parsePaginationQuery(
        request.query,
        workspaceEntitlementListAllowedSortFields,
      );
      const stored = await entitlementsRepo.findMany({ workspaceId: params.workspaceId } as any);
      const map = new Map<string, any>();
      for (const row of stored) map.set(String((row as { feature?: string }).feature ?? ''), row);
      const data = KNOWN_FEATURES.map((feature) => {
        const row = map.get(feature);
        return {
          workspaceId: params.workspaceId,
          feature,
          status: row?.status ?? 'disabled',
          metadata: row?.metadata ?? null,
          updatedAt: row?.updatedAt ?? null,
        };
      });
      const sortField = paginationParams.sortField ?? 'feature';
      const sortOrder = paginationParams.sortOrder === 'asc' ? 1 : -1;
      const sortedData = [...data].sort((left, right) => {
        const leftValue = String(left[sortField as keyof typeof left] ?? '');
        const rightValue = String(right[sortField as keyof typeof right] ?? '');
        return leftValue.localeCompare(rightValue) * sortOrder;
      });
      return reply.send({
        data: sliceForPagination(sortedData, paginationParams.page, paginationParams.perPage),
        paginationInfo: buildPaginationInfo(data.length, paginationParams),
      });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId/entitlements/:feature',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'patchWorkspaceEntitlement',
          'Workspaces',
          'Aggiorna entitlement workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'feature'],
          properties: {
            workspaceId: { type: 'string' },
            feature: {
              type: 'string',
              enum: KNOWN_FEATURES as unknown as string[],
            },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['enabled', 'disabled'] },
            metadata: {
              type: 'object',
              additionalProperties: {
                oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; feature: string };
      if (!KNOWN_FEATURES.includes(params.feature as (typeof KNOWN_FEATURES)[number])) {
        return reply.status(400).send({
          error: {
            code: 'UnknownFeature',
            message: `Unknown feature "${params.feature}"`,
            status: 400,
          },
        });
      }
      const payload = entitlementUpdateSchema.parse(request.body);
      const now = new Date().toISOString();
      const filter = { workspaceId: params.workspaceId, feature: params.feature } as any;
      const existing = await entitlementsRepo.findOne(filter);
      if (existing == null) {
        await entitlementsRepo.create({
          _id: crypto.randomUUID(),
          workspaceId: params.workspaceId,
          feature: params.feature,
          status: payload.status,
          metadata: payload.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        } as any);
      } else {
        await entitlementsRepo.updateOne(filter, {
          $set: {
            status: payload.status,
            metadata:
              payload.metadata ??
              ((existing as { metadata?: Record<string, unknown> | null }).metadata || null),
            updatedAt: now,
          },
        });
      }
      const row = await entitlementsRepo.findOne(filter);
      const actor = request.user as { sub?: string };
      await app.auditService.authEvent({
        eventType: 'workspaces.entitlement.update',
        userId: actor.sub ?? 'system',
        details: {
          workspaceId: params.workspaceId,
          feature: params.feature,
          status: payload.status,
        },
      });
      return reply.send({ data: row });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/ai-config',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...singleObjectSchema('getWorkspaceAiConfig', 'Workspaces', 'Configurazione AI workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const doc = await aiConfigRepo.findOne({
        workspaceId: params.workspaceId,
        ...ACTIVE_FILTER,
      } as any);
      return reply.send({ data: sanitizeAiConfigForResponse(doc) });
    },
  );

  app.put(
    '/v1/workspaces/:workspaceId/ai-config',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'putWorkspaceAiConfig',
          'Workspaces',
          'Salva configurazione AI workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['provider'],
          properties: {
            provider: { type: 'string', enum: ['claude', 'openai', 'gemini'] },
            apiKey: { type: 'string', minLength: 8, maxLength: 512 },
            model: { type: 'string', minLength: 1, maxLength: 120 },
            temperature: { type: 'number', minimum: 0, maximum: 2 },
            enabled: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = aiConfigSchema.parse(request.body);
      const now = new Date().toISOString();
      const filter = { workspaceId: params.workspaceId } as any;
      const existing = await aiConfigRepo.findOne({ ...filter, ...ACTIVE_FILTER });
      const encryptedApiKey = ensureEncryptedSecret(payload.apiKey);
      const doc = {
        provider: payload.provider,
        ...(encryptedApiKey != null ? { apiKey: encryptedApiKey } : {}),
        ...(payload.model != null ? { model: payload.model } : {}),
        ...(payload.temperature != null ? { temperature: payload.temperature } : {}),
        ...(payload.enabled != null ? { enabled: payload.enabled } : {}),
        updatedAt: now,
        status: 'active',
      };
      if (existing == null) {
        await aiConfigRepo.create({
          _id: crypto.randomUUID(),
          workspaceId: params.workspaceId,
          ...doc,
          createdAt: now,
        } as any);
      } else {
        await aiConfigRepo.updateOne({ _id: (existing as { _id: string })._id } as any, {
          $set: doc,
        });
      }
      const row = await aiConfigRepo.findOne({ ...filter, ...ACTIVE_FILTER });
      const actor = request.user as { sub?: string };
      await app.auditService.authEvent({
        eventType: 'workspaces.aiConfig.update',
        userId: actor.sub ?? 'system',
        details: { workspaceId: params.workspaceId, provider: payload.provider },
      });
      return reply.send({ data: sanitizeAiConfigForResponse(row) });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/additional-infos',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema('listWorkspaceAdditionalInfos', 'Workspaces', 'Additional infos workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: {
              type: 'string',
              enum: workspaceAdditionalInfoListAllowedSortFields as unknown as string[],
            },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const paginationParams = parsePaginationQuery(
        request.query,
        workspaceAdditionalInfoListAllowedSortFields,
      );
      const filter = { workspaceId: params.workspaceId, ...ACTIVE_FILTER };
      const [totalDocs, rows] = await Promise.all([
        additionalInfosRepo.count(filter),
        additionalInfosRepo.listPaginated(filter, {
          sort: buildMongoSort(paginationParams, 'sortOrder'),
          skip: buildMongoSkip(paginationParams),
          limit: paginationParams.perPage,
        }),
      ]);
      return reply.send({
        data: rows,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/additional-infos',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...createdObjectSchema(
          'createWorkspaceAdditionalInfo',
          'Workspaces',
          'Crea additional info workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['label'],
          properties: {
            label: { type: 'string', minLength: 1, maxLength: 120 },
            value: { type: 'string', maxLength: 10000 },
            sortOrder: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = additionalInfoCreateSchema.parse(request.body);
      const now = new Date().toISOString();
      const doc = {
        _id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        label: payload.label,
        value: payload.value,
        sortOrder: payload.sortOrder ?? 0,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };
      await additionalInfosRepo.create(doc as any);
      return reply.status(201).send({ data: doc });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId/additional-infos/:infoId',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'patchWorkspaceAdditionalInfo',
          'Workspaces',
          'Aggiorna additional info workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'infoId'],
          properties: {
            workspaceId: { type: 'string' },
            infoId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            label: { type: 'string', minLength: 1, maxLength: 120 },
            value: { type: 'string', maxLength: 10000 },
            sortOrder: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; infoId: string };
      const payload = additionalInfoUpdateSchema.parse(request.body);
      const filter = {
        _id: params.infoId,
        workspaceId: params.workspaceId,
        ...ACTIVE_FILTER,
      } as any;
      const existing = await additionalInfosRepo.findOne(filter);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'AdditionalInfoNotFound', message: 'Not found', status: 404 },
        });
      }
      await additionalInfosRepo.updateOne(filter, {
        $set: {
          ...payload,
          updatedAt: new Date().toISOString(),
        },
      });
      const updated = await additionalInfosRepo.findOne(filter);
      return reply.send({ data: updated });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/additional-infos/:infoId',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...okDeletedSchema(
          'deleteWorkspaceAdditionalInfo',
          'Workspaces',
          'Elimina additional info workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'infoId'],
          properties: {
            workspaceId: { type: 'string' },
            infoId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; infoId: string };
      const now = new Date().toISOString();
      const result = await additionalInfosRepo.updateOne(
        {
          _id: params.infoId,
          workspaceId: params.workspaceId,
          ...ACTIVE_FILTER,
        } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: (request.user as { sub?: string })?.sub ?? 'system',
            updatedAt: now,
          },
        } as any,
      );
      if (result.matchedCount === 0) {
        return reply.status(404).send({
          error: { code: 'AdditionalInfoNotFound', message: 'Not found', status: 404 },
        });
      }
      return reply.send({ data: { deleted: true } });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/branding',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...singleObjectSchema('getWorkspaceBranding', 'Workspaces', 'Branding workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const doc = await brandingRepo.findOne({ workspaceId: params.workspaceId } as any);
      return reply.send({ data: doc });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId/branding',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'patchWorkspaceBranding',
          'Workspaces',
          'Aggiorna branding workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            logoUrl: { type: 'string', format: 'uri' },
            emailHeaderUrl: { type: 'string', format: 'uri' },
            primaryColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            footerText: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = brandingSchema.parse(request.body);
      const filter = { workspaceId: params.workspaceId } as any;
      const now = new Date().toISOString();
      const existing = await brandingRepo.findOne(filter);
      if (existing == null) {
        await brandingRepo.create({
          _id: crypto.randomUUID(),
          workspaceId: params.workspaceId,
          ...payload,
          createdAt: now,
          updatedAt: now,
        } as any);
      } else {
        await brandingRepo.updateOne(filter, {
          $set: { ...payload, updatedAt: now },
        });
      }
      const row = await brandingRepo.findOne(filter);
      const actor = request.user as { sub?: string };
      await app.auditService.authEvent({
        eventType: 'workspaces.branding.update',
        userId: actor.sub ?? 'system',
        details: { workspaceId: params.workspaceId, fields: Object.keys(payload) },
      });
      return reply.send({ data: row });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/clients',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema(
          'listWorkspaceClients',
          'Workspaces',
          'Clienti collegati al workspace (scaffolding)',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: {
              type: 'string',
              enum: workspaceClientListAllowedSortFields as unknown as string[],
            },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
            searchText: { type: 'string', minLength: 1, maxLength: 120 },
            status: { type: 'string', minLength: 1, maxLength: 60 },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const query = request.query as {
        page?: string | number;
        perPage?: string | number;
        sortField?: string;
        sortOrder?: string;
        searchText?: string;
        status?: string;
        city?: string;
        consentSource?: string;
        visibilityMode?: string;
        gdpr?: string;
        missingData?: string;
      };
      const paginationParams = parsePaginationQuery(
        {
          page: query.page,
          perPage: query.perPage,
          sortField: query.sortField,
          sortOrder: query.sortOrder,
        },
        workspaceClientListAllowedSortFields,
      );
      const wf = { workspaceId: params.workspaceId };
      const andFilters: Record<string, unknown>[] = [
        { $or: [{ workspaceId: wf.workspaceId }, { workspace_id: wf.workspaceId }] },
      ];
      const status = query.status?.trim();
      if (status != null && status !== '' && status !== 'all') {
        andFilters.push({ status });
      }
      const city = query.city?.trim();
      if (city != null && city !== '') {
        andFilters.push({ city: { $regex: escapeRegexLiteral(city), $options: 'i' } });
      }
      const consentSource = query.consentSource?.trim();
      if (consentSource != null && consentSource !== '' && consentSource !== 'all') {
        andFilters.push({ 'gdpr.consentSource': consentSource });
      }
      const visibilityMode = query.visibilityMode?.trim();
      if (visibilityMode != null && visibilityMode !== '' && visibilityMode !== 'all') {
        andFilters.push({ 'projectVisibility.mode': visibilityMode });
      }
      if (query.gdpr === 'complete') {
        andFilters.push({ 'gdpr.privacyAccepted': true });
      }
      if (query.gdpr === 'missing') {
        andFilters.push({
          $or: [
            { gdpr: { $exists: false } },
            { 'gdpr.privacyAccepted': { $ne: true } },
            { 'gdpr.consentSource': { $exists: false } },
          ],
        });
      }
      if (query.missingData === 'yes') {
        andFilters.push({
          $or: [
            { firstName: { $in: [null, ''] } },
            { lastName: { $in: [null, ''] } },
            { email: { $in: [null, ''] } },
            { phone: { $in: [null, ''] } },
            { city: { $in: [null, ''] } },
            { status: { $in: [null, ''] } },
          ],
        });
      }
      const searchText = query.searchText?.trim();
      if (searchText != null && searchText !== '') {
        const regex = { $regex: escapeRegexLiteral(searchText), $options: 'i' };
        andFilters.push({
          $or: [
            { firstName: regex },
            { lastName: regex },
            { fullName: regex },
            { email: regex },
            { phone: regex },
            { city: regex },
          ],
        });
      }
      const visibilityFilter = await buildClientVisibilityFilterForRequester(
        app,
        params.workspaceId,
        request.user as
          | { sub?: string; email?: string; systemRole?: string; system_role?: string }
          | undefined,
      );
      if (visibilityFilter != null) andFilters.push(visibilityFilter);
      const filter: Record<string, unknown> =
        andFilters.length === 1 ? (andFilters[0] as Record<string, unknown>) : { $and: andFilters };
      const [totalDocs, rows] = await Promise.all([
        clientsRepo.count(filter as any),
        clientsRepo.listPaginated(filter as any, {
          sort: buildMongoSort(paginationParams, 'createdAt'),
          skip: buildMongoSkip(paginationParams),
          limit: paginationParams.perPage,
        }),
      ]);
      return reply.send({
        data: rows,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/clients/:clientId',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...singleObjectSchema('getWorkspaceClient', 'Workspaces', 'Dettaglio cliente workspace'),
        params: {
          type: 'object',
          required: ['workspaceId', 'clientId'],
          properties: { workspaceId: { type: 'string' }, clientId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; clientId: string };
      const andFilters: Record<string, unknown>[] = [
        mongoPrimaryKeyFilter(params.clientId),
        { $or: [{ workspaceId: params.workspaceId }, { workspace_id: params.workspaceId }] },
        ACTIVE_FILTER,
      ];
      const visibilityFilter = await buildClientVisibilityFilterForRequester(
        app,
        params.workspaceId,
        request.user as
          | { sub?: string; email?: string; systemRole?: string; system_role?: string }
          | undefined,
      );
      if (visibilityFilter != null) andFilters.push(visibilityFilter);
      const client = await clientsRepo.findOne({ $and: andFilters } as any);
      if (client == null) {
        return reply.status(404).send({
          error: { code: 'WorkspaceClientNotFound', message: 'Client not found', status: 404 },
        });
      }
      return reply.send({ data: client });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/clients',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...createdObjectSchema('createWorkspaceClient', 'Workspaces', 'Crea cliente workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['email', 'firstName', 'lastName', 'phone', 'city', 'status'],
          properties: {
            email: { type: 'string', format: 'email' },
            firstName: { type: 'string', minLength: 1, maxLength: 120 },
            lastName: { type: 'string', minLength: 1, maxLength: 120 },
            fullName: { type: 'string', maxLength: 240 },
            phone: { type: 'string', minLength: 1, maxLength: 80 },
            city: { type: 'string', minLength: 1, maxLength: 120 },
            status: {
              type: 'string',
              enum: ['lead', 'prospect', 'client', 'contacted', 'negotiation', 'won', 'lost'],
            },
            source: { type: 'string', maxLength: 120 },
            budget: { type: 'number', minimum: 0 },
            motivation: { type: 'string', maxLength: 500 },
            notes: { type: 'string', maxLength: 5000 },
            family: {
              type: 'object',
              additionalProperties: false,
              properties: {
                householdSize: { type: 'integer', minimum: 0, maximum: 30 },
                spouseName: { type: 'string', maxLength: 160 },
                children: { type: 'integer', minimum: 0, maximum: 20 },
                notes: { type: 'string', maxLength: 2000 },
              },
            },
            profiling: {
              type: 'object',
              additionalProperties: false,
              properties: {
                budget: { type: 'number', minimum: 0 },
                motivation: { type: 'string', maxLength: 500 },
                preferredTypology: { type: 'string', maxLength: 120 },
                preferredRooms: { type: 'integer', minimum: 0, maximum: 30 },
                preferredSurfaceMin: { type: 'number', minimum: 0 },
                preferredSurfaceMax: { type: 'number', minimum: 0 },
                preferredPriceMin: { type: 'number', minimum: 0 },
                preferredPriceMax: { type: 'number', minimum: 0 },
                notes: { type: 'string', maxLength: 2000 },
                tags: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 80 } },
              },
            },
            marketing: {
              type: 'object',
              additionalProperties: false,
              properties: {
                source: { type: 'string', maxLength: 120 },
                campaign: { type: 'string', maxLength: 160 },
                medium: { type: 'string', maxLength: 120 },
                content: { type: 'string', maxLength: 240 },
              },
            },
            additionalInfo: { type: 'object', additionalProperties: true },
            projectProfiles: {
              type: 'array',
              maxItems: 100,
              items: {
                type: 'object',
                required: ['projectId'],
                additionalProperties: false,
                properties: {
                  projectId: { type: 'string', minLength: 1, maxLength: 120 },
                  budget: { type: 'number', minimum: 0 },
                  interestLevel: { type: 'string', enum: ['low', 'medium', 'high', 'hot'] },
                  preferredTypology: { type: 'string', maxLength: 120 },
                  preferredRooms: { type: 'integer', minimum: 0, maximum: 30 },
                  preferredSurfaceMin: { type: 'number', minimum: 0 },
                  preferredSurfaceMax: { type: 'number', minimum: 0 },
                  preferredPriceMin: { type: 'number', minimum: 0 },
                  preferredPriceMax: { type: 'number', minimum: 0 },
                  notes: { type: 'string', maxLength: 2000 },
                  tags: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 80 } },
                },
              },
            },
            projectVisibility: {
              type: 'object',
              additionalProperties: false,
              properties: {
                mode: { type: 'string', enum: ['workspace', 'projects'] },
                projectIds: { type: 'array', maxItems: 100, items: { type: 'string' } },
              },
            },
            gdpr: {
              type: 'object',
              additionalProperties: false,
              properties: {
                consentSource: {
                  type: 'string',
                  enum: ['corporate_site', 'project_site', 'manual', 'import'],
                },
                privacyAccepted: { type: 'boolean' },
                marketingConsent: { type: 'boolean' },
                profilingConsent: { type: 'boolean' },
                consentText: { type: 'string', maxLength: 2000 },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = clientCreateSchema.parse(request.body);
      const emailLower = normalizeEmailLower(payload.email);
      const projectVisibility = normalizeClientVisibility(payload.projectVisibility);
      if (!(await assertClientVisibilityProjects(app, params.workspaceId, projectVisibility))) {
        return reply.status(400).send({
          error: {
            code: 'InvalidClientProjectVisibility',
            message: 'Project visibility must reference active projects in this workspace',
            status: 400,
          },
        });
      }
      if (
        !(await assertClientProjectProfilesProjects(
          app,
          params.workspaceId,
          payload.projectProfiles,
        ))
      ) {
        return reply.status(400).send({
          error: {
            code: 'InvalidClientProjectProfiles',
            message: 'Project profiles must reference active projects in this workspace',
            status: 400,
          },
        });
      }
      const duplicate = await clientsRepo.findOne({
        $and: [
          { $or: [{ workspaceId: params.workspaceId }, { workspace_id: params.workspaceId }] },
          { $or: [{ emailLower }, { email: emailLower }] },
          ACTIVE_FILTER,
        ],
      } as any);
      if (duplicate != null) {
        return reply.status(409).send({
          error: {
            code: 'WorkspaceClientEmailAlreadyExists',
            message: 'A client with this email already exists in this workspace',
            status: 409,
          },
        });
      }
      const now = new Date().toISOString();
      const doc: WorkspaceClientDocument = {
        _id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        firstName: payload.firstName,
        lastName: payload.lastName,
        fullName: normalizeClientFullName({ ...payload, email: payload.email }),
        email: emailLower,
        emailLower,
        phone: payload.phone,
        city: payload.city,
        status: payload.status,
        source: payload.source,
        budget: payload.budget,
        motivation: payload.motivation,
        notes: payload.notes,
        family: payload.family,
        profiling: payload.profiling,
        marketing: payload.marketing,
        additionalInfo: payload.additionalInfo,
        projectProfiles: payload.projectProfiles,
        projectVisibility,
        gdpr: { ...payload.gdpr, updatedAt: now },
        createdAt: now,
        updatedAt: now,
      };
      await clientsRepo.create(doc as any);
      const actor = request.user as { sub?: string };
      await app.auditService.authEvent({
        eventType: 'workspaces.client.create',
        userId: actor.sub ?? 'system',
        details: {
          workspaceId: params.workspaceId,
          clientId: doc._id,
          email: emailLower,
          visibilityMode: projectVisibility.mode,
          projectIds: projectVisibility.projectIds,
        },
      });
      return reply.status(201).send({ data: doc });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId/clients/:clientId',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema('patchWorkspaceClient', 'Workspaces', 'Aggiorna cliente workspace'),
        params: {
          type: 'object',
          required: ['workspaceId', 'clientId'],
          properties: { workspaceId: { type: 'string' }, clientId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; clientId: string };
      const payload = clientUpdateSchema.parse(request.body);
      const filter = {
        $and: [
          mongoPrimaryKeyFilter(params.clientId),
          { $or: [{ workspaceId: params.workspaceId }, { workspace_id: params.workspaceId }] },
          ACTIVE_FILTER,
        ],
      } as any;
      const existing = await clientsRepo.findOne(filter);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'WorkspaceClientNotFound', message: 'Client not found', status: 404 },
        });
      }
      const emailLower = payload.email != null ? normalizeEmailLower(payload.email) : undefined;
      if (emailLower != null) {
        const duplicate = await clientsRepo.findOne({
          $and: [
            { $or: [{ workspaceId: params.workspaceId }, { workspace_id: params.workspaceId }] },
            { $or: [{ emailLower }, { email: emailLower }] },
            { _id: { $ne: (existing as { _id: unknown })._id } },
            ACTIVE_FILTER,
          ],
        } as any);
        if (duplicate != null) {
          return reply.status(409).send({
            error: {
              code: 'WorkspaceClientEmailAlreadyExists',
              message: 'A client with this email already exists in this workspace',
              status: 409,
            },
          });
        }
      }
      const projectVisibility =
        payload.projectVisibility != null
          ? normalizeClientVisibility(payload.projectVisibility)
          : undefined;
      if (
        projectVisibility != null &&
        !(await assertClientVisibilityProjects(app, params.workspaceId, projectVisibility))
      ) {
        return reply.status(400).send({
          error: {
            code: 'InvalidClientProjectVisibility',
            message: 'Project visibility must reference active projects in this workspace',
            status: 400,
          },
        });
      }
      if (
        payload.projectProfiles != null &&
        !(await assertClientProjectProfilesProjects(
          app,
          params.workspaceId,
          payload.projectProfiles,
        ))
      ) {
        return reply.status(400).send({
          error: {
            code: 'InvalidClientProjectProfiles',
            message: 'Project profiles must reference active projects in this workspace',
            status: 400,
          },
        });
      }
      const now = new Date().toISOString();
      const set: Record<string, unknown> = { updatedAt: now };
      for (const field of [
        'firstName',
        'lastName',
        'phone',
        'city',
        'status',
        'source',
        'motivation',
        'notes',
      ] as const) {
        if (payload[field] !== undefined) set[field] = payload[field]?.trim?.() ?? payload[field];
      }
      for (const field of [
        'budget',
        'family',
        'profiling',
        'marketing',
        'additionalInfo',
        'projectProfiles',
      ] as const) {
        if (payload[field] !== undefined) set[field] = payload[field];
      }
      if (emailLower != null) {
        set.email = emailLower;
        set.emailLower = emailLower;
      }
      if (
        payload.fullName !== undefined ||
        payload.firstName !== undefined ||
        payload.lastName !== undefined ||
        emailLower != null
      ) {
        set.fullName = normalizeClientFullName({
          firstName: payload.firstName ?? existing.firstName,
          lastName: payload.lastName ?? existing.lastName,
          fullName: payload.fullName ?? existing.fullName,
          email: emailLower ?? existing.email,
        });
      }
      if (projectVisibility != null) set.projectVisibility = projectVisibility;
      if (payload.gdpr != null) set.gdpr = { ...payload.gdpr, updatedAt: now };
      await clientsRepo.updateOne(filter, { $set: set } as any);
      const updated = await clientsRepo.findOne(filter);
      const actor = request.user as { sub?: string };
      await app.auditService.authEvent({
        eventType: 'workspaces.client.update',
        userId: actor.sub ?? 'system',
        details: {
          workspaceId: params.workspaceId,
          clientId: params.clientId,
          fields: Object.keys(set).filter((field) => field !== 'updatedAt'),
        },
      });
      return reply.send({ data: updated });
    },
  );
};
