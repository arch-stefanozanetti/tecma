import type { FastifyInstance } from 'fastify';

import { deepMergeI18nMessages, I18nGlobalBundlesRepository } from '@followup/db';

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

export const adminI18nBundleWriteRoutes = async (app: FastifyInstance): Promise<void> => {
  const globalRepo = new I18nGlobalBundlesRepository(app.mongoDb);

  const bundleParamsSchema = {
    type: 'object',
    required: ['locale', 'namespace'],
    properties: {
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
          'Opzionale: optimistic concurrency — deve coincidere con la versione corrente in DB',
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
          'Opzionale: optimistic concurrency — deve coincidere con la versione corrente in DB',
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
          required: ['locale', 'namespace', 'version'],
          properties: {
            locale: { type: 'string' },
            namespace: { type: 'string' },
            version: { type: 'integer' },
          },
        },
      },
    },
  };

  app.put(
    '/v1/admin/i18n/bundles/:locale/:namespace',
    {
      config: { rateLimit: i18nBundleWriteRateLimit(app.config) },
      preHandler: [
        app.authenticate,
        app.requireSystemRole('tecma_admin'),
        withAudit('i18n.bundle.global.upsert', async (request) => {
          const p = request.params as { locale?: string; namespace?: string };
          const locale = parseLocaleParam(p.locale);
          const namespace = parseNamespaceParam(p.namespace);
          return {
            severity: 'info' as const,
            details: {
              scope: 'global',
              locale: locale ?? p.locale,
              namespace: namespace ?? p.namespace,
              ...i18nAuditPayloadFromBody(request.body),
            },
          };
        }),
      ],
      schema: {
        tags: ['Admin'],
        summary: 'Upsert bundle i18n globale',
        description:
          'Solo Tecma platform admin. Scrive su `tz_i18n_global_bundles` (upsert per locale+namespace).',
        operationId: 'putAdminI18nBundle',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: bundleParamsSchema,
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
      const params = request.params as { locale?: string; namespace?: string };
      const locale = parseLocaleParam(params.locale);
      const namespace = parseNamespaceParam(params.namespace);
      if (locale == null || namespace == null) {
        return reply.status(400).send({
          error: {
            code: 'InvalidI18nParams',
            message: 'Invalid locale or namespace',
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

      const existing = await globalRepo.findNamespace(locale, namespace);
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
      await globalRepo.upsertNamespace(
        locale,
        namespace,
        messages as Record<string, unknown>,
        nextVersion,
      );

      return reply.send({
        data: { locale, namespace, version: nextVersion },
      });
    },
  );

  app.patch(
    '/v1/admin/i18n/bundles/:locale/:namespace',
    {
      config: { rateLimit: i18nBundleWriteRateLimit(app.config) },
      preHandler: [
        app.authenticate,
        app.requireSystemRole('tecma_admin'),
        withAudit('i18n.bundle.global.patch', async (request) => {
          const p = request.params as { locale?: string; namespace?: string };
          const locale = parseLocaleParam(p.locale);
          const namespace = parseNamespaceParam(p.namespace);
          return {
            severity: 'info' as const,
            details: {
              scope: 'global',
              locale: locale ?? p.locale,
              namespace: namespace ?? p.namespace,
              ...i18nAuditPayloadFromBody(request.body),
            },
          };
        }),
      ],
      schema: {
        tags: ['Admin'],
        summary: 'Patch merge parziale bundle i18n globale',
        description:
          'Solo Tecma platform admin. Unisce in profondità `patch` sui `messages` esistenti (`deepMergeI18nMessages`).',
        operationId: 'patchAdminI18nBundle',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: bundleParamsSchema,
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
      const params = request.params as { locale?: string; namespace?: string };
      const locale = parseLocaleParam(params.locale);
      const namespace = parseNamespaceParam(params.namespace);
      if (locale == null || namespace == null) {
        return reply.status(400).send({
          error: {
            code: 'InvalidI18nParams',
            message: 'Invalid locale or namespace',
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
      const existing = await globalRepo.findNamespace(locale, namespace);
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
      await globalRepo.upsertNamespace(locale, namespace, merged, nextVersion);

      return reply.send({
        data: { locale, namespace, version: nextVersion },
      });
    },
  );

  app.delete(
    '/v1/admin/i18n/bundles/:locale/:namespace',
    {
      config: { rateLimit: i18nBundleWriteRateLimit(app.config) },
      preHandler: [
        app.authenticate,
        app.requireSystemRole('tecma_admin'),
        withAudit('i18n.bundle.global.delete', async (request) => {
          const p = request.params as { locale?: string; namespace?: string };
          const locale = parseLocaleParam(p.locale);
          const namespace = parseNamespaceParam(p.namespace);
          return {
            severity: 'info' as const,
            details: {
              scope: 'global',
              locale: locale ?? p.locale,
              namespace: namespace ?? p.namespace,
            },
          };
        }),
      ],
      schema: {
        tags: ['Admin'],
        summary: 'Elimina bundle i18n globale',
        description: 'Solo Tecma platform admin. Rimuove il documento da `tz_i18n_global_bundles`.',
        operationId: 'deleteAdminI18nBundle',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: bundleParamsSchema,
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
      const params = request.params as { locale?: string; namespace?: string };
      const locale = parseLocaleParam(params.locale);
      const namespace = parseNamespaceParam(params.namespace);
      if (locale == null || namespace == null) {
        return reply.status(400).send({
          error: {
            code: 'InvalidI18nParams',
            message: 'Invalid locale or namespace',
            status: 400,
          },
        });
      }

      const deletedCount = await globalRepo.deleteNamespace(locale, namespace);
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
