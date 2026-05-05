import type { FastifyInstance } from 'fastify';

import { RoleDefinitionsRepository } from '@followup/db';
import {
  ALL_PERMISSION_IDS,
  buildPermissionCatalog,
  getPermissionsForRole,
  PERMISSION_WILDCARD,
} from '@followup/shared-rbac';

import { listSchema, singleObjectSchema } from '../../schemas/routeHelpers.js';

const WORKSPACE_ROLES = [
  { roleKey: 'owner', label: 'Owner', description: 'Proprietario del workspace, accesso totale' },
  { roleKey: 'admin', label: 'Admin', description: 'Gestione utenti, progetti e configurazioni' },
  {
    roleKey: 'collaborator',
    label: 'Collaboratore',
    description: 'Operativo su progetti, clienti, calendario',
  },
  {
    roleKey: 'viewer',
    label: 'Viewer',
    description: 'Sola lettura su workspace e progetti assegnati',
  },
];

export const rbacRoutes = async (app: FastifyInstance): Promise<void> => {
  const roleDefinitions = new RoleDefinitionsRepository(app.mongoDb);

  /** Catalogo permessi raggruppato per modulo (label/azione localizzabili). */
  app.get(
    '/v1/rbac/permission-catalog',
    {
      preHandler: [app.authenticate, app.requirePermission('users.read')],
      schema: {
        ...singleObjectSchema(
          'getPermissionCatalog',
          'Rbac',
          'Catalogo permessi (gruppi modulo + azione)',
        ),
      },
    },
    async (_request, reply) => {
      const catalog = buildPermissionCatalog();
      return reply.send({
        data: {
          groups: catalog.groups.map((group) => ({
            module: group.module,
            label: group.label,
            permissions: group.permissions.map((entry) => ({
              id: entry.id,
              label: entry.label,
              module: entry.module,
              action: entry.action,
              actionLabel: entry.actionLabel,
            })),
          })),
        },
      });
    },
  );

  /** Permessi effettivi per un ruolo workspace (`builtin` + override DB). */
  app.get(
    '/v1/rbac/roles/:roleKey/effective-permissions',
    {
      preHandler: [app.authenticate, app.requirePermission('users.read')],
      schema: {
        ...singleObjectSchema(
          'getRoleEffectivePermissions',
          'Rbac',
          'Permessi effettivi di un ruolo (preview wizard utenti)',
        ),
        params: {
          type: 'object',
          required: ['roleKey'],
          properties: {
            roleKey: {
              type: 'string',
              description: 'Chiave ruolo workspace (owner, admin, collaborator, viewer, custom)',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { roleKey: string };
      const roleKey = decodeURIComponent(params.roleKey ?? '').trim();
      if (roleKey === '') {
        return reply.status(400).send({
          error: { code: 'InvalidRoleKey', message: 'roleKey is required', status: 400 },
        });
      }
      const customDefinitions = await roleDefinitions.loadDefinitions();
      const permissions = getPermissionsForRole(roleKey, customDefinitions);
      const normalized = permissions.includes(PERMISSION_WILDCARD)
        ? [PERMISSION_WILDCARD]
        : ALL_PERMISSION_IDS.filter((id) => permissions.includes(id));
      return reply.send({
        data: {
          roleKey: roleKey.toLowerCase(),
          permissions: [...normalized],
        },
      });
    },
  );

  /** Elenco ruoli workspace builtin con label/descrizione (per UI dropdown). */
  app.get(
    '/v1/workspace-roles',
    {
      preHandler: [app.authenticate, app.requirePermission('users.read')],
      schema: {
        ...listSchema('listWorkspaceRoles', 'Rbac', 'Elenco ruoli workspace builtin'),
      },
    },
    async (_request, reply) => {
      const data = WORKSPACE_ROLES.map((role) => ({ ...role }));
      return reply.send({
        data,
        paginationInfo: {
          totalDocs: data.length,
          page: 1,
          perPage: data.length,
          totalPages: 1,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
      });
    },
  );
};
