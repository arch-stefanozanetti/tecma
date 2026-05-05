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

import { MongoRepository } from '@followup/db';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  createdObjectSchema,
  listSchema,
  okDeletedSchema,
  singleObjectSchema,
} from '../../schemas/routeHelpers.js';
import { withAudit } from '../audit/withAudit.js';

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
  metaAdAccountId: z.string().max(64).optional(),
  facebookPixelId: z.string().max(64).optional(),
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

const legacyOverridesSchema = z.object({
  identityFields: z.record(z.unknown()).optional(),
  advancedOverrides: z.array(advancedOverrideSchema).optional(),
});

type ProjectIdParams = { projectId: string };

const maskApiSecret = (secret: string): string => {
  if (secret.length <= 4) return '*'.repeat(secret.length);
  const visible = secret.slice(-4);
  const masked = '*'.repeat(Math.max(secret.length - 4, 4));
  return `${masked}${visible}`;
};

const sanitizeEmailConfig = (
  doc: Record<string, unknown> | null,
): Record<string, unknown> | null => {
  if (doc == null) return null;
  const copy: Record<string, unknown> = { ...doc };
  if (typeof copy.smtpPassword === 'string' && copy.smtpPassword !== '') {
    copy.smtpPassword = maskApiSecret(copy.smtpPassword);
  }
  return copy;
};

interface SingletonRouteOptions<T extends z.ZodTypeAny> {
  app: FastifyInstance;
  repo: MongoRepository<Record<string, unknown>>;
  pathSegment: string;
  collectionName: string;
  tag: string;
  operationGet: string;
  operationPut: string;
  schema: T;
  postPersist?: (doc: Record<string, unknown> | null) => Record<string, unknown> | null;
  auditEvent: string;
}

const registerSingletonSection = <T extends z.ZodTypeAny>(
  options: SingletonRouteOptions<T>,
): void => {
  const { app, repo, pathSegment, tag, operationGet, operationPut, schema, postPersist, auditEvent } =
    options;
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
      const doc = (await repo.findOne({ projectId: params.projectId })) as
        | Record<string, unknown>
        | null;
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
        body: { type: 'object', additionalProperties: true },
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
      const body = parsed.data as Record<string, unknown>;
      if (existing == null) {
        const created = {
          _id: crypto.randomUUID(),
          projectId: params.projectId,
          ...body,
          createdAt: now,
          updatedAt: now,
        };
        await repo.create(created as Record<string, unknown>);
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
      const sanitized = postPersist != null ? postPersist(updated) : updated;
      return reply.send({ data: sanitized });
    },
  );
};

export const projectDetailRoutes = async (app: FastifyInstance): Promise<void> => {
  const brandingRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_project_branding'),
  );
  const policiesRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_project_policies'),
  );
  const marketingRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_project_marketing_settings'),
  );
  const workflowRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_project_workflow_settings'),
  );
  const emailConfigRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_project_email_config'),
  );
  const legacyOverridesRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_project_legacy_overrides'),
  );
  const emailTemplatesRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_project_email_templates'),
  );
  const pdfTemplatesRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_project_pdf_templates'),
  );
  const connectorConfigsRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_connector_configs'),
  );
  const workflowsRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_workflows'),
  );
  const workflowConfigsRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_workflow_configs'),
  );

  registerSingletonSection({
    app,
    repo: brandingRepo,
    pathSegment: 'branding',
    collectionName: 'tz_project_branding',
    tag: 'Projects',
    operationGet: 'getProjectBranding',
    operationPut: 'putProjectBranding',
    schema: brandingSchema,
    auditEvent: 'project.branding.updated',
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
    auditEvent: 'project.policies.updated',
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
    auditEvent: 'project.marketing.updated',
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
    auditEvent: 'project.workflow.updated',
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
    postPersist: sanitizeEmailConfig,
    auditEvent: 'project.email-config.updated',
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
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams;
      const docs = await emailTemplatesRepo.findMany({ projectId: params.projectId });
      return reply.send({
        data: docs,
        paginationInfo: {
          totalDocs: docs.length,
          page: 1,
          perPage: docs.length,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
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
        body: { type: 'object', additionalProperties: true },
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
      const existing = await emailTemplatesRepo.findOne({
        projectId: params.projectId,
        name: parsed.data.name,
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
      await emailTemplatesRepo.create(created as Record<string, unknown>);
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
        body: { type: 'object', additionalProperties: true },
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
      const existing = await emailTemplatesRepo.findOne({
        _id: params.templateId,
        projectId: params.projectId,
      } as any);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'NotFound', message: 'Email template not found', status: 404 },
        });
      }
      const now = new Date().toISOString();
      await emailTemplatesRepo.updateOne(
        { _id: params.templateId } as any,
        { $set: { ...parsed.data, updatedAt: now } },
      );
      const updated = { ...existing, ...parsed.data, updatedAt: now };
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
      } as any);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'NotFound', message: 'Email template not found', status: 404 },
        });
      }
      await emailTemplatesRepo.deleteOne({ _id: params.templateId } as any);
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
      },
    },
    async (request, reply) => {
      const params = request.params as ProjectIdParams;
      const docs = await pdfTemplatesRepo.findMany({ projectId: params.projectId });
      return reply.send({
        data: docs,
        paginationInfo: {
          totalDocs: docs.length,
          page: 1,
          perPage: docs.length,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
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
        body: { type: 'object', additionalProperties: true },
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
      const existing = await pdfTemplatesRepo.findOne({
        projectId: params.projectId,
        templateKey: parsed.data.templateKey,
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
      await pdfTemplatesRepo.create(created as Record<string, unknown>);
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
        body: { type: 'object', additionalProperties: true },
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
      const existing = await pdfTemplatesRepo.findOne({
        _id: params.templateId,
        projectId: params.projectId,
      } as any);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'NotFound', message: 'PDF template not found', status: 404 },
        });
      }
      const now = new Date().toISOString();
      await pdfTemplatesRepo.updateOne(
        { _id: params.templateId } as any,
        { $set: { ...parsed.data, updatedAt: now } },
      );
      const updated = { ...existing, ...parsed.data, updatedAt: now };
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
      } as any);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'NotFound', message: 'PDF template not found', status: 404 },
        });
      }
      await pdfTemplatesRepo.deleteOne({ _id: params.templateId } as any);
      return reply.send({ data: { deleted: true } });
    },
  );

  const ensureWorkspaceMembership = async (
    request: FastifyRequest,
    reply: FastifyReply,
    workspaceId: string,
  ): Promise<boolean> => {
    const user = request.user as { sub?: string; systemRole?: string } | undefined;
    if (user?.sub == null) {
      void reply.status(401).send({
        error: { code: 'Unauthorized', message: 'Authentication required', status: 401 },
      });
      return false;
    }
    if (user.systemRole === 'tecma_admin') return true;
    const membership = await app.mongoDb
      .collection('tz_user_workspaces')
      .findOne({ workspaceId, userId: user.sub });
    if (membership == null) {
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
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const ok = await ensureWorkspaceMembership(request, reply, params.workspaceId);
      if (!ok) return reply;
      const config = await connectorConfigsRepo.findOne({
        workspaceId: params.workspaceId,
        connector: 'marketing-google',
      });
      if (config == null) {
        return reply.send({
          data: [],
          paginationInfo: {
            totalDocs: 0,
            page: 1,
            perPage: 0,
            totalPages: 1,
            hasPrevPage: false,
            hasNextPage: false,
            prevPage: null,
            nextPage: null,
          },
        });
      }
      const accounts = Array.isArray((config as Record<string, unknown>).adsCustomers)
        ? ((config as Record<string, unknown>).adsCustomers as Array<Record<string, unknown>>)
        : [];
      return reply.send({
        data: accounts,
        paginationInfo: {
          totalDocs: accounts.length,
          page: 1,
          perPage: accounts.length,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
      });
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
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const ok = await ensureWorkspaceMembership(request, reply, params.workspaceId);
      if (!ok) return reply;
      const config = await connectorConfigsRepo.findOne({
        workspaceId: params.workspaceId,
        connector: 'marketing-google',
      });
      const props = Array.isArray((config as Record<string, unknown> | null)?.ga4Properties)
        ? ((config as Record<string, unknown>).ga4Properties as Array<Record<string, unknown>>)
        : [];
      return reply.send({
        data: props,
        paginationInfo: {
          totalDocs: props.length,
          page: 1,
          perPage: props.length,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
      });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/connectors/marketing-meta/ad-accounts',
    {
      preHandler: [app.authenticate],
      schema: {
        ...listSchema(
          'listConnectorMetaAdAccounts',
          'Connectors',
          'List Meta ad accounts (stub)',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string', description: 'Workspace id' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const ok = await ensureWorkspaceMembership(request, reply, params.workspaceId);
      if (!ok) return reply;
      const config = await connectorConfigsRepo.findOne({
        workspaceId: params.workspaceId,
        connector: 'marketing-meta',
      });
      const accounts = Array.isArray((config as Record<string, unknown> | null)?.adAccounts)
        ? ((config as Record<string, unknown>).adAccounts as Array<Record<string, unknown>>)
        : [];
      return reply.send({
        data: accounts,
        paginationInfo: {
          totalDocs: accounts.length,
          page: 1,
          perPage: accounts.length,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
      });
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
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const ok = await ensureWorkspaceMembership(request, reply, params.workspaceId);
      if (!ok) return reply;
      const docs = await workflowsRepo.findMany({ workspaceId: params.workspaceId });
      return reply.send({
        data: docs,
        paginationInfo: {
          totalDocs: docs.length,
          page: 1,
          perPage: docs.length,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
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
