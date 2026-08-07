import crypto from 'node:crypto';

import { z } from 'zod';

import type { FastifyInstance } from 'fastify';

import { MongoRepository } from '@followup/db';

import {
  createdObjectSchema,
  listSchema,
  okDeletedSchema,
  singleObjectSchema,
} from '../../schemas/routeHelpers.js';
import type { MailFlowKey } from '../mail/createMailPort.js';

type EmailFlowDocument = {
  _id: string;
  flowKey: MailFlowKey;
  subject: string;
  text: string;
  html?: string;
  status: 'active' | 'deleted';
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
};

const FLOW_KEY_VALUES = [
  'workspace_invite',
  'forgot_password',
  'password_changed',
  'user_invite',
  'welcome',
  'deactivation',
] as const satisfies readonly MailFlowKey[];

const emailFlowBodySchema = z.object({
  flowKey: z.enum(FLOW_KEY_VALUES),
  subject: z.string().min(1).max(255),
  text: z.string().min(1),
  html: z.string().optional(),
});

const emailFlowPatchSchema = z.object({
  subject: z.string().min(1).max(255).optional(),
  text: z.string().min(1).optional(),
  html: z.string().optional(),
});

const activeFilter = { status: { $ne: 'deleted' } } as const;

export const adminEmailFlowRoutes = async (app: FastifyInstance): Promise<void> => {
  const emailFlowsRepo = new MongoRepository<EmailFlowDocument>(
    app.mongoDb.collection<EmailFlowDocument>('tz_email_flows'),
  );

  /**
   * GET /v1/admin/email-flows
   * List all email flow overrides (tecma_admin only).
   */
  app.get(
    '/v1/admin/email-flows',
    {
      preHandler: [app.authenticate, app.requireSystemRole('tecma_admin')],
      schema: listSchema(
        'listEmailFlows',
        'Admin',
        'Elenco template email',
        'Lista di tutti i template email personalizzati nel DB (tecma_admin only).',
      ),
    },
    async (_request, reply) => {
      const flows = await emailFlowsRepo.findMany({ ...activeFilter });
      return reply.send({
        data: flows,
        paginationInfo: {
          totalDocs: flows.length,
          page: 1,
          perPage: flows.length,
          totalPages: flows.length > 0 ? 1 : 0,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
      });
    },
  );

  /**
   * POST /v1/admin/email-flows
   * Create or replace a flow override.
   * 409 if a non-deleted override for this flowKey already exists.
   */
  app.post(
    '/v1/admin/email-flows',
    {
      preHandler: [app.authenticate, app.requireSystemRole('tecma_admin')],
      schema: {
        ...createdObjectSchema('createEmailFlow', 'Admin', 'Crea template email'),
        body: {
          type: 'object',
          required: ['flowKey', 'subject', 'text'],
          properties: {
            flowKey: { type: 'string', enum: FLOW_KEY_VALUES },
            subject: { type: 'string', minLength: 1, maxLength: 255 },
            text: { type: 'string', minLength: 1 },
            html: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const payload = emailFlowBodySchema.parse(request.body);
      const now = new Date().toISOString();

      // Uniqueness guard.
      const existing = await emailFlowsRepo.findOne({
        flowKey: payload.flowKey,
        ...activeFilter,
      });
      if (existing) {
        return reply.status(409).send({
          error: {
            code: 'DuplicateFlowKey',
            message: `Un template per flowKey '${payload.flowKey}' esiste già. Usa PATCH per aggiornarlo.`,
            status: 409,
          },
        });
      }

      const doc: EmailFlowDocument = {
        _id: crypto.randomUUID(),
        flowKey: payload.flowKey,
        subject: payload.subject,
        text: payload.text,
        ...(payload.html != null ? { html: payload.html } : {}),
        status: 'active',
        createdAt: now,
        updatedAt: now,
        createdBy: user.sub,
      };

      await emailFlowsRepo.create(doc);
      await app.auditService.authEvent({
        eventType: 'admin.email_flows.create',
        userId: user.sub,
        details: { flowKey: payload.flowKey, id: doc._id },
      });
      return reply.status(201).send({ data: doc });
    },
  );

  /**
   * GET /v1/admin/email-flows/:flowId
   */
  app.get(
    '/v1/admin/email-flows/:flowId',
    {
      preHandler: [app.authenticate, app.requireSystemRole('tecma_admin')],
      schema: {
        ...singleObjectSchema('getEmailFlow', 'Admin', 'Dettaglio template email'),
        params: {
          type: 'object',
          required: ['flowId'],
          properties: { flowId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { flowId: string };
      const flow = await emailFlowsRepo.findOne({ _id: params.flowId, ...activeFilter });
      if (!flow) {
        return reply.status(404).send({
          error: { code: 'EmailFlowNotFound', message: 'Email flow not found', status: 404 },
        });
      }
      return reply.send({ data: flow });
    },
  );

  /**
   * PATCH /v1/admin/email-flows/:flowId
   * Update subject / text / html of an existing flow override.
   */
  app.patch(
    '/v1/admin/email-flows/:flowId',
    {
      preHandler: [app.authenticate, app.requireSystemRole('tecma_admin')],
      schema: {
        ...singleObjectSchema('patchEmailFlow', 'Admin', 'Aggiorna template email'),
        params: {
          type: 'object',
          required: ['flowId'],
          properties: { flowId: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            subject: { type: 'string', minLength: 1, maxLength: 255 },
            text: { type: 'string', minLength: 1 },
            html: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { flowId: string };
      const payload = emailFlowPatchSchema.parse(request.body);
      const user = request.user as { sub: string };

      const updated = await emailFlowsRepo.updateOne(
        { _id: params.flowId, ...activeFilter },
        {
          $set: {
            ...payload,
            updatedAt: new Date().toISOString(),
            updatedBy: user.sub,
          },
        },
      );
      if (updated.matchedCount === 0) {
        return reply.status(404).send({
          error: { code: 'EmailFlowNotFound', message: 'Email flow not found', status: 404 },
        });
      }
      const flow = await emailFlowsRepo.findOne({ _id: params.flowId, ...activeFilter });
      return reply.send({ data: flow });
    },
  );

  /**
   * DELETE /v1/admin/email-flows/:flowId
   * Soft-delete a flow override (system falls back to code default).
   */
  app.delete(
    '/v1/admin/email-flows/:flowId',
    {
      preHandler: [app.authenticate, app.requireSystemRole('tecma_admin')],
      schema: {
        ...okDeletedSchema('deleteEmailFlow', 'Admin', 'Elimina template email'),
        params: {
          type: 'object',
          required: ['flowId'],
          properties: { flowId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { flowId: string };
      const user = request.user as { sub: string };
      const now = new Date().toISOString();

      const updated = await emailFlowsRepo.updateOne(
        { _id: params.flowId, ...activeFilter },
        {
          $set: { status: 'deleted', deletedAt: now, deletedBy: user.sub, updatedAt: now },
        },
      );
      if (updated.matchedCount === 0) {
        return reply.status(404).send({
          error: { code: 'EmailFlowNotFound', message: 'Email flow not found', status: 404 },
        });
      }
      await app.auditService.authEvent({
        eventType: 'admin.email_flows.delete',
        userId: user.sub,
        details: { flowId: params.flowId },
      });
      return reply.send({ data: { deleted: true } });
    },
  );
};
