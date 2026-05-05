import crypto from 'node:crypto';

import { z } from 'zod';

import { MongoRepository } from '@followup/db';
import { isTecmaPlatformAdmin, normalizeSystemRole } from '@followup/shared-rbac';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { buildUserWorkspaceMembershipFilter } from '../../lib/mongoIdentity.js';
import { listAccessibleProjectIdsForUser } from '../../lib/projectAccess.js';
import { isSelfIdentity, resolveUserIdentityCandidates } from '../../lib/userIdentity.js';
import { singlePagePaginationInfo } from '../../lib/pagination.js';
import { fetchProjectsForWorkspaceScopedList } from './fetchProjectsForWorkspaceScopedList.js';
import {
  createdObjectSchema,
  listSchema,
  okDeletedSchema,
  singleObjectSchema,
} from '../../schemas/routeHelpers.js';

const createProjectSchema = z.object({
  workspaceId: z.string().min(1),
  name: z.string().min(2),
  code: z.string().min(2),
});

const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(2).optional(),
  // Identity (POC-plus)
  displayName: z.string().min(1).max(255).optional(),
  mode: z.enum(['rent', 'sell']).optional(),
  defaultLang: z.string().min(2).max(10).optional(),
  hostKey: z.string().min(1).max(120).optional(),
  assetKey: z.string().min(1).max(120).optional(),
  feVendorKey: z.string().min(1).max(120).optional(),
  automaticQuoteEnabled: z.boolean().optional(),
  accountManagerEnabled: z.boolean().optional(),
  hasDAS: z.boolean().optional(),
  // Contacts (POC-plus)
  contactEmail: z.string().email().or(z.literal('')).optional(),
  contactPhone: z.string().min(1).max(64).or(z.literal('')).optional(),
  projectUrl: z.string().url().or(z.literal('')).optional(),
  customDomain: z.string().min(1).max(255).or(z.literal('')).optional(),
  city: z.string().min(1).max(255).or(z.literal('')).optional(),
  payoff: z.string().max(500).or(z.literal('')).optional(),
});

const accessGrantSchema = z.object({
  workspaceId: z.string().min(1),
  role: z.enum(['owner', 'collaborator', 'viewer']),
});

const projectsByEmailBodySchema = z.object({
  email: z.string().email().optional(),
  workspaceId: z.string().min(1).optional(),
});

type JwtUser = {
  sub: string;
  email: string;
  systemRole?: string;
  system_role?: string;
  permissions?: string[];
};

const getJwtUser = (request: FastifyRequest): JwtUser => request.user as JwtUser;

export const projectsRoutes = async (app: FastifyInstance): Promise<void> => {
  const projectsRepo = new MongoRepository<any>(app.mongoDb.collection('tz_projects'));
  const workspaceProjectsRepo = new MongoRepository<any>(
    app.mongoDb.collection('tz_workspace_projects'),
  );
  const workspaceUserProjectsRepo = new MongoRepository<any>(
    app.mongoDb.collection('tz_workspace_user_projects'),
  );
  const projectAccessRepo = new MongoRepository<any>(app.mongoDb.collection('tz_project_access'));

  app.get(
    '/v1/projects',
    {
      preHandler: [app.authenticate, app.requirePermission('projects.read')],
      schema: {
        ...listSchema(
          'listProjects',
          'Projects',
          'Elenco progetti',
          'Senza `workspaceId`: Tecma SuperAdmin vede tutti i progetti; gli altri utenti solo progetti accessibili (assegnazioni, membership workspace, grant `tz_project_access`). Con `workspaceId` richiede membership nel workspace (salvo Tecma); elenco include assegnazioni, fallback progetti del workspace e progetti concessi in grant verso quel workspace. `userId` consente a Tecma SuperAdmin di filtrare per un altro utente.',
        ),
        querystring: {
          type: 'object',
          properties: {
            workspaceId: {
              type: 'string',
              description:
                'Workspace per cui elencare i progetti visibili all’utente o all’utente indicato da admin.',
            },
            userId: {
              type: 'string',
              description:
                'Solo Tecma SuperAdmin; ObjectId o email dell’utente di cui elencare i progetti nel workspace.',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as { workspaceId?: string; userId?: string };
      const user = getJwtUser(request);

      if (query.workspaceId) {
        const requestedUserId = query.userId?.trim();
        const isAdmin = isTecmaPlatformAdmin(normalizeSystemRole(user));

        if (!isAdmin && requestedUserId != null && !isSelfIdentity(user, requestedUserId)) {
          return reply.status(403).send({
            error: {
              code: 'Forbidden',
              message: 'Cannot list projects for another user',
              status: 403,
            },
          });
        }

        const identityList = await resolveUserIdentityCandidates(
          app,
          isAdmin && requestedUserId != null && requestedUserId !== ''
            ? [requestedUserId]
            : [user.sub, user.email, requestedUserId],
        );

        if (!isAdmin) {
          const membership = await app.mongoDb
            .collection('tz_user_workspaces')
            .findOne(buildUserWorkspaceMembershipFilter(query.workspaceId, identityList) as any);
          if (membership == null) {
            return reply.status(403).send({
              error: {
                code: 'Forbidden',
                message: 'No access to this workspace',
                status: 403,
              },
            });
          }
        }

        const data = await fetchProjectsForWorkspaceScopedList(
          {
            app,
            workspaceUserProjectsRepo,
            workspaceProjectsRepo,
            projectsRepo,
          },
          {
            workspaceId: query.workspaceId,
            identityList,
            isTecmaAdmin: isAdmin,
          },
        );
        return reply.send({ data, paginationInfo: singlePagePaginationInfo(data.length) });
      }

      if (isTecmaPlatformAdmin(normalizeSystemRole(user))) {
        const data = await projectsRepo.findMany({});
        return reply.send({ data, paginationInfo: singlePagePaginationInfo(data.length) });
      }

      const identityList = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
      const ids = await listAccessibleProjectIdsForUser(app, identityList);
      if (ids.length === 0) {
        return reply.send({ data: [], paginationInfo: singlePagePaginationInfo(0) });
      }
      const data = await projectsRepo.findMany({ _id: { $in: ids } as any });
      return reply.send({ data, paginationInfo: singlePagePaginationInfo(data.length) });
    },
  );

  app.post(
    '/v1/projects',
    {
      preHandler: [app.authenticate, app.requirePermission('projects.read')],
      schema: {
        ...createdObjectSchema('createProject', 'Projects', 'Crea progetto'),
        body: {
          type: 'object',
          required: ['workspaceId', 'name', 'code'],
          properties: {
            workspaceId: { type: 'string' },
            name: { type: 'string', minLength: 2 },
            code: { type: 'string', minLength: 2 },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = createProjectSchema.parse(request.body);
      const user = getJwtUser(request);

      if (!isTecmaPlatformAdmin(normalizeSystemRole(user))) {
        const identities = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
        const membership = await app.mongoDb
          .collection('tz_user_workspaces')
          .findOne(buildUserWorkspaceMembershipFilter(payload.workspaceId, identities) as any);
        if (
          membership == null ||
          !['owner', 'admin'].includes(String((membership as { role?: string }).role ?? ''))
        ) {
          return reply.status(403).send({
            error: {
              code: 'Forbidden',
              message: 'Workspace owner or admin role required to create projects',
              status: 403,
            },
          });
        }
      }

      const now = new Date().toISOString();

      const doc = {
        _id: crypto.randomUUID(),
        workspaceId: payload.workspaceId,
        name: payload.name,
        code: payload.code,
        createdAt: now,
        updatedAt: now,
      };

      await projectsRepo.create(doc);
      await workspaceProjectsRepo.create({
        _id: crypto.randomUUID(),
        workspaceId: payload.workspaceId,
        projectId: doc._id,
        createdAt: now,
      });

      if (isTecmaPlatformAdmin(normalizeSystemRole(user))) {
        await app.auditService.authEvent({
          eventType: 'projects.create.tecma_admin',
          userId: user.sub,
          details: { workspaceId: payload.workspaceId, projectId: doc._id },
        });
      }

      return reply.status(201).send({ data: doc });
    },
  );

  app.get(
    '/v1/projects/:projectId',
    {
      preHandler: [app.authenticate, app.requireCanAccessProject('read')],
      schema: {
        ...singleObjectSchema('getProjectById', 'Projects', 'Dettaglio progetto'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const project = await projectsRepo.findOne({ _id: params.projectId });
      if (!project) {
        return reply
          .status(404)
          .send({ error: { code: 'ProjectNotFound', message: 'Project not found', status: 404 } });
      }
      return reply.send({ data: project });
    },
  );

  app.patch(
    '/v1/projects/:projectId',
    {
      preHandler: [app.authenticate, app.requireCanAccessProject('write')],
      schema: {
        ...singleObjectSchema('patchProject', 'Projects', 'Aggiorna progetto'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const payload = updateProjectSchema.parse(request.body);
      const user = getJwtUser(request);
      await projectsRepo.updateOne(
        { _id: params.projectId },
        { $set: { ...payload, updatedAt: new Date().toISOString() } },
      );
      if (isTecmaPlatformAdmin(normalizeSystemRole(user))) {
        await app.auditService.authEvent({
          eventType: 'projects.update.tecma_admin',
          userId: user.sub,
          details: { projectId: params.projectId, patch: payload },
        });
      }
      const project = await projectsRepo.findOne({ _id: params.projectId });
      return reply.send({ data: project });
    },
  );

  app.delete(
    '/v1/projects/:projectId',
    {
      preHandler: [app.authenticate, app.requireCanAccessProject('admin')],
      schema: {
        ...okDeletedSchema('deleteProject', 'Projects', 'Elimina progetto'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const user = getJwtUser(request);
      await projectsRepo.deleteOne({ _id: params.projectId });
      await workspaceProjectsRepo.deleteOne({ projectId: params.projectId });
      await workspaceUserProjectsRepo.deleteOne({ projectId: params.projectId });
      if (isTecmaPlatformAdmin(normalizeSystemRole(user))) {
        await app.auditService.authEvent({
          eventType: 'projects.delete.tecma_admin',
          userId: user.sub,
          details: { projectId: params.projectId },
        });
      }
      return reply.send({ data: { deleted: true } });
    },
  );

  app.get(
    '/v1/projects/:projectId/access',
    {
      preHandler: [app.authenticate, app.requireCanAccessProject('read')],
      schema: {
        ...listSchema('listProjectAccessGrants', 'Projects', 'Grant access progetto'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const grants = await projectAccessRepo.findMany({ project_id: params.projectId });
      return reply.send({
        data: grants,
        paginationInfo: singlePagePaginationInfo(grants.length),
      });
    },
  );

  app.post(
    '/v1/projects/:projectId/access',
    {
      preHandler: [app.authenticate, app.requireCanAccessProject('admin')],
      schema: {
        ...createdObjectSchema('createProjectAccessGrant', 'Projects', 'Crea grant access'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['workspaceId', 'role'],
          properties: {
            workspaceId: { type: 'string' },
            role: { type: 'string', enum: ['owner', 'collaborator', 'viewer'] },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const payload = accessGrantSchema.parse(request.body);
      const grant = {
        _id: crypto.randomUUID(),
        project_id: params.projectId,
        workspace_id: payload.workspaceId,
        role: payload.role,
        created_at: new Date().toISOString(),
      };
      await projectAccessRepo.create(grant);
      return reply.status(201).send({ data: grant });
    },
  );

  app.delete(
    '/v1/projects/:projectId/access/:grantId',
    {
      preHandler: [app.authenticate, app.requireCanAccessProject('admin')],
      schema: {
        ...okDeletedSchema('deleteProjectAccessGrant', 'Projects', 'Revoca grant access'),
        params: {
          type: 'object',
          required: ['projectId', 'grantId'],
          properties: {
            projectId: { type: 'string' },
            grantId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { projectId: string; grantId: string };
      await projectAccessRepo.deleteOne({ _id: params.grantId, project_id: params.projectId });
      return reply.send({ data: { deleted: true } });
    },
  );

  app.post(
    '/v1/session/projects-by-email',
    {
      preHandler: [app.authenticate],
      schema: {
        ...listSchema('listSessionProjectsByEmail', 'Session', 'Progetti per email (sessione)'),
        body: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            workspaceId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const body = projectsByEmailBodySchema.parse(request.body ?? {});
      const user = getJwtUser(request);

      let targetUserId = user.sub;
      if (body.email != null && body.email.trim().length > 0) {
        const normalized = body.email.trim().toLowerCase();
        if (normalized !== user.email.toLowerCase()) {
          if (!isTecmaPlatformAdmin(normalizeSystemRole(user))) {
            return reply.status(403).send({
              error: {
                code: 'Forbidden',
                message: 'Cannot query projects for another user',
                status: 403,
              },
            });
          }
          const other = (await app.mongoDb
            .collection('tz_users')
            .findOne({ email: normalized }, { projection: { _id: 1 } })) as {
            _id: { toString: () => string };
          } | null;
          if (other == null) {
            return reply.send({ data: [], paginationInfo: singlePagePaginationInfo(0) });
          }
          targetUserId = other._id.toString();
        }
      }

      const userProjects = await workspaceUserProjectsRepo.findMany({
        userId: targetUserId,
        ...(body.workspaceId != null ? { workspaceId: body.workspaceId } : {}),
      });
      return reply.send({
        data: userProjects,
        paginationInfo: singlePagePaginationInfo(userProjects.length),
      });
    },
  );

  app.get(
    '/v1/session/preferences',
    {
      preHandler: [app.authenticate],
      schema: {
        ...singleObjectSchema('getSessionPreferences', 'Session', 'Leggi preferenze sessione'),
      },
    },
    async (_request, reply) => {
      return reply.send({ data: { projectIds: [] } });
    },
  );

  app.post(
    '/v1/session/preferences',
    {
      preHandler: [app.authenticate],
      schema: {
        ...singleObjectSchema('setSessionPreferences', 'Session', 'Salva preferenze sessione'),
        body: {
          type: 'object',
          properties: {
            projectIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = request.body as { projectIds: string[] };
      return reply.send({ data: { projectIds: payload.projectIds ?? [] } });
    },
  );
};
