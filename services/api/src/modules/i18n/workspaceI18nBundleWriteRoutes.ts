import type { FastifyInstance } from 'fastify';

import { deepMergeI18nMessages, I18nWorkspaceBundlesRepository } from '@followup/db';

import { i18nBundleWriteRateLimit } from '../../lib/rateLimitProfiles.js';
import { withAudit } from '../audit/withAudit.js';
import {
  i18nBundlePatchBodySchema,
  i18nBundleUpsertBodySchema,
  I18N_MESSAGES_JSON_MAX_BYTES,
  messagesJsonByteLength,
  parseLocaleParam,
  parseNamespaceParam,
} from './bundleWriteShared.js';
import { i18nAuditPayloadFromBody } from './i18nAuditPayload.js';

const err = { $ref: 'ErrorResponse#' };

export const workspaceI18nBundleWriteRoutes = async (app: FastifyInstance): Promise<void> => {
  const workspaceRepo = new I18nWorkspaceBundlesRepository(app.mongoDb);

  const paramsSchema = {
    type: 'object',
    required: ['workspaceId', 'locale', 'namespace'],
    properties: {
      workspaceId: {
        type: 'string',
        description: 'Identificativo workspace',
      },
      locale: {
        type: 'string',
        description: 'Codice lingua supportato (it, ar, en, en-GB)',
      },
      namespace: {
        type: 'string',
        description: 'Namespace applicativo (common, auth, workspace, …)',
      },
    },
  };

  const bundleBodySchema = {
    type: 'object',
    required: ['messages'],
    additionalProperties: false,
    properties: {
      messages: {
        type: 'object',
        additionalProperties: true,
        description: 'Albero messaggi i18n per il namespace',
      },
      version: {
        type: 'integer',
        minimum: 0,
        description:
          'Opzionale: optimistic concurrency — deve coincidere con la versione corrente in DB per questo workspace',
      },
    },
  };

  const bundlePatchBodySchema = {
    type: 'object',
    required: ['patch'],
    additionalProperties: false,
    properties: {
      patch: {
        type: 'object',
        additionalProperties: true,
        description: 'Sotto-albero da unire in profondità ai messages già persistiti',
      },
      version: {
        type: 'integer',
        minimum: 0,
        description:
          'Opzionale: optimistic concurrency — deve coincidere con la versione corrente in DB per questo workspace',
      },
    },
  };

  const writeSuccessResponse = {
    200: {
      type: 'object',
      additionalProperties: false,
      required: ['data'],
      properties: {
        data: {
          type: 'object',
          additionalProperties: true,
          required: ['workspaceId', 'locale', 'namespace', 'version'],
          properties: {
            workspaceId: { type: 'string' },
            locale: { type: 'string' },
            namespace: { type: 'string' },
            version: { type: 'integer' },
          },
        },
      },
    },
  };

  app.put(
    '/v1/workspaces/:workspaceId/i18n/bundles/:locale/:namespace',
    {
      config: { rateLimit: i18nBundleWriteRateLimit(app.config) },
      preHandler: [
        app.authenticate,
        app.requireWorkspaceAdminOrOwner(),
        withAudit('i18n.bundle.workspace.upsert', async (request) => {
          const p = request.params as { workspaceId?: string; locale?: string; namespace?: string };
          return {
            workspaceId: p.workspaceId,
            severity: 'info' as const,
            details: {
              scope: 'workspace',
              workspaceId: p.workspaceId,
              locale: p.locale,
              namespace: p.namespace,
              ...i18nAuditPayloadFromBody(request.body),
            },
          };
        }),
      ],
      schema: {
        tags: ['Workspaces'],
        summary: 'Upsert bundle i18n override workspace',
        description:
          'Solo owner o admin del workspace. Scrive su `tz_i18n_workspace_bundles` (upsert per workspaceId+locale+namespace).',
        operationId: 'putWorkspaceI18nBundle',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: paramsSchema,
        body: bundleBodySchema,
        response: {
          ...writeSuccessResponse,
          400: err,
          401: err,
          403: err,
          409: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as {
        workspaceId?: string;
        locale?: string;
        namespace?: string;
      };
      const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : '';
      const locale = parseLocaleParam(params.locale);
      const namespace = parseNamespaceParam(params.namespace);
      if (workspaceId === '' || locale == null || namespace == null) {
        return reply.status(400).send({
          error: {
            code: 'InvalidI18nParams',
            message: 'Invalid workspaceId, locale or namespace',
            status: 400,
          },
        });
      }

      const parsed = i18nBundleUpsertBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'ValidationError',
            message: 'Invalid payload',
            status: 400,
            details: parsed.error.errors.map((e) => ({
              field: e.path.join('.') || 'body',
              messageDetail: [e.message],
            })),
          },
        });
      }

      const { messages, version: clientVersion } = parsed.data;
      const bytes = messagesJsonByteLength(messages as Record<string, unknown>);
      if (bytes > I18N_MESSAGES_JSON_MAX_BYTES) {
        return reply.status(400).send({
          error: {
            code: 'PayloadTooLarge',
            message: `messages JSON exceeds ${I18N_MESSAGES_JSON_MAX_BYTES} bytes`,
            status: 400,
          },
        });
      }

      const existing = await workspaceRepo.findNamespace(workspaceId, locale, namespace);
      if (clientVersion != null) {
        const current = existing?.version ?? 0;
        if (current !== clientVersion) {
          return reply.status(409).send({
            error: {
              code: 'I18nVersionConflict',
              message: 'Version mismatch',
              status: 409,
              details: [{ field: 'version', messageDetail: [`expected ${String(current)}`] }],
            },
          });
        }
      }

      const nextVersion = (existing?.version ?? 0) + 1;
      await workspaceRepo.upsertNamespace(
        workspaceId,
        locale,
        namespace,
        messages as Record<string, unknown>,
        nextVersion,
      );

      return reply.send({
        data: { workspaceId, locale, namespace, version: nextVersion },
      });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId/i18n/bundles/:locale/:namespace',
    {
      config: { rateLimit: i18nBundleWriteRateLimit(app.config) },
      preHandler: [
        app.authenticate,
        app.requireWorkspaceAdminOrOwner(),
        withAudit('i18n.bundle.workspace.patch', async (request) => {
          const p = request.params as { workspaceId?: string; locale?: string; namespace?: string };
          return {
            workspaceId: p.workspaceId,
            severity: 'info' as const,
            details: {
              scope: 'workspace',
              workspaceId: p.workspaceId,
              locale: p.locale,
              namespace: p.namespace,
              ...i18nAuditPayloadFromBody(request.body),
            },
          };
        }),
      ],
      schema: {
        tags: ['Workspaces'],
        summary: 'Patch merge parziale bundle i18n workspace',
        description:
          'Solo owner o admin del workspace. Unisce in profondità `patch` sui `messages` esistenti per l’override.',
        operationId: 'patchWorkspaceI18nBundle',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: paramsSchema,
        body: bundlePatchBodySchema,
        response: {
          ...writeSuccessResponse,
          400: err,
          401: err,
          403: err,
          409: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as {
        workspaceId?: string;
        locale?: string;
        namespace?: string;
      };
      const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : '';
      const locale = parseLocaleParam(params.locale);
      const namespace = parseNamespaceParam(params.namespace);
      if (workspaceId === '' || locale == null || namespace == null) {
        return reply.status(400).send({
          error: {
            code: 'InvalidI18nParams',
            message: 'Invalid workspaceId, locale or namespace',
            status: 400,
          },
        });
      }

      const parsed = i18nBundlePatchBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          error: {
            code: 'ValidationError',
            message: 'Invalid payload',
            status: 400,
            details: parsed.error.errors.map((e) => ({
              field: e.path.join('.') || 'body',
              messageDetail: [e.message],
            })),
          },
        });
      }

      const { patch, version: clientVersion } = parsed.data;
      const existing = await workspaceRepo.findNamespace(workspaceId, locale, namespace);
      const baseMessages = (existing?.messages ?? {}) as Record<string, unknown>;
      const merged = deepMergeI18nMessages(baseMessages, patch as Record<string, unknown>);
      const bytes = messagesJsonByteLength(merged);
      if (bytes > I18N_MESSAGES_JSON_MAX_BYTES) {
        return reply.status(400).send({
          error: {
            code: 'PayloadTooLarge',
            message: `merged messages JSON exceeds ${I18N_MESSAGES_JSON_MAX_BYTES} bytes`,
            status: 400,
          },
        });
      }

      if (clientVersion != null) {
        const current = existing?.version ?? 0;
        if (current !== clientVersion) {
          return reply.status(409).send({
            error: {
              code: 'I18nVersionConflict',
              message: 'Version mismatch',
              status: 409,
              details: [{ field: 'version', messageDetail: [`expected ${String(current)}`] }],
            },
          });
        }
      }

      const nextVersion = (existing?.version ?? 0) + 1;
      await workspaceRepo.upsertNamespace(workspaceId, locale, namespace, merged, nextVersion);

      return reply.send({
        data: { workspaceId, locale, namespace, version: nextVersion },
      });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/i18n/bundles/:locale/:namespace',
    {
      config: { rateLimit: i18nBundleWriteRateLimit(app.config) },
      preHandler: [
        app.authenticate,
        app.requireWorkspaceAdminOrOwner(),
        withAudit('i18n.bundle.workspace.delete', async (request) => {
          const p = request.params as { workspaceId?: string; locale?: string; namespace?: string };
          return {
            workspaceId: p.workspaceId,
            severity: 'info' as const,
            details: {
              scope: 'workspace',
              workspaceId: p.workspaceId,
              locale: p.locale,
              namespace: p.namespace,
            },
          };
        }),
      ],
      schema: {
        tags: ['Workspaces'],
        summary: 'Elimina override i18n workspace',
        description:
          'Solo owner o admin del workspace. Rimuove il documento da `tz_i18n_workspace_bundles`.',
        operationId: 'deleteWorkspaceI18nBundle',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: paramsSchema,
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['data'],
            properties: {
              data: {
                type: 'object',
                additionalProperties: true,
                required: ['deleted'],
                properties: {
                  deleted: { type: 'boolean', const: true },
                },
              },
            },
          },
          400: err,
          401: err,
          403: err,
          404: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as {
        workspaceId?: string;
        locale?: string;
        namespace?: string;
      };
      const workspaceId = typeof params.workspaceId === 'string' ? params.workspaceId.trim() : '';
      const locale = parseLocaleParam(params.locale);
      const namespace = parseNamespaceParam(params.namespace);
      if (workspaceId === '' || locale == null || namespace == null) {
        return reply.status(400).send({
          error: {
            code: 'InvalidI18nParams',
            message: 'Invalid workspaceId, locale or namespace',
            status: 400,
          },
        });
      }

      const deletedCount = await workspaceRepo.deleteNamespace(workspaceId, locale, namespace);
      if (deletedCount === 0) {
        return reply.status(404).send({
          error: {
            code: 'I18nBundleNotFound',
            message: 'Bundle not found',
            status: 404,
          },
        });
      }
      return reply.send({ data: { deleted: true as const } });
    },
  );
};
