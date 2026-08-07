/**
 * Project Detail (POC-plus) — 11 sezioni:
 * 1. Identity (PATCH /v1/projects/:projectId)        — gestita da projects/routes.ts (esteso)
 * 2. Contacts (PATCH /v1/projects/:projectId)        — gestita da projects/routes.ts (esteso)
 * 3. Branding         GET/PUT /v1/projects/:projectId/branding
 * 4. Policies         GET/PUT /v1/projects/:projectId/policies
 * 5. Marketing settings GET/PUT /v1/projects/:projectId/marketing-settings
 * 6. Workflow settings  GET/PUT /v1/projects/:projectId/workflow-settings
 * 7. Email config       GET/PUT /v1/projects/:projectId/email-config
 * 8. Email templates CRUD (tz_project_email_templates, unique projectId+name)
 * 9. PDF templates CRUD  (tz_project_pdf_templates, unique projectId+templateKey)
 * 10. Legacy overrides   GET/PUT /v1/projects/:projectId/legacy-overrides
 * 11. Connectors discovery (stub feature-flagged) + Workflow lookup
 */

import crypto from 'node:crypto';

import { z } from 'zod';

import { MongoRepository, WorkspaceMembersRepository } from '@followup/db';

import { activeResourceStatusFilter } from '../../lib/mongoIdentity.js';
import { isTecmaPlatformAdmin, normalizeSystemRole } from '@followup/shared-rbac';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  createdObjectSchema,
  listSchema,
  okDeletedSchema,
  singleObjectSchema,
} from '../../schemas/routeHelpers.js';
import { ensureEncryptedSecret, maskedSecret } from '../../lib/secrets.js';
import {
  activeMembershipStatusFilter,
  buildUserWorkspaceMembershipFilter,
  normalizeToStringId,
} from '../../lib/mongoIdentity.js';
import {
  buildMongoSkip,
  buildMongoSort,
  buildPaginationInfo,
  parsePaginationQuery,
  type PaginationParams,
} from '../../lib/pagination.js';
import { resolveUserIdentityCandidates } from '../../lib/userIdentity.js';
import { withAudit } from '../audit/withAudit.js';
import {
  syncLegacyPayloadRawProjectMergePatch,
  type ProjectDocForLegacySync,
} from './syncLegacyPayloadRawProject.js';
import {
  mirrorProjectEmailTemplatesInLegacyRaw,
  mirrorProjectPdfTemplatesInLegacyRaw,
} from './projectTemplatesLegacyMirror.js';

const colorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/u, 'primaryColor must be a 6-digit hex like #1A2B3C');

const optionalUrl = z.string().url().or(z.literal('')).optional();
const optionalEmail = z.string().email().or(z.literal('')).optional();

const brandingSchema = z.object({
  logoUrl: optionalUrl,
  emailHeaderUrl: optionalUrl,
  primaryColor: colorSchema.optional(),
  secondaryColor: colorSchema.optional(),
  footerText: z.string().max(500).optional(),
  faviconUrl: optionalUrl,
});

const policiesSchema = z.object({
  privacyPolicyUrl: optionalUrl,
  termsUrl: optionalUrl,
  cookiePolicyUrl: optionalUrl,
  consentBannerEnabled: z.boolean().optional(),
  defaultRetentionDays: z.number().int().min(0).max(36500).optional(),
});

const marketingSettingsSchema = z.object({
  googleAnalyticsId: z.string().max(64).optional(),
  ga4PropertyId: z.string().max(64).optional(),
  googleAdsCustomerId: z.string().max(64).optional(),
  googleAdsLoginCustomerId: z.string().max(64).optional(),
  metaAdAccountId: z.string().max(64).optional(),
  facebookPixelId: z.string().max(64).optional(),
  siteHostname: z.string().max(255).optional(),
  utmDefaults: z.record(z.string()).optional(),
});

const workflowSettingsSchema = z.object({
  flowType: z.string().max(64).optional(),
  workflowId: z.string().max(64).optional(),
  autoAssign: z.boolean().optional(),
  reminderDays: z.number().int().min(0).max(365).optional(),
});

const emailConfigSchema = z.object({
  smtpHost: z.string().max(255).optional(),
  smtpPort: z.number().int().min(1).max(65535).optional(),
  smtpSecure: z.boolean().optional(),
  smtpUsername: z.string().max(255).optional(),
  smtpPassword: z.string().max(255).optional(),
  fromEmail: optionalEmail,
  fromName: z.string().max(255).optional(),
  replyToEmail: optionalEmail,
});

const emailTemplateCreateSchema = z.object({
  name: z.string().min(1).max(120),
  subject: z.string().min(1).max(255),
  htmlBody: z.string().min(1),
  textBody: z.string().optional(),
  placeholders: z.array(z.string()).optional(),
});

const emailTemplateUpdateSchema = emailTemplateCreateSchema.partial();

const pdfTemplateCreateSchema = z.object({
  templateKey: z.string().min(1).max(120),
  name: z.string().min(1).max(255),
  htmlBody: z.string().min(1),
  pageOrientation: z.enum(['portrait', 'landscape']).optional(),
  pageSize: z.enum(['A4', 'Letter', 'Legal']).optional(),
});

const pdfTemplateUpdateSchema = pdfTemplateCreateSchema.partial();

const advancedOverrideSchema = z.object({
  path: z.string().min(1),
  valueType: z.enum(['string', 'number', 'boolean', 'json']),
  value: z.unknown(),
});

const optionalBooleanFlagsSchema = z.record(z.boolean());
const optionalJsonObjectSchema = z.record(z.unknown());
const legacyToolSchema = z.object({
  name: z.string().max(120).optional(),
  version: z.string().max(120).optional(),
  url: z.string().max(2048).optional(),
  baseUrl: z.string().max(2048).optional(),
  enabled: z.boolean().optional(),
});

const legacyOverridesSchema = z.object({
  enabledTools: optionalBooleanFlagsSchema.optional(),
  floorPlanning: optionalBooleanFlagsSchema.optional(),
  neurosales: optionalBooleanFlagsSchema.optional(),
  myHome: optionalBooleanFlagsSchema.optional(),
  appointments: optionalBooleanFlagsSchema.optional(),
  policyFlags: optionalBooleanFlagsSchema.optional(),
  jobs: z
    .object({
      leaseExpiryReminderEnabled: z.boolean().optional(),
      reminderDaysBefore: z.number().int().min(0).max(36500).optional(),
    })
    .optional(),
  identityFields: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]))
    .optional(),
  pageTitles: z.record(z.string()).optional(),
  legacyEnabledTools: z.array(legacyToolSchema).optional(),
  manifestConfig: optionalJsonObjectSchema.optional(),
  myLivingConfig: optionalJsonObjectSchema.optional(),
  rentAssetContext: optionalJsonObjectSchema.optional(),
  myhomeConfig: optionalJsonObjectSchema.optional(),
  jobsConfig: optionalJsonObjectSchema.optional(),
  followupConfig: optionalJsonObjectSchema.optional(),
  floorPlanningConfig: optionalJsonObjectSchema.optional(),
  neurosalesConfig: optionalJsonObjectSchema.optional(),
  legacyPolicyFlags: optionalJsonObjectSchema.optional(),
  businessPlatformConfig: optionalJsonObjectSchema.optional(),
  domainWhitelist: z.array(z.string().max(255)).optional(),
  projectFlags: optionalJsonObjectSchema.optional(),
  proposalTemplate: optionalJsonObjectSchema.optional(),
  iban: z.unknown().optional(),
  advancedOverrides: z.array(advancedOverrideSchema).optional(),
});

type JsonSchemaObject = {
  type: 'object';
  additionalProperties?: boolean | Record<string, unknown>;
  required?: string[];
  properties: Record<string, unknown>;
};

type ProjectDetailDocument = Record<string, unknown> & {
  _id: string;
  projectId: string;
  status?: 'active' | 'deleted' | string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
};

type ProjectEmailTemplateDocument = ProjectDetailDocument & {
  name: string;
  subject: string;
  htmlBody: string;
  textBody?: string;
  placeholders?: string[];
};

type ProjectPdfTemplateDocument = ProjectDetailDocument & {
  templateKey: string;
  name: string;
  htmlBody: string;
  pageOrientation?: 'portrait' | 'landscape';
  pageSize?: 'A4' | 'Letter' | 'Legal';
};

type ProjectConnectorConfigDocument = ProjectDetailDocument & {
  connector?: string;
  config?: Record<string, unknown>;
};

type ProjectWorkflowDocument = ProjectDetailDocument & {
  workflowId?: string;
  name?: string;
};

const optionalUrlJsonSchema = { type: 'string', format: 'uri', maxLength: 2048 };
const optionalEmailJsonSchema = { type: 'string', format: 'email', maxLength: 255 };

const brandingBodySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    logoUrl: optionalUrlJsonSchema,
    emailHeaderUrl: optionalUrlJsonSchema,
    primaryColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    secondaryColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    footerText: { type: 'string', maxLength: 500 },
    faviconUrl: optionalUrlJsonSchema,
  },
};

const policiesBodySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    privacyPolicyUrl: optionalUrlJsonSchema,
    termsUrl: optionalUrlJsonSchema,
    cookiePolicyUrl: optionalUrlJsonSchema,
    consentBannerEnabled: { type: 'boolean' },
    defaultRetentionDays: { type: 'integer', minimum: 0, maximum: 36500 },
  },
};

const marketingSettingsBodySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    googleAnalyticsId: { type: 'string', maxLength: 64 },
    ga4PropertyId: { type: 'string', maxLength: 64 },
    googleAdsCustomerId: { type: 'string', maxLength: 64 },
    googleAdsLoginCustomerId: { type: 'string', maxLength: 64 },
    metaAdAccountId: { type: 'string', maxLength: 64 },
    facebookPixelId: { type: 'string', maxLength: 64 },
    siteHostname: { type: 'string', maxLength: 255 },
    utmDefaults: {
      type: 'object',
      additionalProperties: { type: 'string' },
    },
  },
};

const workflowSettingsBodySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    flowType: { type: 'string', maxLength: 64 },
    workflowId: { type: 'string', maxLength: 64 },
    autoAssign: { type: 'boolean' },
    reminderDays: { type: 'integer', minimum: 0, maximum: 365 },
  },
};

const emailConfigBodySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    smtpHost: { type: 'string', maxLength: 255 },
    smtpPort: { type: 'integer', minimum: 1, maximum: 65535 },
    smtpSecure: { type: 'boolean' },
    smtpUsername: { type: 'string', maxLength: 255 },
    smtpPassword: { type: 'string', maxLength: 255 },
    fromEmail: optionalEmailJsonSchema,
    fromName: { type: 'string', maxLength: 255 },
    replyToEmail: optionalEmailJsonSchema,
  },
};

const legacyOverridesBodySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: {
    enabledTools: { type: 'object', additionalProperties: { type: 'boolean' } },
    floorPlanning: { type: 'object', additionalProperties: { type: 'boolean' } },
    neurosales: { type: 'object', additionalProperties: { type: 'boolean' } },
    myHome: { type: 'object', additionalProperties: { type: 'boolean' } },
    appointments: { type: 'object', additionalProperties: { type: 'boolean' } },
    policyFlags: { type: 'object', additionalProperties: { type: 'boolean' } },
    jobs: {
      type: 'object',
      additionalProperties: false,
      properties: {
        leaseExpiryReminderEnabled: { type: 'boolean' },
        reminderDaysBefore: { type: 'integer', minimum: 0, maximum: 36500 },
      },
    },
    identityFields: {
      type: 'object',
      additionalProperties: {
        anyOf: [
          { type: 'string' },
          { type: 'number' },
          { type: 'boolean' },
          { type: 'array', items: { type: 'string' } },
        ],
      },
    },
    pageTitles: { type: 'object', additionalProperties: { type: 'string' } },
    legacyEnabledTools: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string', maxLength: 120 },
          version: { type: 'string', maxLength: 120 },
          url: { type: 'string', maxLength: 2048 },
          baseUrl: { type: 'string', maxLength: 2048 },
          enabled: { type: 'boolean' },
        },
      },
    },
    manifestConfig: { type: 'object', additionalProperties: true },
    myLivingConfig: { type: 'object', additionalProperties: true },
    rentAssetContext: { type: 'object', additionalProperties: true },
    myhomeConfig: { type: 'object', additionalProperties: true },
    jobsConfig: { type: 'object', additionalProperties: true },
    followupConfig: { type: 'object', additionalProperties: true },
    floorPlanningConfig: { type: 'object', additionalProperties: true },
    neurosalesConfig: { type: 'object', additionalProperties: true },
    legacyPolicyFlags: { type: 'object', additionalProperties: true },
    businessPlatformConfig: { type: 'object', additionalProperties: true },
    domainWhitelist: { type: 'array', items: { type: 'string', maxLength: 255 } },
    projectFlags: { type: 'object', additionalProperties: true },
    proposalTemplate: { type: 'object', additionalProperties: true },
    iban: {},
    advancedOverrides: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'valueType', 'value'],
        properties: {
          path: { type: 'string', minLength: 1 },
          valueType: { type: 'string', enum: ['string', 'number', 'boolean', 'json'] },
          value: {},
        },
      },
    },
  },
};

const emailTemplateCreateBodySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'subject', 'htmlBody'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 120 },
    subject: { type: 'string', minLength: 1, maxLength: 255 },
    htmlBody: { type: 'string', minLength: 1 },
    textBody: { type: 'string' },
    placeholders: { type: 'array', items: { type: 'string' } },
  },
};

const emailTemplateUpdateBodySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: emailTemplateCreateBodySchema.properties,
};

const pdfTemplateCreateBodySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['templateKey', 'name', 'htmlBody'],
  properties: {
    templateKey: { type: 'string', minLength: 1, maxLength: 120 },
    name: { type: 'string', minLength: 1, maxLength: 255 },
    htmlBody: { type: 'string', minLength: 1 },
    pageOrientation: { type: 'string', enum: ['portrait', 'landscape'] },
    pageSize: { type: 'string', enum: ['A4', 'Letter', 'Legal'] },
  },
};

const pdfTemplateUpdateBodySchema: JsonSchemaObject = {
  type: 'object',
  additionalProperties: false,
  properties: pdfTemplateCreateBodySchema.properties,
};

type ProjectIdParams = { projectId: string };
const ACTIVE_FILTER = { status: { $ne: 'deleted' } } as const;

const templateListAllowedSortFields = ['name', 'templateKey', 'subject', 'createdAt', 'updatedAt'];
const connectorLookupAllowedSortFields = ['name', 'id', 'createdAt', 'updatedAt'];

const paginationQueryJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    page: { type: 'integer', minimum: 1, default: 1 },
    perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    sortField: { type: 'string' },
    sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
  },
};

const paginateArray = <T>(
  rows: T[],
  params: PaginationParams,
): { data: T[]; paginationInfo: ReturnType<typeof buildPaginationInfo> } => {
  const start = buildMongoSkip(params);
  return {
    data: rows.slice(start, start + params.perPage),
    paginationInfo: buildPaginationInfo(rows.length, params),
  };
};

const sanitizeEmailConfig = (
  doc: Record<string, unknown> | null,
): Record<string, unknown> | null => {
  if (doc == null) return null;
  const copy: Record<string, unknown> = { ...doc };
  const smtpMask = maskedSecret(copy.smtpPassword);
  if (smtpMask != null) {
    copy.smtpPassword = smtpMask;
  }
  return copy;
};

const TEMPLATE_HTML_BLOCKLIST = [
  /<\s*script\b/iu,
  /<\s*iframe\b/iu,
  /<\s*object\b/iu,
  /<\s*embed\b/iu,
  /\son\w+\s*=/iu,
  /javascript\s*:/iu,
  /vbscript\s*:/iu,
  /data\s*:/iu,
];

const isUnsafeTemplateHtml = (html: string): boolean =>
  TEMPLATE_HTML_BLOCKLIST.some((rule) => rule.test(html));

interface SingletonRouteOptions<T extends z.ZodTypeAny> {
  app: FastifyInstance;
  repo: MongoRepository<ProjectDetailDocument>;
  pathSegment: string;
  collectionName: string;
  tag: string;
  operationGet: string;
  operationPut: string;
  schema: T;
  bodySchema: JsonSchemaObject;
  postPersist?: (doc: ProjectDetailDocument | null) => Record<string, unknown> | null;
  auditEvent: string;
  /** Se true, dopo PUT merge sotto `legacyPayload.rawProject[<pathSegment>]` (no sync su legacy-overrides). */
  mirrorLegacyRawProjectSection?: boolean;
  projectsRepo?: MongoRepository<ProjectDocForLegacySync>;
  activeFilter?: Record<string, unknown>;
}

const registerSingletonSection = <T extends z.ZodTypeAny>(
  options: SingletonRouteOptions<T>,
): void => {
  const {
    app,
    repo,
    pathSegment,
    tag,
    operationGet,
    operationPut,
    schema,
    bodySchema,
    postPersist,
    auditEvent,
    mirrorLegacyRawProjectSection,
    projectsRepo,
    activeFilter,
  } = options;
  const url = `/v1/projects/:projectId/${pathSegment}`;

  app.get(
    url,
    {
      preHandler: [app.authenticate, app.requireCanAccessProject('read')],
      schema: {
        ...singleObjectSchema(operationGet, tag, `Read project ${pathSegment}`),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string', description: 'Project id' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams;
      const doc = (await repo.findOne({
        projectId: params.projectId,
      })) as ProjectDetailDocument | null;
      const sanitized = postPersist != null ? postPersist(doc) : doc;
      return reply.send({ data: sanitized ?? null });
    },
  );

  app.put(
    url,
    {
      preHandler: [
        app.authenticate,
        app.requireCanAccessProject('admin'),
        withAudit(auditEvent, async (request) => {
          const params = request.params as ProjectIdParams;
          return { projectId: params.projectId, severity: 'info' as const };
        }),
      ],
      schema: {
        ...singleObjectSchema(operationPut, tag, `Upsert project ${pathSegment}`),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string', description: 'Project id' } },
        },
        body: bodySchema,
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams;
      const parsed = schema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'ValidationError',
            message: 'Invalid payload',
            status: 400,
            details: parsed.error.errors.map((entry) => ({
              field: entry.path.join('.') || 'body',
              messageDetail: [entry.message],
            })),
          },
        });
      }
      const now = new Date().toISOString();
      const existing = await repo.findOne({ projectId: params.projectId });
      const body = { ...(parsed.data as Record<string, unknown>) };
      if (pathSegment === 'email-config' && Object.hasOwn(body, 'smtpPassword')) {
        const encrypted = ensureEncryptedSecret(body.smtpPassword);
        if (encrypted != null) body.smtpPassword = encrypted;
      }
      if (existing == null) {
        const created = {
          _id: crypto.randomUUID(),
          projectId: params.projectId,
          ...body,
          createdAt: now,
          updatedAt: now,
        };
        await repo.create(created as ProjectDetailDocument);
        if (mirrorLegacyRawProjectSection && projectsRepo != null && activeFilter != null) {
          try {
            const mirrorPayload = { ...body } as Record<string, unknown>;
            if (pathSegment === 'email-config') {
              delete mirrorPayload.smtpPassword;
            }
            await syncLegacyPayloadRawProjectMergePatch({
              projectsRepo,
              projectId: params.projectId,
              activeFilter,
              rawNestedPatch: { [pathSegment]: mirrorPayload },
              updatedAt: now,
            });
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Legacy sync failed';
            return reply.status(400).send({
              error: { code: 'LegacyPayloadError', message, status: 400 },
            });
          }
        }
        const sanitized = postPersist != null ? postPersist(created) : created;
        return reply.send({ data: sanitized });
      }
      const updated = {
        ...(existing as Record<string, unknown>),
        ...body,
        updatedAt: now,
      };
      const id = (existing as { _id: unknown })._id as string;
      await repo.updateOne({ _id: id } as any, { $set: { ...body, updatedAt: now } });
      if (mirrorLegacyRawProjectSection && projectsRepo != null && activeFilter != null) {
        try {
          const mirrorPayload = { ...body } as Record<string, unknown>;
          if (pathSegment === 'email-config') {
            delete mirrorPayload.smtpPassword;
          }
          await syncLegacyPayloadRawProjectMergePatch({
            projectsRepo,
            projectId: params.projectId,
            activeFilter,
            rawNestedPatch: { [pathSegment]: mirrorPayload },
            updatedAt: now,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Legacy sync failed';
          return reply.status(400).send({
            error: { code: 'LegacyPayloadError', message, status: 400 },
          });
        }
      }
      const sanitized =
        postPersist != null ? postPersist(updated as ProjectDetailDocument) : updated;
      return reply.send({ data: sanitized });
    },
  );
};

export const projectDetailRoutes = async (app: FastifyInstance): Promise<void> => {
  const activeFilter = activeResourceStatusFilter();
  const projectsRepo = new MongoRepository<ProjectDocForLegacySync>(
    app.mongoDb.collection<ProjectDocForLegacySync>('tz_projects'),
  );
  const sendLegacyMirrorError = (reply: FastifyReply, err: unknown) => {
    const message = err instanceof Error ? err.message : 'Legacy sync failed';
    return reply.status(400).send({
      error: { code: 'LegacyPayloadError', message, status: 400 },
    });
  };
  const brandingRepo = new MongoRepository<ProjectDetailDocument>(
    app.mongoDb.collection<ProjectDetailDocument>('tz_project_branding'),
  );
  const policiesRepo = new MongoRepository<ProjectDetailDocument>(
    app.mongoDb.collection<ProjectDetailDocument>('tz_project_policies'),
  );
  const marketingRepo = new MongoRepository<ProjectDetailDocument>(
    app.mongoDb.collection<ProjectDetailDocument>('tz_project_marketing_settings'),
  );
  const workflowRepo = new MongoRepository<ProjectDetailDocument>(
    app.mongoDb.collection<ProjectDetailDocument>('tz_project_workflow_settings'),
  );
  const emailConfigRepo = new MongoRepository<ProjectDetailDocument>(
    app.mongoDb.collection<ProjectDetailDocument>('tz_project_email_config'),
  );
  const legacyOverridesRepo = new MongoRepository<ProjectDetailDocument>(
    app.mongoDb.collection<ProjectDetailDocument>('tz_project_legacy_overrides'),
  );
  const emailTemplatesRepo = new MongoRepository<ProjectEmailTemplateDocument>(
    app.mongoDb.collection<ProjectEmailTemplateDocument>('tz_project_email_templates'),
  );
  const pdfTemplatesRepo = new MongoRepository<ProjectPdfTemplateDocument>(
    app.mongoDb.collection<ProjectPdfTemplateDocument>('tz_project_pdf_templates'),
  );
  const connectorConfigsRepo = new MongoRepository<ProjectConnectorConfigDocument>(
    app.mongoDb.collection<ProjectConnectorConfigDocument>('tz_connector_configs'),
  );
  const workflowConfigsRepo = new MongoRepository<ProjectDetailDocument>(
    app.mongoDb.collection<ProjectDetailDocument>('tz_workflow_configs'),
  );
  const workflowsRepo = new MongoRepository<ProjectWorkflowDocument>(
    app.mongoDb.collection<ProjectWorkflowDocument>('tz_workflows'),
  );
  const workspaceMembersRepo = new WorkspaceMembersRepository(app.mongoDb);

  registerSingletonSection({
    app,
    repo: brandingRepo,
    pathSegment: 'branding',
    collectionName: 'tz_project_branding',
    tag: 'Projects',
    operationGet: 'getProjectBranding',
    operationPut: 'putProjectBranding',
    schema: brandingSchema,
    bodySchema: brandingBodySchema,
    auditEvent: 'project.branding.updated',
    mirrorLegacyRawProjectSection: true,
    projectsRepo,
    activeFilter,
  });

  registerSingletonSection({
    app,
    repo: policiesRepo,
    pathSegment: 'policies',
    collectionName: 'tz_project_policies',
    tag: 'Projects',
    operationGet: 'getProjectPolicies',
    operationPut: 'putProjectPolicies',
    schema: policiesSchema,
    bodySchema: policiesBodySchema,
    auditEvent: 'project.policies.updated',
    mirrorLegacyRawProjectSection: true,
    projectsRepo,
    activeFilter,
  });

  registerSingletonSection({
    app,
    repo: marketingRepo,
    pathSegment: 'marketing-settings',
    collectionName: 'tz_project_marketing_settings',
    tag: 'Projects',
    operationGet: 'getProjectMarketingSettings',
    operationPut: 'putProjectMarketingSettings',
    schema: marketingSettingsSchema,
    bodySchema: marketingSettingsBodySchema,
    auditEvent: 'project.marketing.updated',
    mirrorLegacyRawProjectSection: true,
    projectsRepo,
    activeFilter,
  });

  registerSingletonSection({
    app,
    repo: workflowRepo,
    pathSegment: 'workflow-settings',
    collectionName: 'tz_project_workflow_settings',
    tag: 'Projects',
    operationGet: 'getProjectWorkflowSettings',
    operationPut: 'putProjectWorkflowSettings',
    schema: workflowSettingsSchema,
    bodySchema: workflowSettingsBodySchema,
    auditEvent: 'project.workflow.updated',
    mirrorLegacyRawProjectSection: true,
    projectsRepo,
    activeFilter,
  });

  registerSingletonSection({
    app,
    repo: emailConfigRepo,
    pathSegment: 'email-config',
    collectionName: 'tz_project_email_config',
    tag: 'Projects',
    operationGet: 'getProjectEmailConfig',
    operationPut: 'putProjectEmailConfig',
    schema: emailConfigSchema,
    bodySchema: emailConfigBodySchema,
    postPersist: sanitizeEmailConfig,
    auditEvent: 'project.email-config.updated',
    mirrorLegacyRawProjectSection: true,
    projectsRepo,
    activeFilter,
  });

  registerSingletonSection({
    app,
    repo: legacyOverridesRepo,
    pathSegment: 'legacy-overrides',
    collectionName: 'tz_project_legacy_overrides',
    tag: 'Projects',
    operationGet: 'getProjectLegacyOverrides',
    operationPut: 'putProjectLegacyOverrides',
    schema: legacyOverridesSchema,
    bodySchema: legacyOverridesBodySchema,
    auditEvent: 'project.legacy-overrides.updated',
  });

  app.get(
    '/v1/projects/:projectId/email-templates',
    {
      preHandler: [app.authenticate, app.requireCanAccessProject('read')],
      schema: {
        ...listSchema('listProjectEmailTemplates', 'Projects', 'List project email templates'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string', description: 'Project id' } },
        },
        querystring: paginationQueryJsonSchema,
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams;
      const paginationParams = parsePaginationQuery(request.query, templateListAllowedSortFields);
      const filter = {
        projectId: params.projectId,
        ...ACTIVE_FILTER,
      };
      const [totalDocs, docs] = await Promise.all([
        emailTemplatesRepo.count(filter),
        emailTemplatesRepo.listPaginated(filter, {
          sort: buildMongoSort(paginationParams, 'updatedAt'),
          skip: buildMongoSkip(paginationParams),
          limit: paginationParams.perPage,
        }),
      ]);
      return reply.send({
        data: docs,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.post(
    '/v1/projects/:projectId/email-templates',
    {
      preHandler: [
        app.authenticate,
        app.requireCanAccessProject('admin'),
        withAudit('project.email-template.created', async (request) => {
          const params = request.params as ProjectIdParams;
          return { projectId: params.projectId };
        }),
      ],
      schema: {
        ...createdObjectSchema('createProjectEmailTemplate', 'Projects', 'Create email template'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string', description: 'Project id' } },
        },
        body: emailTemplateCreateBodySchema,
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams;
      const parsed = emailTemplateCreateSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'ValidationError',
            message: 'Invalid email template payload',
            status: 400,
            details: parsed.error.errors.map((entry) => ({
              field: entry.path.join('.') || 'body',
              messageDetail: [entry.message],
            })),
          },
        });
      }
      if (isUnsafeTemplateHtml(parsed.data.htmlBody)) {
        return reply.status(400).send({
          error: {
            code: 'UnsafeHtmlTemplate',
            message: 'htmlBody contains blocked tags or attributes',
            status: 400,
          },
        });
      }
      const existing = await emailTemplatesRepo.findOne({
        projectId: params.projectId,
        name: parsed.data.name,
        ...ACTIVE_FILTER,
      });
      if (existing != null) {
        return reply.status(409).send({
          error: {
            code: 'Conflict',
            message: 'Email template name must be unique within project',
            status: 409,
          },
        });
      }
      const now = new Date().toISOString();
      const created = {
        _id: crypto.randomUUID(),
        projectId: params.projectId,
        ...parsed.data,
        createdAt: now,
        updatedAt: now,
      };
      await emailTemplatesRepo.create(created as ProjectEmailTemplateDocument);
      try {
        await mirrorProjectEmailTemplatesInLegacyRaw({
          projectsRepo,
          emailTemplatesRepo: emailTemplatesRepo as unknown as MongoRepository<
            Record<string, unknown>
          >,
          projectId: params.projectId,
          activeFilter,
          updatedAt: now,
        });
      } catch (err) {
        return sendLegacyMirrorError(reply, err);
      }
      return reply.status(201).send({ data: created });
    },
  );

  app.patch(
    '/v1/projects/:projectId/email-templates/:templateId',
    {
      preHandler: [
        app.authenticate,
        app.requireCanAccessProject('admin'),
        withAudit('project.email-template.updated', async (request) => {
          const params = request.params as ProjectIdParams & { templateId: string };
          return { projectId: params.projectId, details: { templateId: params.templateId } };
        }),
      ],
      schema: {
        ...singleObjectSchema('patchProjectEmailTemplate', 'Projects', 'Update email template'),
        params: {
          type: 'object',
          required: ['projectId', 'templateId'],
          properties: {
            projectId: { type: 'string', description: 'Project id' },
            templateId: { type: 'string', description: 'Template id' },
          },
        },
        body: emailTemplateUpdateBodySchema,
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams & { templateId: string };
      const parsed = emailTemplateUpdateSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'ValidationError',
            message: 'Invalid email template payload',
            status: 400,
          },
        });
      }
      if (parsed.data.htmlBody != null && isUnsafeTemplateHtml(parsed.data.htmlBody)) {
        return reply.status(400).send({
          error: {
            code: 'UnsafeHtmlTemplate',
            message: 'htmlBody contains blocked tags or attributes',
            status: 400,
          },
        });
      }
      const existing = await emailTemplatesRepo.findOne({
        _id: params.templateId,
        projectId: params.projectId,
        ...ACTIVE_FILTER,
      } as any);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'NotFound', message: 'Email template not found', status: 404 },
        });
      }
      const now = new Date().toISOString();
      await emailTemplatesRepo.updateOne({ _id: params.templateId } as any, {
        $set: { ...parsed.data, updatedAt: now },
      });
      const updated = { ...existing, ...parsed.data, updatedAt: now };
      try {
        await mirrorProjectEmailTemplatesInLegacyRaw({
          projectsRepo,
          emailTemplatesRepo: emailTemplatesRepo as unknown as MongoRepository<
            Record<string, unknown>
          >,
          projectId: params.projectId,
          activeFilter,
          updatedAt: now,
        });
      } catch (err) {
        return sendLegacyMirrorError(reply, err);
      }
      return reply.send({ data: updated });
    },
  );

  app.delete(
    '/v1/projects/:projectId/email-templates/:templateId',
    {
      preHandler: [
        app.authenticate,
        app.requireCanAccessProject('admin'),
        withAudit('project.email-template.deleted', async (request) => {
          const params = request.params as ProjectIdParams & { templateId: string };
          return { projectId: params.projectId, details: { templateId: params.templateId } };
        }),
      ],
      schema: {
        ...okDeletedSchema('deleteProjectEmailTemplate', 'Projects', 'Delete email template'),
        params: {
          type: 'object',
          required: ['projectId', 'templateId'],
          properties: {
            projectId: { type: 'string', description: 'Project id' },
            templateId: { type: 'string', description: 'Template id' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams & { templateId: string };
      const existing = await emailTemplatesRepo.findOne({
        _id: params.templateId,
        projectId: params.projectId,
        ...ACTIVE_FILTER,
      } as any);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'NotFound', message: 'Email template not found', status: 404 },
        });
      }
      const now = new Date().toISOString();
      await emailTemplatesRepo.updateOne(
        { _id: params.templateId } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: (request.user as { sub?: string })?.sub ?? 'system',
            updatedAt: now,
          },
        } as any,
      );
      try {
        await mirrorProjectEmailTemplatesInLegacyRaw({
          projectsRepo,
          emailTemplatesRepo: emailTemplatesRepo as unknown as MongoRepository<
            Record<string, unknown>
          >,
          projectId: params.projectId,
          activeFilter,
          updatedAt: now,
        });
      } catch (err) {
        return sendLegacyMirrorError(reply, err);
      }
      return reply.send({ data: { deleted: true } });
    },
  );

  app.get(
    '/v1/projects/:projectId/pdf-templates',
    {
      preHandler: [app.authenticate, app.requireCanAccessProject('read')],
      schema: {
        ...listSchema('listProjectPdfTemplates', 'Projects', 'List project PDF templates'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string', description: 'Project id' } },
        },
        querystring: paginationQueryJsonSchema,
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams;
      const paginationParams = parsePaginationQuery(request.query, templateListAllowedSortFields);
      const filter = {
        projectId: params.projectId,
        ...ACTIVE_FILTER,
      };
      const [totalDocs, docs] = await Promise.all([
        pdfTemplatesRepo.count(filter),
        pdfTemplatesRepo.listPaginated(filter, {
          sort: buildMongoSort(paginationParams, 'updatedAt'),
          skip: buildMongoSkip(paginationParams),
          limit: paginationParams.perPage,
        }),
      ]);
      return reply.send({
        data: docs,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.post(
    '/v1/projects/:projectId/pdf-templates',
    {
      preHandler: [
        app.authenticate,
        app.requireCanAccessProject('admin'),
        withAudit('project.pdf-template.created', async (request) => {
          const params = request.params as ProjectIdParams;
          return { projectId: params.projectId };
        }),
      ],
      schema: {
        ...createdObjectSchema('createProjectPdfTemplate', 'Projects', 'Create PDF template'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string', description: 'Project id' } },
        },
        body: pdfTemplateCreateBodySchema,
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams;
      const parsed = pdfTemplateCreateSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'ValidationError', message: 'Invalid PDF template payload', status: 400 },
        });
      }
      if (isUnsafeTemplateHtml(parsed.data.htmlBody)) {
        return reply.status(400).send({
          error: {
            code: 'UnsafeHtmlTemplate',
            message: 'htmlBody contains blocked tags or attributes',
            status: 400,
          },
        });
      }
      const existing = await pdfTemplatesRepo.findOne({
        projectId: params.projectId,
        templateKey: parsed.data.templateKey,
        ...ACTIVE_FILTER,
      });
      if (existing != null) {
        return reply.status(409).send({
          error: {
            code: 'Conflict',
            message: 'PDF template key must be unique within project',
            status: 409,
          },
        });
      }
      const now = new Date().toISOString();
      const created = {
        _id: crypto.randomUUID(),
        projectId: params.projectId,
        ...parsed.data,
        createdAt: now,
        updatedAt: now,
      };
      await pdfTemplatesRepo.create(created as ProjectPdfTemplateDocument);
      try {
        await mirrorProjectPdfTemplatesInLegacyRaw({
          projectsRepo,
          pdfTemplatesRepo: pdfTemplatesRepo as unknown as MongoRepository<Record<string, unknown>>,
          projectId: params.projectId,
          activeFilter,
          updatedAt: now,
        });
      } catch (err) {
        return sendLegacyMirrorError(reply, err);
      }
      return reply.status(201).send({ data: created });
    },
  );

  app.patch(
    '/v1/projects/:projectId/pdf-templates/:templateId',
    {
      preHandler: [
        app.authenticate,
        app.requireCanAccessProject('admin'),
        withAudit('project.pdf-template.updated', async (request) => {
          const params = request.params as ProjectIdParams & { templateId: string };
          return { projectId: params.projectId, details: { templateId: params.templateId } };
        }),
      ],
      schema: {
        ...singleObjectSchema('patchProjectPdfTemplate', 'Projects', 'Update PDF template'),
        params: {
          type: 'object',
          required: ['projectId', 'templateId'],
          properties: {
            projectId: { type: 'string', description: 'Project id' },
            templateId: { type: 'string', description: 'Template id' },
          },
        },
        body: pdfTemplateUpdateBodySchema,
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams & { templateId: string };
      const parsed = pdfTemplateUpdateSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: { code: 'ValidationError', message: 'Invalid PDF template payload', status: 400 },
        });
      }
      if (parsed.data.htmlBody != null && isUnsafeTemplateHtml(parsed.data.htmlBody)) {
        return reply.status(400).send({
          error: {
            code: 'UnsafeHtmlTemplate',
            message: 'htmlBody contains blocked tags or attributes',
            status: 400,
          },
        });
      }
      const existing = await pdfTemplatesRepo.findOne({
        _id: params.templateId,
        projectId: params.projectId,
        ...ACTIVE_FILTER,
      } as any);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'NotFound', message: 'PDF template not found', status: 404 },
        });
      }
      const now = new Date().toISOString();
      await pdfTemplatesRepo.updateOne({ _id: params.templateId } as any, {
        $set: { ...parsed.data, updatedAt: now },
      });
      const updated = { ...existing, ...parsed.data, updatedAt: now };
      try {
        await mirrorProjectPdfTemplatesInLegacyRaw({
          projectsRepo,
          pdfTemplatesRepo: pdfTemplatesRepo as unknown as MongoRepository<Record<string, unknown>>,
          projectId: params.projectId,
          activeFilter,
          updatedAt: now,
        });
      } catch (err) {
        return sendLegacyMirrorError(reply, err);
      }
      return reply.send({ data: updated });
    },
  );

  app.delete(
    '/v1/projects/:projectId/pdf-templates/:templateId',
    {
      preHandler: [
        app.authenticate,
        app.requireCanAccessProject('admin'),
        withAudit('project.pdf-template.deleted', async (request) => {
          const params = request.params as ProjectIdParams & { templateId: string };
          return { projectId: params.projectId, details: { templateId: params.templateId } };
        }),
      ],
      schema: {
        ...okDeletedSchema('deleteProjectPdfTemplate', 'Projects', 'Delete PDF template'),
        params: {
          type: 'object',
          required: ['projectId', 'templateId'],
          properties: {
            projectId: { type: 'string', description: 'Project id' },
            templateId: { type: 'string', description: 'Template id' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams & { templateId: string };
      const existing = await pdfTemplatesRepo.findOne({
        _id: params.templateId,
        projectId: params.projectId,
        ...ACTIVE_FILTER,
      } as any);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'NotFound', message: 'PDF template not found', status: 404 },
        });
      }
      const now = new Date().toISOString();
      await pdfTemplatesRepo.updateOne(
        { _id: params.templateId } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: (request.user as { sub?: string })?.sub ?? 'system',
            updatedAt: now,
          },
        } as any,
      );
      try {
        await mirrorProjectPdfTemplatesInLegacyRaw({
          projectsRepo,
          pdfTemplatesRepo: pdfTemplatesRepo as unknown as MongoRepository<Record<string, unknown>>,
          projectId: params.projectId,
          activeFilter,
          updatedAt: now,
        });
      } catch (err) {
        return sendLegacyMirrorError(reply, err);
      }
      return reply.send({ data: { deleted: true } });
    },
  );

  const ensureWorkspaceMembership = async (
    request: FastifyRequest,
    reply: FastifyReply,
    workspaceId: string,
  ): Promise<boolean> => {
    const user =
      (request.user as
        | { sub?: string; email?: string; systemRole?: string; system_role?: string }
        | undefined) ?? undefined;
    if (user?.sub == null) {
      void reply.status(401).send({
        error: { code: 'Unauthorized', message: 'Authentication required', status: 401 },
      });
      return false;
    }
    if (isTecmaPlatformAdmin(normalizeSystemRole(user))) return true;
    const identities = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
    const membership = await workspaceMembersRepo.findOne({
      ...buildUserWorkspaceMembershipFilter(workspaceId, identities),
      ...activeMembershipStatusFilter(),
    } as any);
    const normalizedWorkspaceId = normalizeToStringId(
      (membership as { workspaceId?: unknown } | null)?.workspaceId,
    );
    if (membership == null) {
      void reply.status(403).send({
        error: { code: 'Forbidden', message: 'Workspace access required', status: 403 },
      });
      return false;
    }
    if (
      normalizedWorkspaceId !== workspaceId ||
      String((membership as { status?: unknown }).status ?? '') === 'deleted'
    ) {
      void reply.status(403).send({
        error: { code: 'Forbidden', message: 'Workspace access required', status: 403 },
      });
      return false;
    }
    return true;
  };

  app.get(
    '/v1/workspaces/:workspaceId/connectors/marketing-google/ads-customers',
    {
      preHandler: [app.authenticate],
      schema: {
        ...listSchema(
          'listConnectorAdsCustomers',
          'Connectors',
          'List Google Ads customer accounts (stub)',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string', description: 'Workspace id' } },
        },
        querystring: paginationQueryJsonSchema,
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const paginationParams = parsePaginationQuery(
        request.query,
        connectorLookupAllowedSortFields,
      );
      const ok = await ensureWorkspaceMembership(request, reply, params.workspaceId);
      if (!ok) return reply;
      const config = await connectorConfigsRepo.findOne({
        workspaceId: params.workspaceId,
        connector: 'marketing-google',
      });
      if (config == null) {
        return reply.send({ data: [], paginationInfo: buildPaginationInfo(0, paginationParams) });
      }
      const accounts = Array.isArray((config as Record<string, unknown>).adsCustomers)
        ? ((config as Record<string, unknown>).adsCustomers as Array<Record<string, unknown>>)
        : [];
      return reply.send(paginateArray(accounts, paginationParams));
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/connectors/marketing-google/ga4-properties',
    {
      preHandler: [app.authenticate],
      schema: {
        ...listSchema('listConnectorGa4Properties', 'Connectors', 'List GA4 properties (stub)'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string', description: 'Workspace id' } },
        },
        querystring: paginationQueryJsonSchema,
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const paginationParams = parsePaginationQuery(
        request.query,
        connectorLookupAllowedSortFields,
      );
      const ok = await ensureWorkspaceMembership(request, reply, params.workspaceId);
      if (!ok) return reply;
      const config = await connectorConfigsRepo.findOne({
        workspaceId: params.workspaceId,
        connector: 'marketing-google',
      });
      const props = Array.isArray((config as Record<string, unknown> | null)?.ga4Properties)
        ? ((config as Record<string, unknown>).ga4Properties as Array<Record<string, unknown>>)
        : [];
      return reply.send(paginateArray(props, paginationParams));
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/connectors/marketing-meta/ad-accounts',
    {
      preHandler: [app.authenticate],
      schema: {
        ...listSchema('listConnectorMetaAdAccounts', 'Connectors', 'List Meta ad accounts (stub)'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string', description: 'Workspace id' } },
        },
        querystring: paginationQueryJsonSchema,
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const paginationParams = parsePaginationQuery(
        request.query,
        connectorLookupAllowedSortFields,
      );
      const ok = await ensureWorkspaceMembership(request, reply, params.workspaceId);
      if (!ok) return reply;
      const config = await connectorConfigsRepo.findOne({
        workspaceId: params.workspaceId,
        connector: 'marketing-meta',
      });
      const accounts = Array.isArray((config as Record<string, unknown> | null)?.adAccounts)
        ? ((config as Record<string, unknown>).adAccounts as Array<Record<string, unknown>>)
        : [];
      return reply.send(paginateArray(accounts, paginationParams));
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/workflows',
    {
      preHandler: [app.authenticate],
      schema: {
        ...listSchema('listWorkspaceWorkflows', 'Workflows', 'List workspace workflows (lookup)'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string', description: 'Workspace id' } },
        },
        querystring: paginationQueryJsonSchema,
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const paginationParams = parsePaginationQuery(request.query, ['createdAt', 'updatedAt']);
      const ok = await ensureWorkspaceMembership(request, reply, params.workspaceId);
      if (!ok) return reply;
      const filter = { workspaceId: params.workspaceId };
      const [totalDocs, docs] = await Promise.all([
        workflowsRepo.count(filter),
        workflowsRepo.listPaginated(filter, {
          sort: buildMongoSort(paginationParams, 'updatedAt'),
          skip: buildMongoSkip(paginationParams),
          limit: paginationParams.perPage,
        }),
      ]);
      return reply.send({
        data: docs,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.get(
    '/v1/workflow/config',
    {
      preHandler: [app.authenticate],
      schema: {
        ...singleObjectSchema('getWorkflowConfig', 'Workflows', 'Get workflow config by lookup'),
        querystring: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string', description: 'Workspace id' },
            projectId: { type: 'string', description: 'Project id (optional)' },
            flowType: { type: 'string', description: 'Flow type filter (optional)' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as {
        workspaceId: string;
        projectId?: string;
        flowType?: string;
      };
      const ok = await ensureWorkspaceMembership(request, reply, query.workspaceId);
      if (!ok) return reply;
      const filter: Record<string, unknown> = { workspaceId: query.workspaceId };
      if (query.projectId != null) filter.projectId = query.projectId;
      if (query.flowType != null) filter.flowType = query.flowType;
      const doc = await workflowConfigsRepo.findOne(filter);
      return reply.send({ data: doc ?? null });
    },
  );
};
