import crypto from 'node:crypto';

import { z } from 'zod';

import { MongoRepository, UsersRepository, WorkspaceMembersRepository } from '@followup/db';
import { isTecmaPlatformAdmin, normalizeSystemRole } from '@followup/shared-rbac';

import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  activeAccessStatusFilter,
  activeMembershipStatusFilter,
  activeResourceStatusFilter,
  buildUserWorkspaceMembershipFilter,
  mongoPrimaryKeyFilter,
  normalizeToStringId,
} from '../../lib/mongoIdentity.js';
import { buildSoftDeleteFields, enqueueLifecycleNotice } from '../../lib/lifecycleRetention.js';
import { listAccessibleProjectIdsForUser } from '../../lib/projectAccess.js';
import { isSelfIdentity, resolveUserIdentityCandidates } from '../../lib/userIdentity.js';
import {
  buildMongoSkip,
  buildMongoSort,
  buildPaginationInfo,
  parsePaginationQuery,
} from '../../lib/pagination.js';
import {
  projectsCreateRateLimit,
  projectsGrantCreateRateLimit,
  projectsGrantDeleteRateLimit,
} from '../../lib/rateLimitProfiles.js';
import {
  fetchProjectsForWorkspaceScopedList,
  type ProjectDocument,
  type WorkspaceProjectDocument,
  type WorkspaceUserProjectDocument,
} from './fetchProjectsForWorkspaceScopedList.js';
import { syncLegacyPayloadRawProjectAfterTzUpdate } from './syncLegacyPayloadRawProject.js';
import {
  createdObjectSchema,
  listSchema,
  okDeletedSchema,
  singleObjectSchema,
} from '../../schemas/routeHelpers.js';

const createProjectSchema = z
  .object({
    workspaceId: z.string().min(1),
    name: z.string().min(2),
    code: z.string().min(2),
    displayName: z.string().min(1).max(255).optional(),
    mode: z.enum(['rent', 'sell']).default('sell'),
    city: z.string().max(200).optional(),
    payoff: z.string().max(300).optional(),
    contactEmail: z.string().email().optional().or(z.literal('')),
    contactPhone: z.string().max(50).optional(),
    projectUrl: z.string().url().optional().or(z.literal('')),
    customDomain: z.string().max(300).optional(),
    defaultLang: z.string().min(2).max(10).default('it'),
    hostKey: z.string().min(1).max(120).optional(),
    assetKey: z.string().min(1).max(120).optional(),
    feVendorKey: z.string().min(1).max(120).optional(),
    automaticQuoteEnabled: z.boolean().optional().default(false),
    accountManagerEnabled: z.boolean().optional().default(false),
    hasDAS: z.boolean().optional().default(false),
    broker: z.string().nullable().optional(),
    iban: z.string().max(50).optional(),
  })
  .strict();

const updateProjectSchema = z
  .object({
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
    broker: z.string().nullable().optional(),
    iban: z.string().max(50).optional().or(z.literal('')),
  })
  .strict();

const accessGrantSchema = z.object({
  workspaceId: z.string().min(1),
  role: z.enum(['owner', 'collaborator', 'viewer']),
});

const projectsByEmailBodySchema = z.object({
  email: z.string().email().optional(),
  workspaceId: z.string().min(1).optional(),
});

const sessionPreferencesSchema = z
  .object({
    projectIds: z.array(z.string().min(1)).max(100).default([]),
  })
  .strict();

const associateWorkspaceProjectSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
});

const lifecycleReasonSchema = z
  .object({
    reason: z.string().min(1).max(120).optional(),
    note: z.string().max(500).optional(),
  })
  .strict();

type JwtUser = {
  sub: string;
  email: string;
  systemRole?: string;
  system_role?: string;
  permissions?: string[];
};

const getJwtUser = (request: FastifyRequest): JwtUser => request.user as JwtUser;

type ProjectAccessDocument = {
  _id: string;
  project_id?: unknown;
  projectId?: unknown;
  workspace_id?: unknown;
  workspaceId?: unknown;
  role?: string;
  accessLevel?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type WorkspaceLookupDocument = {
  _id: string;
  status?: string;
};

export const projectsRoutes = async (app: FastifyInstance): Promise<void> => {
  const projectsRepo = new MongoRepository<ProjectDocument>(
    app.mongoDb.collection<ProjectDocument>('tz_projects'),
  );
  const workspaceProjectsRepo = new MongoRepository<WorkspaceProjectDocument>(
    app.mongoDb.collection<WorkspaceProjectDocument>('tz_workspace_projects'),
  );
  const workspaceUserProjectsRepo = new MongoRepository<WorkspaceUserProjectDocument>(
    app.mongoDb.collection<WorkspaceUserProjectDocument>('tz_workspace_user_projects'),
  );
  const workspaceMembersRepo = new WorkspaceMembersRepository(app.mongoDb);
  const projectAccessRepo = new MongoRepository<ProjectAccessDocument>(
    app.mongoDb.collection<ProjectAccessDocument>('tz_project_access'),
  );
  const workspacesRepo = new MongoRepository<WorkspaceLookupDocument>(
    app.mongoDb.collection<WorkspaceLookupDocument>('tz_workspaces'),
  );
  const usersRepo = new UsersRepository(app.mongoDb);
  const activeFilter = activeResourceStatusFilter();
  const activeAccessFilter = activeAccessStatusFilter();
  const projectListAllowedSortFields = ['name', 'code', 'createdAt', 'updatedAt'] as const;
  const projectGrantListAllowedSortFields = [
    'workspace_id',
    'workspaceId',
    'role',
    'createdAt',
    'updatedAt',
  ] as const;

  const userCanManageProjectLifecycle = async (
    user: JwtUser,
    project: ProjectDocument,
  ): Promise<boolean> => {
    if (isTecmaPlatformAdmin(normalizeSystemRole(user))) return true;
    const workspaceId = normalizeToStringId(project.workspaceId ?? project.workspace_id);
    if (workspaceId == null) return false;
    const workspace = await workspacesRepo.findOne({
      ...mongoPrimaryKeyFilter(workspaceId),
      ...activeFilter,
    });
    if (workspace == null) return false;
    const identities = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
    const membership = await workspaceMembersRepo.findOne({
      ...buildUserWorkspaceMembershipFilter(workspaceId, identities),
      ...activeMembershipStatusFilter(),
    } as any);
    const role = String((membership as { role?: unknown } | null)?.role ?? '');
    return membership != null && ['owner', 'admin'].includes(role);
  };

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
            status: {
              type: 'string',
              enum: ['active', 'archived'],
              default: 'active',
              description: 'Filtro lifecycle operativo. Default: solo progetti attivi.',
            },
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: projectListAllowedSortFields },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as {
        workspaceId?: string;
        userId?: string;
        page?: string | number;
        perPage?: string | number;
        sortField?: string;
        sortOrder?: 'asc' | 'desc';
        status?: 'active' | 'archived';
      };
      const user = getJwtUser(request);
      const paginationParams = parsePaginationQuery(
        {
          page: query.page,
          perPage: query.perPage,
          sortField: query.sortField,
          sortOrder: query.sortOrder,
        },
        projectListAllowedSortFields,
      );
      const sortEntries = Object.entries(buildMongoSort(paginationParams, 'name'));
      const paginateRows = <T extends Record<string, unknown>>(rows: T[]): T[] => {
        const start = buildMongoSkip(paginationParams);
        return [...rows]
          .sort((a, b) => {
            for (const [field, dir] of sortEntries) {
              const av = String(a[field] ?? '');
              const bv = String(b[field] ?? '');
              const cmp = av.localeCompare(bv, 'it', { numeric: true, sensitivity: 'base' });
              if (cmp !== 0) return dir === 1 ? cmp : -cmp;
            }
            return 0;
          })
          .slice(start, start + paginationParams.perPage);
      };
      const paginatedResponse = <T extends Record<string, unknown>>(rows: T[]) =>
        reply.send({
          data: paginateRows(rows),
          paginationInfo: buildPaginationInfo(rows.length, paginationParams),
        });

      if (query.workspaceId) {
        const requestedUserId = query.userId?.trim();
        const isAdmin = isTecmaPlatformAdmin(normalizeSystemRole(user));
        const workspace = await workspacesRepo.findOne({
          ...mongoPrimaryKeyFilter(query.workspaceId),
          ...activeFilter,
        });
        if (workspace == null) {
          return reply.status(404).send({
            error: {
              code: 'WorkspaceNotFound',
              message: 'Workspace not found or not active',
              status: 404,
            },
          });
        }

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
          const membership = await workspaceMembersRepo.findOne({
            ...buildUserWorkspaceMembershipFilter(query.workspaceId, identityList),
            ...activeMembershipStatusFilter(),
          } as any);
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
            projectStatusFilter:
              query.status === 'archived' ? { status: 'archived' } : activeFilter,
          },
        );
        return paginatedResponse(data as Record<string, unknown>[]);
      }

      if (isTecmaPlatformAdmin(normalizeSystemRole(user))) {
        const projectStatusFilter =
          query.status === 'archived' ? { status: 'archived' } : activeFilter;
        const totalDocs = await projectsRepo.count(projectStatusFilter);
        const data = await projectsRepo.listPaginated(projectStatusFilter, {
          skip: buildMongoSkip(paginationParams),
          limit: paginationParams.perPage,
          sort: buildMongoSort(paginationParams, 'name'),
        });
        return reply.send({
          data,
          paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
        });
      }

      const identityList = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
      const ids = await listAccessibleProjectIdsForUser(app, identityList);
      if (ids.length === 0) {
        return reply.send({ data: [], paginationInfo: buildPaginationInfo(0, paginationParams) });
      }
      const filter = { _id: { $in: ids } as any, ...activeFilter };
      const totalDocs = await projectsRepo.count(filter);
      const data = await projectsRepo.listPaginated(filter, {
        skip: buildMongoSkip(paginationParams),
        limit: paginationParams.perPage,
        sort: buildMongoSort(paginationParams, 'name'),
      });
      return reply.send({
        data,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.post(
    '/v1/workspaces/projects/associate',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...createdObjectSchema(
          'associateWorkspaceProject',
          'Projects',
          'Associa un progetto esistente a un workspace',
        ),
        body: {
          type: 'object',
          required: ['workspaceId', 'projectId'],
          properties: {
            workspaceId: { type: 'string' },
            projectId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = associateWorkspaceProjectSchema.parse(request.body);
      const user = getJwtUser(request);

      const project = await projectsRepo.findOne({ _id: payload.projectId, ...activeFilter });
      if (project == null) {
        return reply.status(404).send({
          error: { code: 'ProjectNotFound', message: 'Project not found', status: 404 },
        });
      }

      const targetWorkspace = await workspacesRepo.findOne({
        ...mongoPrimaryKeyFilter(payload.workspaceId),
        ...activeFilter,
      });
      if (targetWorkspace == null) {
        return reply.status(404).send({
          error: {
            code: 'WorkspaceNotFound',
            message: 'Workspace not found or not active',
            status: 404,
          },
        });
      }

      const existing = await workspaceProjectsRepo.findOne({
        workspaceId: payload.workspaceId,
        projectId: payload.projectId,
      } as any);
      if (
        existing != null &&
        !['deleted', 'revoked', 'deactivated', 'suspended', 'archived'].includes(
          String((existing as { status?: unknown }).status),
        )
      ) {
        return reply.status(409).send({
          error: { code: 'AssociationExists', message: 'Project already associated', status: 409 },
        });
      }

      const now = new Date().toISOString();
      if (existing == null) {
        await workspaceProjectsRepo.create({
          _id: crypto.randomUUID(),
          workspaceId: payload.workspaceId,
          projectId: payload.projectId,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await workspaceProjectsRepo.updateOne({ _id: (existing as { _id: string })._id } as any, {
          $set: {
            status: 'active',
            updatedAt: now,
          },
          $unset: { deletedAt: '', deletedBy: '' },
        });
      }

      await app.auditService.authEvent({
        eventType: 'projects.workspace.associate',
        userId: user.sub ?? 'system',
        details: { workspaceId: payload.workspaceId, projectId: payload.projectId },
      });

      return reply.status(201).send({
        data: {
          workspaceId: payload.workspaceId,
          projectId: payload.projectId,
          associated: true,
        },
      });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/projects/:projectId',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...okDeletedSchema(
          'dissociateWorkspaceProject',
          'Projects',
          'Rimuovi associazione progetto da workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'projectId'],
          properties: {
            workspaceId: { type: 'string' },
            projectId: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; projectId: string };
      const user = getJwtUser(request);

      const now = new Date().toISOString();
      const actorId = user.sub ?? 'system';
      const link = await workspaceProjectsRepo.updateOne(
        {
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          ...activeAccessFilter,
        },
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            updatedAt: now,
          },
        },
      );
      if (link.matchedCount === 0) {
        return reply.status(404).send({
          error: {
            code: 'AssociationNotFound',
            message: 'Project association not found',
            status: 404,
          },
        });
      }

      await workspaceUserProjectsRepo.updateMany(
        {
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          ...activeAccessFilter,
        } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            updatedAt: now,
          },
        } as any,
      );

      await app.auditService.authEvent({
        eventType: 'projects.workspace.dissociate',
        userId: actorId,
        details: { workspaceId: params.workspaceId, projectId: params.projectId },
      });

      return reply.send({ data: { deleted: true } });
    },
  );

  app.post(
    '/v1/projects',
    {
      config: { rateLimit: projectsCreateRateLimit(app.config) },
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...createdObjectSchema('createProject', 'Projects', 'Crea progetto'),
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['workspaceId', 'name', 'code'],
          properties: {
            workspaceId: { type: 'string', description: 'Workspace di appartenenza' },
            name: { type: 'string', minLength: 2, description: 'Nome progetto' },
            code: { type: 'string', minLength: 2, description: 'Codice progetto' },
            displayName: {
              type: 'string',
              minLength: 1,
              maxLength: 255,
              description: 'Nome visualizzato',
            },
            mode: { type: 'string', enum: ['rent', 'sell'], description: 'Modalità rent/sell' },
            city: { type: 'string', maxLength: 200, description: 'Città' },
            payoff: { type: 'string', maxLength: 300, description: 'Payoff' },
            contactEmail: { type: 'string', description: 'Email contatto' },
            contactPhone: { type: 'string', maxLength: 50, description: 'Telefono contatto' },
            projectUrl: { type: 'string', description: 'URL progetto' },
            customDomain: { type: 'string', maxLength: 300, description: 'Dominio custom' },
            defaultLang: {
              type: 'string',
              minLength: 2,
              maxLength: 10,
              description: 'Lingua predefinita',
            },
            hostKey: { type: 'string', minLength: 1, maxLength: 120, description: 'Host key' },
            assetKey: { type: 'string', minLength: 1, maxLength: 120, description: 'Asset key' },
            feVendorKey: {
              type: 'string',
              minLength: 1,
              maxLength: 120,
              description: 'Vendor key FE',
            },
            automaticQuoteEnabled: { type: 'boolean', description: 'Preventivo automatico' },
            accountManagerEnabled: { type: 'boolean', description: 'Account manager' },
            hasDAS: { type: 'boolean', description: 'Flag DAS' },
            broker: { type: 'string', nullable: true, description: 'Broker' },
            iban: { type: 'string', maxLength: 50, description: 'IBAN' },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = createProjectSchema.parse(request.body);
      const user = getJwtUser(request);
      const workspace = await workspacesRepo.findOne({
        ...mongoPrimaryKeyFilter(payload.workspaceId),
        ...activeFilter,
      });
      if (workspace == null) {
        return reply.status(404).send({
          error: {
            code: 'WorkspaceNotFound',
            message: 'Workspace not found or not active',
            status: 404,
          },
        });
      }

      const now = new Date().toISOString();
      const projectId = crypto.randomUUID();
      const nameTrim = payload.name.trim();
      const codeTrim = payload.code.trim();
      const displayName =
        payload.displayName?.trim() || `${nameTrim} (${payload.mode === 'rent' ? 'Rent' : 'Sell'})`;

      const doc: ProjectDocument = {
        _id: projectId,
        workspaceId: payload.workspaceId,
        name: nameTrim,
        code: codeTrim,
        displayName,
        mode: payload.mode,
        defaultLang: payload.defaultLang,
        automaticQuoteEnabled: payload.automaticQuoteEnabled,
        accountManagerEnabled: payload.accountManagerEnabled,
        hasDAS: payload.hasDAS,
        hostKey: payload.hostKey?.trim() || projectId,
        assetKey: payload.assetKey?.trim() || projectId,
        feVendorKey: payload.feVendorKey?.trim() || `${codeTrim}-${projectId.slice(0, 8)}`,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      };

      if (payload.city?.trim()) doc.city = payload.city.trim();
      if (payload.payoff?.trim()) doc.payoff = payload.payoff.trim();
      if (payload.contactEmail?.trim()) doc.contactEmail = payload.contactEmail.trim();
      if (payload.contactPhone?.trim()) doc.contactPhone = payload.contactPhone.trim();
      if (payload.projectUrl?.trim()) doc.projectUrl = payload.projectUrl.trim();
      if (payload.customDomain?.trim()) doc.customDomain = payload.customDomain.trim();
      if (payload.broker !== undefined) doc.broker = payload.broker;
      if (payload.iban?.trim()) doc.iban = payload.iban.trim();

      await projectsRepo.create(doc);
      try {
        await syncLegacyPayloadRawProjectAfterTzUpdate({
          projectsRepo: projectsRepo as never,
          projectId,
          activeFilter,
          updateDoc: { ...doc, updatedAt: now } as Record<string, unknown>,
        });
      } catch {
        await projectsRepo.deleteOne({ _id: projectId } as never);
        return reply.status(400).send({
          error: {
            code: 'LegacyPayloadError',
            message: 'Impossibile inizializzare il mirror legacy del progetto',
            status: 400,
          },
        });
      }
      await workspaceProjectsRepo.create({
        _id: crypto.randomUUID(),
        workspaceId: payload.workspaceId,
        projectId: doc._id,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      });

      await app.auditService.authEvent({
        eventType: 'projects.create',
        userId: user.sub,
        details: {
          workspaceId: payload.workspaceId,
          projectId: doc._id,
          isTecmaAdmin: isTecmaPlatformAdmin(normalizeSystemRole(user)),
        },
      });

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
      const project = await projectsRepo.findOne({ _id: params.projectId, ...activeFilter });
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
          additionalProperties: false,
          properties: {
            name: { type: 'string', minLength: 2 },
            code: { type: 'string', minLength: 2 },
            displayName: { type: 'string', minLength: 1, maxLength: 255 },
            mode: { type: 'string', enum: ['rent', 'sell'] },
            defaultLang: { type: 'string', minLength: 2, maxLength: 10 },
            hostKey: { type: 'string', minLength: 1, maxLength: 120 },
            assetKey: { type: 'string', minLength: 1, maxLength: 120 },
            feVendorKey: { type: 'string', minLength: 1, maxLength: 120 },
            automaticQuoteEnabled: { type: 'boolean' },
            accountManagerEnabled: { type: 'boolean' },
            hasDAS: { type: 'boolean' },
            contactEmail: { type: 'string' },
            contactPhone: { type: 'string', minLength: 1, maxLength: 64 },
            projectUrl: { type: 'string' },
            customDomain: { type: 'string', minLength: 1, maxLength: 255 },
            city: { type: 'string', minLength: 1, maxLength: 255 },
            payoff: { type: 'string', maxLength: 500 },
            broker: { type: 'string', nullable: true },
            iban: { type: 'string', maxLength: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const payload = updateProjectSchema.parse(request.body);
      const user = getJwtUser(request);
      const updatedAt = new Date().toISOString();
      await projectsRepo.updateOne(
        { _id: params.projectId, ...activeFilter },
        { $set: { ...payload, updatedAt } },
      );
      try {
        await syncLegacyPayloadRawProjectAfterTzUpdate({
          projectsRepo: projectsRepo as never,
          projectId: params.projectId,
          activeFilter,
          updateDoc: { ...payload, updatedAt },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Legacy sync failed';
        return reply.status(400).send({
          error: { code: 'LegacyPayloadError', message, status: 400 },
        });
      }
      await app.auditService.authEvent({
        eventType: 'projects.update',
        userId: user.sub,
        details: {
          projectId: params.projectId,
          patch: payload,
          isTecmaAdmin: isTecmaPlatformAdmin(normalizeSystemRole(user)),
        },
      });
      const project = await projectsRepo.findOne({ _id: params.projectId, ...activeFilter });
      return reply.send({ data: project });
    },
  );

  app.delete(
    '/v1/projects/:projectId',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
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
      const now = new Date().toISOString();
      const actorId = user.sub ?? 'system';
      const softDeleteFields = buildSoftDeleteFields({
        actorId,
        now,
        reason: 'project_deleted_by_tecma',
      });
      const projectUpdate = await projectsRepo.updateOne(
        { _id: params.projectId, ...activeFilter },
        { $set: softDeleteFields },
      );
      if (projectUpdate.matchedCount === 0) {
        return reply.status(404).send({
          error: { code: 'ProjectNotFound', message: 'Project not found', status: 404 },
        });
      }
      await workspaceProjectsRepo.updateMany(
        { projectId: params.projectId, ...activeAccessFilter } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            deletedReason: 'project_deleted_by_tecma',
            deleteReason: 'project_deleted_by_tecma',
            purgeEligibleAt: softDeleteFields.purgeEligibleAt,
            updatedAt: now,
          },
        },
      );
      await workspaceUserProjectsRepo.updateMany(
        { projectId: params.projectId, ...activeAccessFilter } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            deletedReason: 'project_deleted_by_tecma',
            deleteReason: 'project_deleted_by_tecma',
            purgeEligibleAt: softDeleteFields.purgeEligibleAt,
            updatedAt: now,
          },
        },
      );
      await projectAccessRepo.updateMany(
        { project_id: params.projectId, ...activeAccessFilter } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            deletedReason: 'project_deleted_by_tecma',
            deleteReason: 'project_deleted_by_tecma',
            purgeEligibleAt: softDeleteFields.purgeEligibleAt,
            updatedAt: now,
          },
        },
      );
      await app.auditService.authEvent({
        eventType: 'projects.delete',
        userId: user.sub,
        details: {
          projectId: params.projectId,
          isTecmaAdmin: isTecmaPlatformAdmin(normalizeSystemRole(user)),
          purgeEligibleAt: softDeleteFields.purgeEligibleAt,
        },
      });
      await enqueueLifecycleNotice(app, {
        entityType: 'project',
        entityId: params.projectId,
        eventType: 'project.soft_deleted',
        actorId,
        reason: 'project_deleted_by_tecma',
        purgeEligibleAt: String(softDeleteFields.purgeEligibleAt),
        recipients: [{ kind: 'tecma' }],
      });
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
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: projectGrantListAllowedSortFields },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const paginationParams = parsePaginationQuery(
        request.query,
        projectGrantListAllowedSortFields,
      );
      const filter = { project_id: params.projectId, ...activeAccessFilter };
      const totalDocs = await projectAccessRepo.count(filter);
      const grants = await projectAccessRepo.listPaginated(filter, {
        skip: buildMongoSkip(paginationParams),
        limit: paginationParams.perPage,
        sort: buildMongoSort(paginationParams, 'createdAt'),
      });
      return reply.send({
        data: grants,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.post(
    '/v1/projects/:projectId/access',
    {
      config: { rateLimit: projectsGrantCreateRateLimit(app.config) },
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
      const targetWorkspace = await workspacesRepo.findOne({
        _id: payload.workspaceId,
        ...activeFilter,
      });
      if (targetWorkspace == null) {
        return reply.status(404).send({
          error: {
            code: 'WorkspaceNotFound',
            message: 'Target workspace not found or not active',
            status: 404,
          },
        });
      }
      const grant = {
        _id: crypto.randomUUID(),
        project_id: params.projectId,
        workspace_id: payload.workspaceId,
        role: payload.role,
        created_at: new Date().toISOString(),
        status: 'active',
      };
      await projectAccessRepo.create(grant);
      await app.auditService.authEvent({
        eventType: 'projects.access_grant.create',
        userId: getJwtUser(request).sub ?? 'system',
        details: {
          projectId: params.projectId,
          workspaceId: payload.workspaceId,
          role: payload.role,
          grantId: grant._id,
        },
      });
      return reply.status(201).send({ data: grant });
    },
  );

  app.delete(
    '/v1/projects/:projectId/access/:grantId',
    {
      config: { rateLimit: projectsGrantDeleteRateLimit(app.config) },
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
      const grantRef = params.grantId;

      // Last-project-admin guard: prevent removal of the sole remaining owner grant.
      const adminGrants = await projectAccessRepo.findMany({
        project_id: params.projectId,
        role: 'owner',
        ...activeAccessFilter,
      });

      const targetById = await projectAccessRepo.findOne({
        _id: grantRef,
        project_id: params.projectId,
        ...activeAccessFilter,
      });
      const targets =
        targetById != null
          ? [targetById]
          : await projectAccessRepo.findMany({
              project_id: params.projectId,
              workspace_id: grantRef,
              ...activeAccessFilter,
            });

      if (targets.length === 0) {
        return reply.status(404).send({
          error: { code: 'GrantNotFound', message: 'Grant not found', status: 404 },
        });
      }

      const ownerTargets = targets.filter(
        (grant) => String((grant as { role?: unknown }).role) === 'owner',
      );
      if (ownerTargets.length > 0 && adminGrants.length <= ownerTargets.length) {
        return reply.status(409).send({
          error: {
            code: 'LastProjectAdmin',
            message: 'Cannot remove the last project admin grant',
            status: 409,
          },
        });
      }

      const now = new Date().toISOString();
      const actorId = getJwtUser(request).sub ?? 'system';
      const targetIds = targets.map((grant) => String((grant as { _id?: unknown })._id ?? ''));
      await projectAccessRepo.updateMany(
        {
          _id: { $in: targetIds },
          project_id: params.projectId,
          ...activeAccessFilter,
        } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            updatedAt: now,
          },
        } as any,
      );

      await app.auditService.authEvent({
        eventType: 'projects.access_grant.delete',
        userId: actorId,
        details: {
          projectId: params.projectId,
          grantIds: targetIds,
          deletedCount: targetIds.length,
        },
      });

      return reply.send({ data: { deleted: true, deletedCount: targetIds.length } });
    },
  );

  // -------------------------------------------------------------------------
  // Archive / Restore
  // -------------------------------------------------------------------------

  app.post(
    '/v1/projects/:projectId/archive',
    {
      preHandler: [app.authenticate],
      schema: {
        ...singleObjectSchema('archiveProject', 'Projects', 'Archivia progetto'),
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
      const now = new Date().toISOString();
      const actorId = user.sub ?? 'system';

      const project = await projectsRepo.findOne({
        _id: params.projectId,
        status: { $nin: ['deleted', 'deactivated', 'suspended'] },
      });
      if (!project) {
        return reply
          .status(404)
          .send({ error: { code: 'ProjectNotFound', message: 'Project not found', status: 404 } });
      }
      if ((project as { status?: string }).status === 'archived') {
        return reply.status(409).send({
          error: { code: 'AlreadyArchived', message: 'Project is already archived', status: 409 },
        });
      }
      if (!(await userCanManageProjectLifecycle(user, project))) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Project owner/admin role required to archive projects',
            status: 403,
          },
        });
      }

      await projectsRepo.updateOne(
        { _id: params.projectId },
        {
          $set: {
            status: 'archived',
            archivedAt: now,
            archivedBy: actorId,
            archiveReason: 'completed',
            updatedAt: now,
          },
        },
      );
      await app.auditService.authEvent({
        eventType: 'projects.archive',
        userId: actorId,
        details: { projectId: params.projectId },
      });
      return reply.send({ data: { archived: true } });
    },
  );

  app.post(
    '/v1/projects/:projectId/restore',
    {
      preHandler: [app.authenticate],
      schema: {
        ...singleObjectSchema('restoreProject', 'Projects', 'Ripristina progetto'),
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
      const now = new Date().toISOString();
      const actorId = user.sub ?? 'system';

      // Must find the archived doc — can't use activeFilter (it would still match archived).
      const project = await projectsRepo.findOne({ _id: params.projectId, status: 'archived' });
      if (!project) {
        // Distinguish "not found at all" vs "not archived".
        const anyDoc = await projectsRepo.findOne({ _id: params.projectId });
        if (!anyDoc) {
          return reply.status(404).send({
            error: { code: 'ProjectNotFound', message: 'Project not found', status: 404 },
          });
        }
        return reply.status(409).send({
          error: { code: 'NotArchived', message: 'Project is not archived', status: 409 },
        });
      }
      if (!(await userCanManageProjectLifecycle(user, project))) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Project owner/admin role required to restore archived projects',
            status: 403,
          },
        });
      }

      await projectsRepo.updateOne(
        { _id: params.projectId },
        {
          $set: { status: 'active', restoredAt: now, restoredBy: actorId, updatedAt: now },
          $unset: { archivedAt: '', archivedBy: '', archiveReason: '' },
        },
      );
      await app.auditService.authEvent({
        eventType: 'projects.restore',
        userId: actorId,
        details: { projectId: params.projectId },
      });
      return reply.send({ data: { restored: true } });
    },
  );

  app.post(
    '/v1/projects/:projectId/suspend',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...singleObjectSchema('suspendProject', 'Projects', 'Sospendi progetto'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            reason: { type: 'string', minLength: 1, maxLength: 120 },
            note: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const payload = lifecycleReasonSchema.parse(request.body ?? {});
      const user = getJwtUser(request);
      const now = new Date().toISOString();
      const actorId = user.sub ?? 'system';
      const project = await projectsRepo.findOne({ _id: params.projectId });
      if (project == null || String((project as { status?: unknown }).status) === 'deleted') {
        return reply.status(404).send({
          error: { code: 'ProjectNotFound', message: 'Project not found', status: 404 },
        });
      }
      if (String((project as { status?: unknown }).status) === 'suspended') {
        return reply.status(409).send({
          error: { code: 'AlreadySuspended', message: 'Project is already suspended', status: 409 },
        });
      }
      const reason = payload.reason ?? 'billing';
      await projectsRepo.updateOne(
        { _id: params.projectId },
        {
          $set: {
            status: 'suspended',
            suspendedAt: now,
            suspendedBy: actorId,
            suspendReason: reason,
            suspendNote: payload.note,
            updatedAt: now,
          },
        },
      );
      await app.auditService.authEvent({
        eventType: 'projects.suspend',
        userId: actorId,
        details: { projectId: params.projectId, reason },
      });
      await enqueueLifecycleNotice(app, {
        entityType: 'project',
        entityId: params.projectId,
        eventType: 'project.suspended',
        actorId,
        reason,
        recipients: [{ kind: 'tecma' }],
      });
      return reply.send({ data: { suspended: true } });
    },
  );

  app.post(
    '/v1/projects/:projectId/resume',
    {
      preHandler: [app.authenticate, app.requireTecmaAdmin()],
      schema: {
        ...singleObjectSchema('resumeProject', 'Projects', 'Riattiva progetto sospeso'),
        params: {
          type: 'object',
          required: ['projectId'],
          properties: { projectId: { type: 'string' } },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            reason: { type: 'string', minLength: 1, maxLength: 120 },
            note: { type: 'string', maxLength: 500 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { projectId: string };
      const payload = lifecycleReasonSchema.parse(request.body ?? {});
      const user = getJwtUser(request);
      const now = new Date().toISOString();
      const actorId = user.sub ?? 'system';
      const project = await projectsRepo.findOne({ _id: params.projectId });
      if (project == null || String((project as { status?: unknown }).status) === 'deleted') {
        return reply.status(404).send({
          error: { code: 'ProjectNotFound', message: 'Project not found', status: 404 },
        });
      }
      if (String((project as { status?: unknown }).status) !== 'suspended') {
        return reply.status(409).send({
          error: { code: 'NotSuspended', message: 'Project is not suspended', status: 409 },
        });
      }
      const workspaceId = normalizeToStringId(project.workspaceId ?? project.workspace_id);
      if (workspaceId != null) {
        const workspace = await workspacesRepo.findOne({
          ...mongoPrimaryKeyFilter(workspaceId),
          ...activeFilter,
        });
        if (workspace == null) {
          return reply.status(409).send({
            error: {
              code: 'ParentWorkspaceInactive',
              message: 'Cannot resume project while parent workspace is inactive',
              status: 409,
            },
          });
        }
      }

      await projectsRepo.updateOne(
        { _id: params.projectId },
        {
          $set: {
            status: 'active',
            resumedAt: now,
            resumedBy: actorId,
            resumeReason: payload.reason ?? 'manual',
            resumeNote: payload.note,
            updatedAt: now,
          },
          $unset: { suspendedAt: '', suspendedBy: '', suspendReason: '', suspendNote: '' },
        },
      );
      await app.auditService.authEvent({
        eventType: 'projects.resume',
        userId: actorId,
        details: { projectId: params.projectId, reason: payload.reason ?? 'manual' },
      });
      return reply.send({ data: { resumed: true } });
    },
  );

  app.get(
    '/v1/me/projects',
    {
      preHandler: [app.authenticate],
      schema: {
        ...listSchema('listMyProjects', 'Projects', 'Progetti accessibili dal token corrente'),
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: {
              type: 'string',
              enum: projectListAllowedSortFields as unknown as string[],
            },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const paginationParams = parsePaginationQuery(request.query, projectListAllowedSortFields);
      const user = getJwtUser(request);
      const isTecma = isTecmaPlatformAdmin(normalizeSystemRole(user));

      if (isTecma) {
        // Tecma admin sees all active projects.
        const totalDocs = await projectsRepo.count(activeFilter);
        const data = await projectsRepo.listPaginated(activeFilter, {
          skip: buildMongoSkip(paginationParams),
          limit: paginationParams.perPage,
          sort: buildMongoSort(paginationParams, 'name'),
        });
        return reply.send({
          data,
          paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
        });
      }

      // For normal users: union of workspace-member projects + direct grants.
      const identities = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
      if (identities.length === 0) {
        return reply.send({ data: [], paginationInfo: buildPaginationInfo(0, paginationParams) });
      }

      const projectIds = await listAccessibleProjectIdsForUser(app, identities);
      if (projectIds.length === 0) {
        return reply.send({ data: [], paginationInfo: buildPaginationInfo(0, paginationParams) });
      }

      const filter = {
        _id: { $in: projectIds },
        ...activeFilter,
      };
      const totalDocs = await projectsRepo.count(filter as any);
      const projects = await projectsRepo.listPaginated(filter as any, {
        skip: buildMongoSkip(paginationParams),
        limit: paginationParams.perPage,
        sort: buildMongoSort(paginationParams, 'name'),
      });
      return reply.send({
        data: projects,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
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
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: ['createdAt', 'updatedAt', 'projectId'] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const body = projectsByEmailBodySchema.parse(request.body ?? {});
      const paginationParams = parsePaginationQuery(request.query, [
        'createdAt',
        'updatedAt',
        'projectId',
      ] as const);
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
          const other = (await usersRepo.findOne({ email: normalized } as any)) as {
            _id: { toString: () => string };
          } | null;
          if (other == null) {
            return reply.send({
              data: [],
              paginationInfo: buildPaginationInfo(0, paginationParams),
            });
          }
          targetUserId = other._id.toString();
        }
      }

      const filter = {
        userId: targetUserId,
        ...(body.workspaceId != null ? { workspaceId: body.workspaceId } : {}),
        ...activeAccessFilter,
      };
      const [totalDocs, userProjects] = await Promise.all([
        workspaceUserProjectsRepo.count(filter as any),
        workspaceUserProjectsRepo.listPaginated(filter as any, {
          skip: buildMongoSkip(paginationParams),
          limit: paginationParams.perPage,
          sort: buildMongoSort(paginationParams, 'createdAt'),
        }),
      ]);
      return reply.send({
        data: userProjects,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
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
          additionalProperties: false,
          properties: {
            projectIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = sessionPreferencesSchema.parse(request.body ?? {});
      return reply.send({ data: { projectIds: payload.projectIds } });
    },
  );
};
