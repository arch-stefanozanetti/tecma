import crypto from 'node:crypto';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

import { MongoRepository } from '@followup/db';
import { isTecmaPlatformAdmin, normalizeSystemRole } from '@followup/shared-rbac';

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
  role: z.enum(['owner', 'admin', 'collaborator', 'viewer']).optional(),
  /** `all` = vede tutti i progetti del workspace. `assigned` = solo quelli linkati esplicitamente. */
  accessScope: z.enum(['all', 'assigned']).optional(),
  /** Hex color `#RRGGBB` per visualizzazione calendario (POC parity). */
  calendarDisplayColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Colore richiesto in formato #RRGGBB')
    .optional(),
});

const entitlementUpdateSchema = z.object({
  status: z.enum(['enabled', 'disabled']),
  metadata: z.record(z.unknown()).optional(),
});

const aiConfigSchema = z
  .object({
    provider: z.enum(['claude', 'openai', 'gemini']),
    apiKey: z.string().min(8).max(512).optional(),
    model: z.string().min(1).max(120).optional(),
    temperature: z.number().min(0).max(2).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();

const additionalInfoCreateSchema = z.object({
  label: z.string().min(1).max(120),
  value: z.string().min(0).max(10_000).default(''),
  sortOrder: z.number().int().nonnegative().optional(),
});

const additionalInfoUpdateSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  value: z.string().min(0).max(10_000).optional(),
  sortOrder: z.number().int().nonnegative().optional(),
});

const brandingSchema = z
  .object({
    logoUrl: z.string().url().optional(),
    emailHeaderUrl: z.string().url().optional(),
    primaryColor: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Colore richiesto in formato #RRGGBB')
      .optional(),
    footerText: z.string().max(500).optional(),
  })
  .strict();

const KNOWN_FEATURES = [
  'ai',
  'analytics',
  'connectors-marketing',
  'email-templates',
  'pdf-templates',
] as const;

const maskApiKey = (raw: string | undefined): string | undefined => {
  if (raw == null || raw.length <= 4) return raw;
  return `${'*'.repeat(Math.max(0, raw.length - 4))}${raw.slice(-4)}`;
};

const sanitizeAiConfigForResponse = (
  doc: Record<string, unknown> | null,
): Record<string, unknown> | null => {
  if (doc == null) return null;
  const sanitized = { ...doc } as Record<string, unknown>;
  if (typeof sanitized.apiKey === 'string') {
    sanitized.apiKey = maskApiKey(sanitized.apiKey);
  }
  return sanitized;
};

const addMemberProjectBodySchema = z.object({
  projectId: z.string().min(1),
});

const workspaceInviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(['owner', 'admin', 'collaborator', 'viewer']).default('viewer'),
  projectIds: z.array(z.string().min(1)).max(100).optional(),
});

export const workspacesRoutes = async (app: FastifyInstance): Promise<void> => {
  const usersRepo = new MongoRepository<any>(app.mongoDb.collection('tz_users'));
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
      schema: listSchema(
        'listWorkspaces',
        'Workspaces',
        'Elenco workspace',
        'Elenco workspace visibili al chiamante. Per Tecma SuperAdmin restituisce tutti i record in `tz_workspaces`; per gli altri utenti solo i workspace con membership risolta da sub/email/ObjectId.',
      ),
    },
    async (request: FastifyRequest, reply) => {
      const data = await listWorkspacesForRequester(app, {
        sub: (request.user as { sub: string }).sub,
        email: (request.user as { email: string }).email,
        systemRole: (request.user as { systemRole?: string }).systemRole,
        system_role: (request.user as { system_role?: string }).system_role,
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
      await app.auditService.authEvent({
        eventType: 'workspaces.create',
        userId: (request.user as { sub?: string } | undefined)?.sub ?? 'system',
        details: { workspaceId: doc._id, isTecmaAdmin: true },
      });
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
      const actor = request.user as { sub?: string; systemRole?: string; system_role?: string };
      await workspacesRepo.updateOne(
        { _id: params.workspaceId },
        { $set: { ...payload, updatedAt: new Date().toISOString() } },
      );
      if (isTecmaPlatformAdmin(normalizeSystemRole(actor))) {
        await app.auditService.authEvent({
          eventType: 'workspaces.update.tecma_admin',
          userId: actor.sub ?? 'system',
          details: { workspaceId: params.workspaceId, patch: payload },
        });
      }
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
      await app.auditService.authEvent({
        eventType: 'workspaces.delete',
        userId: (request.user as { sub?: string } | undefined)?.sub ?? 'system',
        details: { workspaceId: params.workspaceId },
      });
      return reply.send({ data: { deleted: true } });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/members',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
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
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
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
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'patchWorkspaceMember',
          'Workspaces',
          'Aggiorna ruolo membro / access scope / colore calendario',
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
          properties: {
            role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
            accessScope: {
              type: 'string',
              enum: ['all', 'assigned'],
              description: 'Strategia di visibilita progetti per il membro',
            },
            calendarDisplayColor: {
              type: 'string',
              pattern: '^#[0-9A-Fa-f]{6}$',
              description: 'Colore visualizzazione calendario (#RRGGBB)',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; userId: string };
      const payload = updateMemberSchema.parse(request.body);
      const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
      if (payload.role != null) update.role = payload.role;
      if (payload.accessScope != null) update.accessScope = payload.accessScope;
      if (payload.calendarDisplayColor != null) {
        update.calendarDisplayColor = payload.calendarDisplayColor;
      }
      await membersRepo.updateOne(
        { workspaceId: params.workspaceId, userId: params.userId },
        { $set: update },
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
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
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
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
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
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
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
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
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

  app.post(
    '/v1/workspaces/:workspaceId/invitations',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...createdObjectSchema(
          'createWorkspaceInvitation',
          'Workspaces',
          'Invito utente nel workspace (opz. progetti) + notifica mail',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['email', 'fullName'],
          properties: {
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string', minLength: 2 },
            role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
            projectIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = workspaceInviteSchema.parse(request.body);
      const actor = request.user as { sub?: string };
      const wsId = params.workspaceId;
      const emailLower = payload.email.trim().toLowerCase();

      const existingUser = await usersRepo.findOne({ email: emailLower } as any);
      let targetUserId: string;

      if (existingUser != null) {
        targetUserId = (existingUser as { _id: ObjectId })._id.toString();
      } else {
        const now = new Date().toISOString();
        const randomSecret = crypto.randomBytes(32).toString('base64url');
        const passwordHash = await bcrypt.hash(randomSecret, 12);
        const doc = {
          _id: new ObjectId(),
          email: emailLower,
          fullName: payload.fullName,
          passwordHash,
          systemRole: 'user',
          role: payload.role,
          status: 'invited' as const,
          createdAt: now,
          updatedAt: now,
        };
        await usersRepo.create(doc);
        targetUserId = doc._id.toString();
      }

      const dup = await membersRepo.findOne({ workspaceId: wsId, userId: targetUserId });
      if (dup != null) {
        return reply.status(409).send({
          error: {
            code: 'WorkspaceMemberExists',
            message: 'User is already a member of this workspace',
            status: 409,
          },
        });
      }

      const now = new Date().toISOString();
      await membersRepo.create({
        _id: crypto.randomUUID(),
        workspaceId: wsId,
        userId: targetUserId,
        role: payload.role,
        access_scope: 'workspace',
        createdAt: now,
        updatedAt: now,
      });

      if (payload.projectIds != null) {
        for (const projectId of payload.projectIds) {
          const link = await workspaceProjectsRepo.findOne({ workspaceId: wsId, projectId });
          if (link == null) {
            return reply.status(400).send({
              error: {
                code: 'ProjectNotInWorkspace',
                message: `Project ${projectId} is not associated with this workspace`,
                status: 400,
              },
            });
          }
          const row = await workspaceUserProjectsRepo.findOne({
            workspaceId: wsId,
            userId: targetUserId,
            projectId,
          });
          if (row == null) {
            await workspaceUserProjectsRepo.create({
              _id: crypto.randomUUID(),
              workspaceId: wsId,
              userId: targetUserId,
              projectId,
              createdAt: now,
            });
          }
        }
      }

      await app.auditService.authEvent({
        eventType: 'workspaces.invitation.created',
        userId: actor.sub ?? 'system',
        details: { workspaceId: wsId, invitedEmail: emailLower, projectIds: payload.projectIds },
      });

      await app.mail.sendTemplate({
        to: emailLower,
        flowKey: 'workspace_invite',
        vars: { workspaceId: wsId },
      });

      return reply.status(201).send({
        data: { userId: targetUserId, workspaceId: wsId, email: emailLower },
      });
    },
  );

  // ---------------------------------------------------------------------------
  // M2: Workspace advanced sections (entitlements, ai-config, additional-infos,
  //     branding). Tutte usano collection dedicate `tz_workspace_*`.
  // ---------------------------------------------------------------------------

  const entitlementsRepo = new MongoRepository<any>(
    app.mongoDb.collection('tz_workspace_entitlements'),
  );
  const aiConfigRepo = new MongoRepository<any>(app.mongoDb.collection('tz_workspace_ai_config'));
  const additionalInfosRepo = new MongoRepository<any>(
    app.mongoDb.collection('tz_additional_infos'),
  );
  const brandingRepo = new MongoRepository<any>(app.mongoDb.collection('tz_workspace_branding'));

  app.get(
    '/v1/workspaces/:workspaceId/entitlements',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema('listWorkspaceEntitlements', 'Workspaces', 'Entitlements workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const stored = await entitlementsRepo.findMany({ workspaceId: params.workspaceId } as any);
      const map = new Map<string, any>();
      for (const row of stored) map.set(String((row as { feature?: string }).feature ?? ''), row);
      const data = KNOWN_FEATURES.map((feature) => {
        const row = map.get(feature);
        return {
          workspaceId: params.workspaceId,
          feature,
          status: row?.status ?? 'disabled',
          metadata: row?.metadata ?? null,
          updatedAt: row?.updatedAt ?? null,
        };
      });
      return reply.send({ data, paginationInfo: singlePagePaginationInfo(data.length) });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId/entitlements/:feature',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'patchWorkspaceEntitlement',
          'Workspaces',
          'Aggiorna entitlement workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'feature'],
          properties: {
            workspaceId: { type: 'string' },
            feature: {
              type: 'string',
              enum: KNOWN_FEATURES as unknown as string[],
            },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['enabled', 'disabled'] },
            metadata: { type: 'object', additionalProperties: true },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; feature: string };
      if (!KNOWN_FEATURES.includes(params.feature as (typeof KNOWN_FEATURES)[number])) {
        return reply.status(400).send({
          error: {
            code: 'UnknownFeature',
            message: `Unknown feature "${params.feature}"`,
            status: 400,
          },
        });
      }
      const payload = entitlementUpdateSchema.parse(request.body);
      const now = new Date().toISOString();
      const filter = { workspaceId: params.workspaceId, feature: params.feature } as any;
      const existing = await entitlementsRepo.findOne(filter);
      if (existing == null) {
        await entitlementsRepo.create({
          _id: crypto.randomUUID(),
          workspaceId: params.workspaceId,
          feature: params.feature,
          status: payload.status,
          metadata: payload.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        } as any);
      } else {
        await entitlementsRepo.updateOne(filter, {
          $set: {
            status: payload.status,
            metadata: payload.metadata ?? (existing as { metadata?: unknown }).metadata ?? null,
            updatedAt: now,
          },
        });
      }
      const row = await entitlementsRepo.findOne(filter);
      const actor = request.user as { sub?: string };
      await app.auditService.authEvent({
        eventType: 'workspaces.entitlement.update',
        userId: actor.sub ?? 'system',
        details: {
          workspaceId: params.workspaceId,
          feature: params.feature,
          status: payload.status,
        },
      });
      return reply.send({ data: row });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/ai-config',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...singleObjectSchema('getWorkspaceAiConfig', 'Workspaces', 'Configurazione AI workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const doc = await aiConfigRepo.findOne({ workspaceId: params.workspaceId } as any);
      return reply.send({ data: sanitizeAiConfigForResponse(doc) });
    },
  );

  app.put(
    '/v1/workspaces/:workspaceId/ai-config',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'putWorkspaceAiConfig',
          'Workspaces',
          'Salva configurazione AI workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['provider'],
          properties: {
            provider: { type: 'string', enum: ['claude', 'openai', 'gemini'] },
            apiKey: { type: 'string', minLength: 8, maxLength: 512 },
            model: { type: 'string', minLength: 1, maxLength: 120 },
            temperature: { type: 'number', minimum: 0, maximum: 2 },
            enabled: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = aiConfigSchema.parse(request.body);
      const now = new Date().toISOString();
      const filter = { workspaceId: params.workspaceId } as any;
      const existing = await aiConfigRepo.findOne(filter);
      const doc = {
        provider: payload.provider,
        ...(payload.apiKey != null ? { apiKey: payload.apiKey } : {}),
        ...(payload.model != null ? { model: payload.model } : {}),
        ...(payload.temperature != null ? { temperature: payload.temperature } : {}),
        ...(payload.enabled != null ? { enabled: payload.enabled } : {}),
        updatedAt: now,
      };
      if (existing == null) {
        await aiConfigRepo.create({
          _id: crypto.randomUUID(),
          workspaceId: params.workspaceId,
          ...doc,
          createdAt: now,
        } as any);
      } else {
        await aiConfigRepo.updateOne(filter, { $set: doc });
      }
      const row = await aiConfigRepo.findOne(filter);
      const actor = request.user as { sub?: string };
      await app.auditService.authEvent({
        eventType: 'workspaces.aiConfig.update',
        userId: actor.sub ?? 'system',
        details: { workspaceId: params.workspaceId, provider: payload.provider },
      });
      return reply.send({ data: sanitizeAiConfigForResponse(row) });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/additional-infos',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema(
          'listWorkspaceAdditionalInfos',
          'Workspaces',
          'Additional infos workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const rows = await app.mongoDb
        .collection('tz_additional_infos')
        .find({ workspaceId: params.workspaceId } as any)
        .sort({ sortOrder: 1, createdAt: 1 })
        .toArray();
      return reply.send({ data: rows, paginationInfo: singlePagePaginationInfo(rows.length) });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/additional-infos',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...createdObjectSchema(
          'createWorkspaceAdditionalInfo',
          'Workspaces',
          'Crea additional info workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['label'],
          properties: {
            label: { type: 'string', minLength: 1, maxLength: 120 },
            value: { type: 'string', maxLength: 10000 },
            sortOrder: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = additionalInfoCreateSchema.parse(request.body);
      const now = new Date().toISOString();
      const doc = {
        _id: crypto.randomUUID(),
        workspaceId: params.workspaceId,
        label: payload.label,
        value: payload.value,
        sortOrder: payload.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      };
      await additionalInfosRepo.create(doc as any);
      return reply.status(201).send({ data: doc });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId/additional-infos/:infoId',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'patchWorkspaceAdditionalInfo',
          'Workspaces',
          'Aggiorna additional info workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'infoId'],
          properties: {
            workspaceId: { type: 'string' },
            infoId: { type: 'string' },
          },
        },
        body: {
          type: 'object',
          properties: {
            label: { type: 'string', minLength: 1, maxLength: 120 },
            value: { type: 'string', maxLength: 10000 },
            sortOrder: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; infoId: string };
      const payload = additionalInfoUpdateSchema.parse(request.body);
      const filter = { _id: params.infoId, workspaceId: params.workspaceId } as any;
      const existing = await additionalInfosRepo.findOne(filter);
      if (existing == null) {
        return reply.status(404).send({
          error: { code: 'AdditionalInfoNotFound', message: 'Not found', status: 404 },
        });
      }
      await additionalInfosRepo.updateOne(filter, {
        $set: {
          ...payload,
          updatedAt: new Date().toISOString(),
        },
      });
      const updated = await additionalInfosRepo.findOne(filter);
      return reply.send({ data: updated });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/additional-infos/:infoId',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...okDeletedSchema(
          'deleteWorkspaceAdditionalInfo',
          'Workspaces',
          'Elimina additional info workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'infoId'],
          properties: {
            workspaceId: { type: 'string' },
            infoId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; infoId: string };
      const result = await additionalInfosRepo.deleteOne({
        _id: params.infoId,
        workspaceId: params.workspaceId,
      } as any);
      if (result.deletedCount === 0) {
        return reply.status(404).send({
          error: { code: 'AdditionalInfoNotFound', message: 'Not found', status: 404 },
        });
      }
      return reply.send({ data: { deleted: true } });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/branding',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...singleObjectSchema('getWorkspaceBranding', 'Workspaces', 'Branding workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const doc = await brandingRepo.findOne({ workspaceId: params.workspaceId } as any);
      return reply.send({ data: doc });
    },
  );

  app.patch(
    '/v1/workspaces/:workspaceId/branding',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'patchWorkspaceBranding',
          'Workspaces',
          'Aggiorna branding workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            logoUrl: { type: 'string', format: 'uri' },
            emailHeaderUrl: { type: 'string', format: 'uri' },
            primaryColor: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
            footerText: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = brandingSchema.parse(request.body);
      const filter = { workspaceId: params.workspaceId } as any;
      const now = new Date().toISOString();
      const existing = await brandingRepo.findOne(filter);
      if (existing == null) {
        await brandingRepo.create({
          _id: crypto.randomUUID(),
          workspaceId: params.workspaceId,
          ...payload,
          createdAt: now,
          updatedAt: now,
        } as any);
      } else {
        await brandingRepo.updateOne(filter, {
          $set: { ...payload, updatedAt: now },
        });
      }
      const row = await brandingRepo.findOne(filter);
      const actor = request.user as { sub?: string };
      await app.auditService.authEvent({
        eventType: 'workspaces.branding.update',
        userId: actor.sub ?? 'system',
        details: { workspaceId: params.workspaceId, fields: Object.keys(payload) },
      });
      return reply.send({ data: row });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/clients',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema(
          'listWorkspaceClients',
          'Workspaces',
          'Clienti collegati al workspace (scaffolding)',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const wf = { workspaceId: params.workspaceId };
      const rows = await app.mongoDb
        .collection('tz_clients')
        .find({
          $or: [{ workspaceId: wf.workspaceId }, { workspace_id: wf.workspaceId }],
        } as any)
        .toArray();
      return reply.send({
        data: rows,
        paginationInfo: singlePagePaginationInfo(rows.length),
      });
    },
  );
};
