import crypto from 'node:crypto';

import { z } from 'zod';

import { MongoRepository } from '@followup/db';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import { singlePagePaginationInfo } from '../../lib/pagination.js';
import { listWorkspacesForRequester } from './listWorkspacesForRequester.js';
import {
  createdObjectSchema,
  listSchema,
  okDeletedSchema,
  singleObjectSchema,
} from '../../schemas/routeHelpers.js';

const createWorkspaceSchema = z.object({
  name: z.string().min(2),
  mfaRequired: z.boolean().default(false),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).optional(),
  mfaRequired: z.boolean().optional(),
});

const createMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['owner', 'admin', 'collaborator', 'viewer']),
});

const updateMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'collaborator', 'viewer']),
});

const addMemberProjectBodySchema = z.object({
  projectId: z.string().min(1),
});

export const workspacesRoutes = async (app: FastifyInstance): Promise<void> => {
  const workspacesRepo = new MongoRepository<any>(app.mongoDb.collection('tz_workspaces'));
  const membersRepo = new MongoRepository<any>(app.mongoDb.collection('tz_user_workspaces'));
  const workspaceProjectsRepo = new MongoRepository<any>(
    app.mongoDb.collection('tz_workspace_projects'),
  );
  const workspaceUserProjectsRepo = new MongoRepository<any>(
    app.mongoDb.collection('tz_workspace_user_projects'),
  );

  app.get(
    '/v1/workspaces',
    {
      preHandler: [app.authenticate, app.requirePermission('workspaces.read')],
      schema: listSchema('listWorkspaces', 'Workspaces', 'Elenco workspace'),
    },
    async (request: FastifyRequest, reply) => {
      const data = await listWorkspacesForRequester(app, {
        sub: (request.user as { sub: string }).sub,
        email: (request.user as { email: string }).email,
        systemRole: (request.user as { systemRole?: string }).systemRole,
      });
      return reply.send({ data, paginationInfo: singlePagePaginationInfo(data.length) });
    },
  );

  app.post(
    '/v1/workspaces',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...createdObjectSchema('createWorkspace', 'Workspaces', 'Crea workspace'),
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 2 },
            mfaRequired: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = createWorkspaceSchema.parse(request.body);
      const now = new Date().toISOString();

      const doc = {
        _id: crypto.randomUUID(),
        name: payload.name,
        owner_user_id: (request.user as { sub?: string } | undefined)?.sub,
        mfaRequired: payload.mfaRequired,
        createdAt: now,
        updatedAt: now,
      };

      await workspacesRepo.create(doc);
      return reply.status(201).send({ data: doc });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId',
    {
      preHandler: [
        app.authenticate,
        app.requirePermission('workspaces.read'),
        app.requireCanAccessWorkspace(),
      ],
      schema: {
        ...singleObjectSchema('getWorkspaceById', 'Workspaces', 'Dettaglio workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const workspace = await workspacesRepo.findOne({ _id: params.workspaceId });
      if (!workspace) {
        return reply.status(404).send({
          error: { code: 'WorkspaceNotFound', message: 'Workspace not found', status: 404 },
        });
      }
      return reply.send({ data: workspace });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema('patchWorkspace', 'Workspaces', 'Aggiorna workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 2 },
            mfaRequired: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = updateWorkspaceSchema.parse(request.body);
      await workspacesRepo.updateOne(
        { _id: params.workspaceId },
        { $set: { ...payload, updatedAt: new Date().toISOString() } },
      );
      const workspace = await workspacesRepo.findOne({ _id: params.workspaceId });
      return reply.send({ data: workspace });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId',
    {
      preHandler: [
        app.authenticate,
        app.requirePermission('workspaces.admin'),
        app.requireCanAccessWorkspace(),
      ],
      schema: {
        ...okDeletedSchema('deleteWorkspace', 'Workspaces', 'Elimina workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      await workspacesRepo.deleteOne({ _id: params.workspaceId });
      return reply.send({ data: { deleted: true } });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/members',
    {
      preHandler: [
        app.authenticate,
        app.requirePermission('users.read'),
        app.requireCanAccessWorkspace(),
      ],
      schema: {
        ...listSchema('listWorkspaceMembers', 'Workspaces', 'Membri workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const members = await membersRepo.findMany({ workspaceId: params.workspaceId });
      return reply.send({
        data: members,
        paginationInfo: singlePagePaginationInfo(members.length),
      });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/members',
    {
      preHandler: [
        app.authenticate,
        app.requirePermission('users.write'),
        app.requireCanAccessWorkspace(),
      ],
      schema: {
        ...createdObjectSchema('addWorkspaceMember', 'Workspaces', 'Aggiungi membro'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['userId', 'role'],
          properties: {
            userId: { type: 'string' },
            role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = createMemberSchema.parse(request.body);
      const doc = {
        _id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        userId: payload.userId,
        role: payload.role,
        access_scope: 'workspace',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await membersRepo.create(doc);
      return reply.status(201).send({ data: doc });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId/members/:userId',
    {
      preHandler: [
        app.authenticate,
        app.requirePermission('users.write'),
        app.requireCanAccessWorkspace(),
      ],
      schema: {
        ...singleObjectSchema('patchWorkspaceMember', 'Workspaces', 'Aggiorna ruolo membro'),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; userId: string };
      const payload = updateMemberSchema.parse(request.body);
      await membersRepo.updateOne(
        { workspaceId: params.workspaceId, userId: params.userId },
        { $set: { role: payload.role, updatedAt: new Date().toISOString() } },
      );
      const member = await membersRepo.findOne({
        workspaceId: params.workspaceId,
        userId: params.userId,
      });
      return reply.send({ data: member });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/members/:userId',
    {
      preHandler: [
        app.authenticate,
        app.requirePermission('users.write'),
        app.requireCanAccessWorkspace(),
      ],
      schema: {
        ...okDeletedSchema('removeWorkspaceMember', 'Workspaces', 'Rimuovi membro'),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; userId: string };
      await membersRepo.deleteOne({ workspaceId: params.workspaceId, userId: params.userId });
      return reply.send({ data: { deleted: true } });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/members/:userId/projects',
    {
      preHandler: [
        app.authenticate,
        app.requirePermission('users.read'),
        app.requireCanAccessWorkspace(),
      ],
      schema: {
        ...listSchema(
          'listMemberProjectAssignments',
          'Workspaces',
          'Progetti assegnati al membro nel workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; userId: string };
      const rows = await workspaceUserProjectsRepo.findMany({
        workspaceId: params.workspaceId,
        userId: params.userId,
      });
      return reply.send({
        data: rows,
        paginationInfo: singlePagePaginationInfo(rows.length),
      });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/members/:userId/projects',
    {
      preHandler: [
        app.authenticate,
        app.requirePermission('users.write'),
        app.requireCanAccessWorkspace(),
      ],
      schema: {
        ...createdObjectSchema(
          'addMemberProjectAssignment',
          'Workspaces',
          'Assegna progetto a un membro del workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; userId: string };
      const payload = addMemberProjectBodySchema.parse(request.body);

      const member = await membersRepo.findOne({
        workspaceId: params.workspaceId,
        userId: params.userId,
      });
      if (member == null) {
        return reply.status(404).send({
          error: {
            code: 'WorkspaceMemberNotFound',
            message: 'User is not a member of this workspace',
            status: 404,
          },
        });
      }

      const link = await workspaceProjectsRepo.findOne({
        workspaceId: params.workspaceId,
        projectId: payload.projectId,
      });
      if (link == null) {
        return reply.status(400).send({
          error: {
            code: 'ProjectNotInWorkspace',
            message: 'Project is not associated with this workspace',
            status: 400,
          },
        });
      }

      const existing = await workspaceUserProjectsRepo.findOne({
        workspaceId: params.workspaceId,
        userId: params.userId,
        projectId: payload.projectId,
      });
      if (existing != null) {
        return reply.status(409).send({
          error: {
            code: 'AssignmentExists',
            message: 'Project assignment already exists for this member',
            status: 409,
          },
        });
      }

      const now = new Date().toISOString();
      const doc = {
        _id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        userId: params.userId,
        projectId: payload.projectId,
        createdAt: now,
      };
      await workspaceUserProjectsRepo.create(doc);
      return reply.status(201).send({ data: doc });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/members/:userId/projects/:projectId',
    {
      preHandler: [
        app.authenticate,
        app.requirePermission('users.write'),
        app.requireCanAccessWorkspace(),
      ],
      schema: {
        ...okDeletedSchema(
          'removeMemberProjectAssignment',
          'Workspaces',
          'Rimuovi assegnazione progetto per un membro',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'userId', 'projectId'],
          properties: {
            workspaceId: { type: 'string' },
            userId: { type: 'string' },
            projectId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as {
        workspaceId: string;
        userId: string;
        projectId: string;
      };
      const res = await app.mongoDb.collection('tz_workspace_user_projects').deleteOne({
        workspaceId: params.workspaceId,
        userId: params.userId,
        projectId: params.projectId,
      } as any);
      if (res.deletedCount === 0) {
        return reply.status(404).send({
          error: {
            code: 'AssignmentNotFound',
            message: 'Project assignment not found for this member',
            status: 404,
          },
        });
      }
      return reply.send({ data: { deleted: true } });
    },
  );
};
