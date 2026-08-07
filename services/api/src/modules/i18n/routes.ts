import crypto from 'node:crypto';

import {
  deepMergeI18nMessages,
  I18nGlobalBundlesRepository,
  I18nWorkspaceBundlesRepository,
} from '@followup/db';
import { isTecmaPlatformAdmin, normalizeSystemRole } from '@followup/shared-rbac';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { forbidden as forbiddenError, sendApiError } from '../../lib/apiError.js';
import {
  activeMembershipStatusFilter,
  buildUserWorkspaceMembershipFilter,
} from '../../lib/mongoIdentity.js';
import { resolveUserIdentityCandidates } from '../../lib/userIdentity.js';
import { singleObjectSchema } from '../../schemas/routeHelpers.js';
import {
  I18N_APP_NAMESPACES,
  SUPPORTED_I18N_LOCALES,
  type I18nAppNamespace,
  type SupportedI18nLocale,
} from './constants.js';

const getTraceId = (request: FastifyRequest): string | undefined =>
  typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined;

const isSupportedLocale = (value: string): value is SupportedI18nLocale =>
  (SUPPORTED_I18N_LOCALES as readonly string[]).includes(value);

const parseNamespaces = (raw: string | undefined): I18nAppNamespace[] => {
  if (raw == null || raw.trim() === '') return [...I18N_APP_NAMESPACES];
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  const out: I18nAppNamespace[] = [];
  for (const p of parts) {
    if ((I18N_APP_NAMESPACES as readonly string[]).includes(p)) {
      out.push(p as I18nAppNamespace);
    }
  }
  return out.length > 0 ? out : [...I18N_APP_NAMESPACES];
};

const hashEtag = (payload: unknown): string => {
  const json = JSON.stringify(payload);
  return crypto.createHash('sha256').update(json).digest('hex').slice(0, 32);
};

export const i18nRoutes = async (app: FastifyInstance): Promise<void> => {
  const globalRepo = new I18nGlobalBundlesRepository(app.mongoDb);
  const workspaceRepo = new I18nWorkspaceBundlesRepository(app.mongoDb);

  /**
   * Bundle i18n mergeato (globale + eventuale override workspace).
   * Richiede JWT: qualsiasi utente autenticato può leggere la copy UI (nessun `users.read` richiesto).
   */
  app.get(
    '/v1/i18n/bundle',
    {
      preHandler: [app.authenticate],
      schema: {
        ...singleObjectSchema(
          'getI18nBundle',
          'I18n',
          'Bundle messaggi i18n per lingua e namespace (globale + override workspace opzionale)',
        ),
        querystring: {
          type: 'object',
          required: ['locale'],
          properties: {
            locale: {
              type: 'string',
              description: 'Codice lingua BCP47-like supportato dall’app web',
            },
            namespaces: {
              type: 'string',
              description:
                'Elenco namespace separati da virgola (default: tutti). Valori: common, auth, workspace, projects, organization, shell, rbac, userRbac',
            },
            workspaceId: {
              type: 'string',
              description:
                'Se valorizzato, applica override da `tz_i18n_workspace_bundles` solo se l’utente ha membership attiva sul workspace',
            },
            workspaceMessagesOnly: {
              type: 'string',
              description:
                'Se `true`/`1`/`yes` e `workspaceId` è valorizzato, i messaggi per namespace sono solo quelli dell’override workspace (non merge con globale). Richiede `workspaceId`.',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const q = request.query as {
        locale?: string;
        namespaces?: string;
        workspaceId?: string;
        workspaceMessagesOnly?: string;
      };
      const locale = typeof q.locale === 'string' ? q.locale.trim() : '';
      if (!isSupportedLocale(locale)) {
        return reply.status(400).send({
          error: {
            code: 'InvalidLocale',
            message: `Unsupported locale. Allowed: ${SUPPORTED_I18N_LOCALES.join(', ')}`,
            status: 400,
          },
        });
      }

      const namespaces = parseNamespaces(q.namespaces);
      const workspaceMessagesOnly =
        q.workspaceMessagesOnly === 'true' ||
        q.workspaceMessagesOnly === '1' ||
        String(q.workspaceMessagesOnly).toLowerCase() === 'yes';
      let workspaceId =
        typeof q.workspaceId === 'string' && q.workspaceId.trim() !== ''
          ? q.workspaceId.trim()
          : undefined;

      const user = request.user as
        | { sub?: string; email?: string; systemRole?: string; system_role?: string }
        | undefined;
      if (workspaceId != null && user?.sub != null) {
        if (!isTecmaPlatformAdmin(normalizeSystemRole(user))) {
          const identityCandidates = await resolveUserIdentityCandidates(app, [
            user.sub,
            user.email,
          ]);
          const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
            ...buildUserWorkspaceMembershipFilter(workspaceId, identityCandidates),
            ...activeMembershipStatusFilter(),
          } as any);
          if (membership == null) {
            return sendApiError(
              reply,
              forbiddenError('No access to this workspace'),
              getTraceId(request),
            );
          }
        }
      } else if (workspaceId != null && user?.sub == null) {
        return sendApiError(reply, forbiddenError('Authentication required'), getTraceId(request));
      } else if (workspaceId == null) {
        workspaceId = undefined;
      }

      if (workspaceMessagesOnly && workspaceId == null) {
        return reply.status(400).send({
          error: {
            code: 'InvalidQuery',
            message: 'workspaceMessagesOnly requires workspaceId',
            status: 400,
          },
        });
      }

      const namespacesOut: Record<string, Record<string, unknown>> = {};
      const namespaceMeta: Record<string, { globalVersion?: number; workspaceVersion?: number }> =
        {};

      for (const ns of namespaces) {
        const globalDoc = await globalRepo.findNamespace(locale, ns);
        const baseMessages =
          globalDoc?.messages != null && typeof globalDoc.messages === 'object'
            ? (globalDoc.messages as Record<string, unknown>)
            : {};

        let merged: Record<string, unknown> = { ...baseMessages };
        let wsDoc: Awaited<ReturnType<typeof workspaceRepo.findNamespace>> = null;
        if (workspaceId != null) {
          wsDoc = await workspaceRepo.findNamespace(workspaceId, locale, ns);
          if (workspaceMessagesOnly) {
            merged =
              wsDoc?.messages != null && typeof wsDoc.messages === 'object'
                ? { ...(wsDoc.messages as Record<string, unknown>) }
                : {};
          } else if (wsDoc?.messages != null && typeof wsDoc.messages === 'object') {
            merged = deepMergeI18nMessages(merged, wsDoc.messages as Record<string, unknown>);
          }
        }
        namespacesOut[ns] = merged;

        const meta: { globalVersion?: number; workspaceVersion?: number } = {};
        if (globalDoc != null) {
          meta.globalVersion = typeof globalDoc.version === 'number' ? globalDoc.version : 0;
        }
        if (wsDoc != null) {
          meta.workspaceVersion = typeof wsDoc.version === 'number' ? wsDoc.version : 0;
        }
        if (globalDoc != null || wsDoc != null) {
          namespaceMeta[ns] = meta;
        }
      }

      const etag = hashEtag({
        locale,
        workspaceId: workspaceId ?? null,
        namespacesOut,
        namespaceMeta,
      });
      void reply.header('ETag', `"${etag}"`);

      return reply.send({
        data: {
          locale,
          workspaceId: workspaceId ?? null,
          etag,
          namespaces: namespacesOut,
          namespaceMeta,
        },
      });
    },
  );
};
