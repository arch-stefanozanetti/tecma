import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import {
  hasAnyPermission,
  hasPermission,
  isTecmaPlatformAdmin,
  type Permission,
} from '@followup/shared-rbac';

import {
  buildUserWorkspaceMembershipFilter,
  expandForStringOrObjectIdIn,
} from '../lib/mongoIdentity.js';
import { resolveUserIdentityCandidates } from '../lib/userIdentity.js';

type JwtUser = {
  sub: string;
  permissions?: string[];
  systemRole?: string;
  email?: string;
};

const forbidden = (reply: FastifyReply) =>
  reply.status(403).send({
    error: { code: 'Forbidden', message: 'Missing required permission', status: 403 },
  });

const forbiddenAny = (reply: FastifyReply) =>
  reply.status(403).send({
    error: { code: 'Forbidden', message: 'Missing required permissions', status: 403 },
  });

const forbiddenTecmaAdmin = (reply: FastifyReply) =>
  reply.status(403).send({
    error: { code: 'Forbidden', message: 'Tecma admin required', status: 403 },
  });

const isTecmaAdmin = (user: JwtUser | undefined): boolean => isTecmaPlatformAdmin(user?.systemRole);

export const permissionPlugin = fp(async (app: FastifyInstance) => {
  app.decorate('requirePermission', (permission: Permission) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtUser | undefined;
      const permissions = user?.permissions ?? [];

      if (isTecmaAdmin(user)) return;

      if (!hasPermission(permissions, permission)) {
        return forbidden(reply);
      }
    };
  });

  app.decorate('requireAnyPermission', (requiredPermissions: readonly Permission[]) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtUser | undefined;
      const permissions = user?.permissions ?? [];

      if (isTecmaAdmin(user)) return;

      if (!hasAnyPermission(permissions, requiredPermissions)) {
        return forbiddenAny(reply);
      }
    };
  });

  app.decorate('requireTecmaAdmin', () => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = request.user as JwtUser | undefined;
      if (isTecmaAdmin(user)) return;
      return forbiddenTecmaAdmin(reply);
    };
  });

  app.decorate('requireCanAccessWorkspace', () => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { workspaceId?: string };
      const workspaceId = params.workspaceId;
      if (workspaceId == null || workspaceId.length === 0) {
        return reply.status(400).send({
          error: { code: 'BadRequest', message: 'workspaceId is required', status: 400 },
        });
      }

      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) {
        return reply.status(401).send({
          error: { code: 'Unauthorized', message: 'Not authenticated', status: 401 },
        });
      }

      if (isTecmaAdmin(user)) return;

      const identityCandidates = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
      const membership = await app.mongoDb
        .collection('tz_user_workspaces')
        .findOne(buildUserWorkspaceMembershipFilter(workspaceId, identityCandidates) as any);

      if (membership == null) {
        return reply.status(403).send({
          error: { code: 'Forbidden', message: 'No access to this workspace', status: 403 },
        });
      }
    };
  });

  app.decorate('requireWorkspaceAdminOrOwner', () => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { workspaceId?: string };
      const workspaceId = params.workspaceId;
      if (workspaceId == null || workspaceId.length === 0) {
        return reply.status(400).send({
          error: { code: 'BadRequest', message: 'workspaceId is required', status: 400 },
        });
      }

      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) {
        return reply.status(401).send({
          error: { code: 'Unauthorized', message: 'Not authenticated', status: 401 },
        });
      }

      if (isTecmaAdmin(user)) return;

      const identityCandidates = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
      const membership = await app.mongoDb
        .collection('tz_user_workspaces')
        .findOne(buildUserWorkspaceMembershipFilter(workspaceId, identityCandidates) as any);

      if (membership == null || !['owner', 'admin'].includes(String((membership as any).role ?? ''))) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Workspace admin/owner role required',
            status: 403,
          },
        });
      }
    };
  });

  app.decorate('requireCanAccessProject', () => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { projectId?: string };
      const projectId = params.projectId;
      if (projectId == null || projectId.length === 0) {
        return reply.status(400).send({
          error: { code: 'BadRequest', message: 'projectId is required', status: 400 },
        });
      }

      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) {
        return reply.status(401).send({
          error: { code: 'Unauthorized', message: 'Not authenticated', status: 401 },
        });
      }

      if (isTecmaAdmin(user)) return;

      const identityCandidates = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
      const userIdIn = expandForStringOrObjectIdIn(identityCandidates);
      const assignment = await app.mongoDb.collection('tz_workspace_user_projects').findOne({
        projectId,
        userId: { $in: userIdIn },
      } as any);

      if (assignment == null) {
        return reply.status(403).send({
          error: { code: 'Forbidden', message: 'No access to this project', status: 403 },
        });
      }
    };
  });
});
