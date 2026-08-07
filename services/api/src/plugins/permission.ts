import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  hasAnyPermission,
  hasPermission,
  isTecmaPlatformAdmin,
  normalizeSystemRole,
  normalizeWorkspaceRole,
  type Permission,
} from '@followup/shared-rbac';
import type { WorkspaceRole } from '@followup/shared-types';

import {
  badRequest,
  forbidden as forbiddenError,
  sendApiError,
  unauthorized,
} from '../lib/apiError.js';
import {
  activeMembershipStatusFilter,
  buildUserWorkspaceMembershipFilter,
} from '../lib/mongoIdentity.js';
import type { ProjectAccessCapability } from '../lib/projectAccess.js';
import { userHasProjectAccess } from '../lib/projectAccess.js';
import { resolveUserIdentityCandidates } from '../lib/userIdentity.js';

type JwtUser = {
  sub: string;
  permissions?: string[];
  systemRole?: string;
  system_role?: string;
  email?: string;
};

type WorkspaceRoleOptions = {
  allowTecmaAdmin?: boolean;
};

const getTraceId = (request: FastifyRequest): string | undefined =>
  typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined;

const isTecmaAdmin = (user: JwtUser | undefined): boolean =>
  user != null && isTecmaPlatformAdmin(normalizeSystemRole(user));

export const permissionPlugin = fp(async (app: FastifyInstance) => {
  app.decorate('requirePermission', (permission: Permission) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtUser | undefined;
      const permissions = user?.permissions ?? [];

      if (isTecmaAdmin(user)) return;

      if (!hasPermission(permissions, permission)) {
        return sendApiError(
          reply,
          forbiddenError('Missing required permission'),
          getTraceId(request),
        );
      }
    };
  });

  app.decorate('requireAnyPermission', (requiredPermissions: readonly Permission[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtUser | undefined;
      const permissions = user?.permissions ?? [];

      if (isTecmaAdmin(user)) return;

      if (!hasAnyPermission(permissions, requiredPermissions)) {
        return sendApiError(
          reply,
          forbiddenError('Missing required permissions'),
          getTraceId(request),
        );
      }
    };
  });

  app.decorate('requireSystemRole', (role: 'tecma_admin') => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtUser | undefined;
      if (role === 'tecma_admin' && isTecmaAdmin(user)) return;
      return sendApiError(reply, forbiddenError('Tecma admin required'), getTraceId(request));
    };
  });

  app.decorate('requireTecmaAdmin', () => app.requireSystemRole('tecma_admin'));

  app.decorate(
    'requireWorkspaceRole',
    (roles: readonly WorkspaceRole[], opts: WorkspaceRoleOptions = { allowTecmaAdmin: true }) => {
      return async (request: FastifyRequest, reply: FastifyReply) => {
        const params = request.params as { workspaceId?: string };
        const workspaceId = params.workspaceId;
        if (workspaceId == null || workspaceId.length === 0) {
          return sendApiError(reply, badRequest('workspaceId is required'), getTraceId(request));
        }

        const user = request.user as JwtUser | undefined;
        if (user?.sub == null) {
          return sendApiError(reply, unauthorized(), getTraceId(request));
        }

        if ((opts.allowTecmaAdmin ?? true) && isTecmaAdmin(user)) return;

        const identityCandidates = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
        const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
          ...buildUserWorkspaceMembershipFilter(workspaceId, identityCandidates),
          ...activeMembershipStatusFilter(),
        } as any);

        const role = normalizeWorkspaceRole(
          String((membership as { role?: unknown } | null)?.role ?? ''),
        );
        if (membership == null || role == null || !roles.includes(role as WorkspaceRole)) {
          return sendApiError(
            reply,
            forbiddenError('Workspace role required'),
            getTraceId(request),
          );
        }
      };
    },
  );

  app.decorate('requireCanAccessWorkspace', () =>
    app.requireWorkspaceRole(['owner', 'admin', 'collaborator', 'viewer'], {
      allowTecmaAdmin: true,
    }),
  );

  app.decorate('requireWorkspaceAdminOrOwner', () =>
    app.requireWorkspaceRole(['owner', 'admin'], { allowTecmaAdmin: true }),
  );

  app.decorate('requireCanAccessProject', (capability: ProjectAccessCapability = 'read') => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { projectId?: string };
      const projectId = params.projectId;
      if (projectId == null || projectId.length === 0) {
        return sendApiError(reply, badRequest('projectId is required'), getTraceId(request));
      }

      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) {
        return sendApiError(reply, unauthorized(), getTraceId(request));
      }

      const allowed = await userHasProjectAccess(app, user, projectId, capability);
      if (!allowed) {
        return sendApiError(
          reply,
          forbiddenError('No access to this project'),
          getTraceId(request),
        );
      }
    };
  });

  app.decorate('requireProjectRole', (capability: ProjectAccessCapability = 'read') =>
    app.requireCanAccessProject(capability),
  );
});
