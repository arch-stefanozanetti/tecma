import { randomUUID } from 'node:crypto';

import { isTecmaPlatformAdmin, normalizeSystemRole, PERMISSIONS } from '@followup/shared-rbac';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { badRequest, forbidden, notFound, sendApiError, unauthorized } from '../../lib/apiError.js';
import {
  activeAccessStatusFilter,
  activeMembershipStatusFilter,
  activeResourceStatusFilter,
  buildUserWorkspaceMembershipFilter,
  expandForStringOrObjectIdIn,
  mongoPrimaryKeyFilter,
  normalizeToStringId,
  workspaceIdFieldFilter,
} from '../../lib/mongoIdentity.js';
import { buildMongoSkip, buildMongoSort, buildPaginationInfo } from '../../lib/pagination.js';
import { resolveUserIdentityCandidates } from '../../lib/userIdentity.js';
import { createdObjectSchema, listSchema, singleObjectSchema } from '../../schemas/routeHelpers.js';

const requestStatuses = ['new', 'contacted', 'viewing', 'offer', 'won', 'lost'] as const;
const requestPriorities = ['low', 'medium', 'high'] as const;
const requestAllowedSortFields = [
  'createdAt',
  'updatedAt',
  'statusChangedAt',
  'status',
  'priority',
] as const;

type RequestStatus = (typeof requestStatuses)[number];
type JwtUser = {
  sub: string;
  email?: string;
  permissions?: string[];
  systemRole?: string;
  system_role?: string;
};

type RequestDocument = {
  _id: string;
  workspaceId: string;
  projectId: string;
  clientId: string;
  apartmentId?: string;
  title: string;
  status: RequestStatus;
  priority?: (typeof requestPriorities)[number];
  source?: string;
  notes?: string;
  assignedUserIds: string[];
  createdBy: string;
  statusChangedAt: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
};

const querySchema = z
  .object({
    workspaceId: z.string().min(1),
    projectIds: z.array(z.string().min(1)).optional(),
    status: z.enum(requestStatuses).optional(),
    statuses: z.array(z.enum(requestStatuses)).optional(),
    clientId: z.string().min(1).optional(),
    apartmentId: z.string().min(1).optional(),
    assignedUserId: z.string().min(1).optional(),
    searchText: z.string().max(120).optional(),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(20),
    sortField: z.enum(requestAllowedSortFields).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

const createSchema = z
  .object({
    workspaceId: z.string().min(1),
    projectId: z.string().min(1),
    clientId: z.string().min(1),
    apartmentId: z.string().min(1).optional(),
    title: z.string().min(1).max(180),
    status: z.enum(requestStatuses).default('new'),
    priority: z.enum(requestPriorities).optional(),
    source: z.string().max(120).optional(),
    notes: z.string().max(2000).optional(),
    assignedUserIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

const statusPatchSchema = z
  .object({
    status: z.enum(requestStatuses),
    notes: z.string().max(2000).optional(),
  })
  .strict();

const allowedTransitions: Record<RequestStatus, RequestStatus[]> = {
  new: ['contacted', 'lost'],
  contacted: ['viewing', 'offer', 'lost'],
  viewing: ['offer', 'won', 'lost'],
  offer: ['viewing', 'won', 'lost'],
  won: [],
  lost: [],
};

const getTraceId = (request: FastifyRequest): string | undefined =>
  typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined;

const isPlatformAdmin = (user: JwtUser | undefined): boolean =>
  user != null && isTecmaPlatformAdmin(normalizeSystemRole(user));

async function canAccessWorkspace(
  app: FastifyInstance,
  workspaceId: string,
  user: JwtUser | undefined,
): Promise<boolean> {
  if (user?.sub == null) return false;
  if (isPlatformAdmin(user)) return true;
  const identityCandidates = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
  const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
    ...buildUserWorkspaceMembershipFilter(workspaceId, identityCandidates),
    ...activeMembershipStatusFilter(),
  } as any);
  return membership != null;
}

async function assertWorkspaceActive(app: FastifyInstance, workspaceId: string): Promise<boolean> {
  const workspace = await app.mongoDb.collection('tz_workspaces').findOne({
    ...mongoPrimaryKeyFilter(workspaceId),
    ...activeResourceStatusFilter(),
  } as any);
  return workspace != null;
}

async function assertProjectInWorkspace(
  app: FastifyInstance,
  workspaceId: string,
  projectId: string,
): Promise<boolean> {
  const project = await app.mongoDb.collection('tz_projects').findOne({
    ...mongoPrimaryKeyFilter(projectId),
    ...activeResourceStatusFilter(),
  } as any);
  if (project == null) return false;
  const directWorkspaceId = normalizeToStringId((project as { workspaceId?: unknown }).workspaceId);
  if (directWorkspaceId === workspaceId) return true;
  const link = await app.mongoDb.collection('tz_workspace_projects').findOne({
    workspaceId,
    projectId,
    ...activeAccessStatusFilter(),
  } as any);
  return link != null;
}

async function assertClientInWorkspace(
  app: FastifyInstance,
  workspaceId: string,
  clientId: string,
): Promise<boolean> {
  const client = await app.mongoDb.collection('tz_clients').findOne({
    ...mongoPrimaryKeyFilter(clientId),
    ...workspaceIdFieldFilter(workspaceId),
    ...activeResourceStatusFilter(),
  } as any);
  return client != null;
}

async function assertApartmentInWorkspaceProject(
  app: FastifyInstance,
  workspaceId: string,
  projectId: string,
  apartmentId: string | undefined,
): Promise<boolean> {
  if (apartmentId == null) return true;
  const apartment = await app.mongoDb.collection('tz_apartments').findOne({
    ...mongoPrimaryKeyFilter(apartmentId),
    ...workspaceIdFieldFilter(workspaceId),
    ...activeResourceStatusFilter(),
  } as any);
  if (apartment == null) return false;
  return normalizeToStringId((apartment as { projectId?: unknown }).projectId) === projectId;
}

async function assertAssignedUsersInWorkspace(
  app: FastifyInstance,
  workspaceId: string,
  assignedUserIds: string[],
): Promise<boolean> {
  const ids = [...new Set(assignedUserIds)];
  if (ids.length === 0) return true;
  const count = await app.mongoDb.collection('tz_user_workspaces').countDocuments({
    ...workspaceIdFieldFilter(workspaceId),
    userId: { $in: expandForStringOrObjectIdIn(ids) },
    ...activeMembershipStatusFilter(),
  } as any);
  return count >= ids.length;
}

async function createTimelineEvent(
  app: FastifyInstance,
  input: {
    workspaceId: string;
    projectId?: string;
    entityType: 'client' | 'apartment' | 'request';
    entityId: string;
    type: 'note' | 'status_change' | 'system';
    title: string;
    description?: string;
    actorUserId: string;
    createdAt: string;
  },
): Promise<void> {
  await app.mongoDb.collection('tz_entity_timeline').insertOne({
    _id: randomUUID(),
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    entityType: input.entityType,
    entityId: input.entityId,
    type: input.type,
    title: input.title,
    description: input.description,
    actorUserId: input.actorUserId,
    status: 'active',
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  } as any);
}

async function enrichRequests(app: FastifyInstance, rows: RequestDocument[]) {
  const projectIds = [...new Set(rows.map((row) => row.projectId))];
  const clientIds = [...new Set(rows.map((row) => row.clientId))];
  const apartmentIds = [
    ...new Set(rows.map((row) => row.apartmentId).filter((id): id is string => id != null)),
  ];

  const [projects, clients, apartments] = await Promise.all([
    projectIds.length === 0
      ? []
      : app.mongoDb
          .collection('tz_projects')
          .find({ _id: { $in: expandForStringOrObjectIdIn(projectIds) } } as any)
          .toArray(),
    clientIds.length === 0
      ? []
      : app.mongoDb
          .collection('tz_clients')
          .find({ _id: { $in: expandForStringOrObjectIdIn(clientIds) } } as any)
          .toArray(),
    apartmentIds.length === 0
      ? []
      : app.mongoDb
          .collection('tz_apartments')
          .find({ _id: { $in: expandForStringOrObjectIdIn(apartmentIds) } } as any)
          .toArray(),
  ]);

  const projectMap = new Map(
    projects.map((project) => [normalizeToStringId(project._id), project]),
  );
  const clientMap = new Map(clients.map((client) => [normalizeToStringId(client._id), client]));
  const apartmentMap = new Map(
    apartments.map((apartment) => [normalizeToStringId(apartment._id), apartment]),
  );

  return rows.map((row) => {
    const project = projectMap.get(row.projectId) as
      | { name?: unknown; displayName?: unknown; code?: unknown }
      | undefined;
    const client = clientMap.get(row.clientId) as
      | { firstName?: unknown; lastName?: unknown; email?: unknown; fullName?: unknown }
      | undefined;
    const apartment =
      row.apartmentId != null
        ? (apartmentMap.get(row.apartmentId) as { name?: unknown; code?: unknown } | undefined)
        : undefined;
    const firstName = typeof client?.firstName === 'string' ? client.firstName : '';
    const lastName = typeof client?.lastName === 'string' ? client.lastName : '';
    const fullName =
      typeof client?.fullName === 'string' ? client.fullName : `${firstName} ${lastName}`.trim();
    return {
      ...row,
      projectName:
        typeof project?.displayName === 'string' && project.displayName.trim() !== ''
          ? project.displayName
          : typeof project?.name === 'string'
            ? project.name
            : undefined,
      projectCode: typeof project?.code === 'string' ? project.code : undefined,
      clientName: fullName !== '' ? fullName : undefined,
      clientEmail: typeof client?.email === 'string' ? client.email : undefined,
      apartmentName: typeof apartment?.name === 'string' ? apartment.name : undefined,
      apartmentCode: typeof apartment?.code === 'string' ? apartment.code : undefined,
    };
  });
}

function buildSearchFilter(searchText: string | undefined): Record<string, unknown> | null {
  const q = searchText?.trim();
  if (q == null || q === '') return null;
  const regex = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  return { $or: [{ title: regex }, { source: regex }, { notes: regex }] };
}

export async function requestsRoutes(app: FastifyInstance) {
  app.post(
    '/v1/requests/query',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.REQUESTS_READ)],
      schema: {
        ...listSchema('queryRequests', 'Requests', 'Query trattative'),
        body: {
          type: 'object',
          required: ['workspaceId'],
          additionalProperties: false,
          properties: {
            workspaceId: { type: 'string' },
            projectIds: { type: 'array', items: { type: 'string' } },
            status: { type: 'string', enum: [...requestStatuses] },
            statuses: { type: 'array', items: { type: 'string', enum: [...requestStatuses] } },
            clientId: { type: 'string' },
            apartmentId: { type: 'string' },
            assignedUserId: { type: 'string' },
            searchText: { type: 'string' },
            page: { type: 'integer', minimum: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100 },
            sortField: { type: 'string', enum: [...requestAllowedSortFields] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'] },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as JwtUser | undefined;
      const payload = querySchema.parse(request.body);
      if (!(await canAccessWorkspace(app, payload.workspaceId, user))) {
        return sendApiError(reply, forbidden('No access to this workspace'), getTraceId(request));
      }
      const pagination = {
        page: payload.page,
        perPage: payload.perPage,
        sortField: payload.sortField,
        sortOrder: payload.sortOrder,
      };
      const filter: Record<string, unknown> = {
        ...workspaceIdFieldFilter(payload.workspaceId),
        ...activeResourceStatusFilter(),
      };
      if (payload.projectIds != null && payload.projectIds.length > 0) {
        filter.projectId = { $in: payload.projectIds };
      }
      const statuses = payload.statuses ?? (payload.status != null ? [payload.status] : []);
      if (statuses.length > 0) filter.status = { $in: statuses };
      if (payload.clientId != null) filter.clientId = payload.clientId;
      if (payload.apartmentId != null) filter.apartmentId = payload.apartmentId;
      if (payload.assignedUserId != null) filter.assignedUserIds = payload.assignedUserId;
      const searchFilter = buildSearchFilter(payload.searchText);
      const finalFilter = searchFilter != null ? { $and: [filter, searchFilter] } : filter;
      const [totalDocs, rows] = await Promise.all([
        app.mongoDb.collection<RequestDocument>('tz_requests').countDocuments(finalFilter as any),
        app.mongoDb
          .collection<RequestDocument>('tz_requests')
          .find(finalFilter as any)
          .sort(buildMongoSort(pagination, 'updatedAt'))
          .skip(buildMongoSkip(pagination))
          .limit(pagination.perPage)
          .toArray(),
      ]);
      return reply.send({
        data: await enrichRequests(app, rows),
        paginationInfo: buildPaginationInfo(totalDocs, pagination),
      });
    },
  );

  app.post(
    '/v1/requests',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.REQUESTS_CREATE)],
      schema: {
        ...createdObjectSchema('createRequest', 'Requests', 'Crea trattativa'),
        body: {
          type: 'object',
          required: ['workspaceId', 'projectId', 'clientId', 'title'],
          additionalProperties: false,
          properties: {
            workspaceId: { type: 'string' },
            projectId: { type: 'string' },
            clientId: { type: 'string' },
            apartmentId: { type: 'string' },
            title: { type: 'string', minLength: 1, maxLength: 180 },
            status: { type: 'string', enum: [...requestStatuses] },
            priority: { type: 'string', enum: [...requestPriorities] },
            source: { type: 'string', maxLength: 120 },
            notes: { type: 'string', maxLength: 2000 },
            assignedUserIds: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) return sendApiError(reply, unauthorized(), getTraceId(request));
      const payload = createSchema.parse(request.body);
      if (!(await canAccessWorkspace(app, payload.workspaceId, user))) {
        return sendApiError(reply, forbidden('No access to this workspace'), getTraceId(request));
      }
      if (!(await assertWorkspaceActive(app, payload.workspaceId))) {
        return sendApiError(
          reply,
          notFound('Workspace not found or not active'),
          getTraceId(request),
        );
      }
      if (!(await assertProjectInWorkspace(app, payload.workspaceId, payload.projectId))) {
        return sendApiError(
          reply,
          badRequest('Project must belong to active workspace'),
          getTraceId(request),
        );
      }
      if (!(await assertClientInWorkspace(app, payload.workspaceId, payload.clientId))) {
        return sendApiError(
          reply,
          badRequest('Client must belong to workspace'),
          getTraceId(request),
        );
      }
      if (
        !(await assertApartmentInWorkspaceProject(
          app,
          payload.workspaceId,
          payload.projectId,
          payload.apartmentId,
        ))
      ) {
        return sendApiError(
          reply,
          badRequest('Apartment must belong to the same workspace and project'),
          getTraceId(request),
        );
      }
      if (
        !(await assertAssignedUsersInWorkspace(app, payload.workspaceId, payload.assignedUserIds))
      ) {
        return sendApiError(
          reply,
          badRequest('Assigned users must belong to workspace'),
          getTraceId(request),
        );
      }
      const now = new Date().toISOString();
      const doc: RequestDocument = {
        _id: randomUUID(),
        workspaceId: payload.workspaceId,
        projectId: payload.projectId,
        clientId: payload.clientId,
        ...(payload.apartmentId != null ? { apartmentId: payload.apartmentId } : {}),
        title: payload.title.trim(),
        status: payload.status,
        ...(payload.priority != null ? { priority: payload.priority } : {}),
        ...(payload.source != null ? { source: payload.source.trim() } : {}),
        ...(payload.notes != null ? { notes: payload.notes.trim() } : {}),
        assignedUserIds: [...new Set(payload.assignedUserIds)],
        createdBy: user.sub,
        statusChangedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await app.mongoDb.collection<RequestDocument>('tz_requests').insertOne(doc);
      await Promise.all([
        createTimelineEvent(app, {
          workspaceId: doc.workspaceId,
          projectId: doc.projectId,
          entityType: 'request',
          entityId: doc._id,
          type: 'system',
          title: 'Trattativa creata',
          actorUserId: user.sub,
          createdAt: now,
        }),
        createTimelineEvent(app, {
          workspaceId: doc.workspaceId,
          projectId: doc.projectId,
          entityType: 'client',
          entityId: doc.clientId,
          type: 'system',
          title: `Trattativa creata: ${doc.title}`,
          actorUserId: user.sub,
          createdAt: now,
        }),
        doc.apartmentId != null
          ? createTimelineEvent(app, {
              workspaceId: doc.workspaceId,
              projectId: doc.projectId,
              entityType: 'apartment',
              entityId: doc.apartmentId,
              type: 'system',
              title: `Trattativa creata: ${doc.title}`,
              actorUserId: user.sub,
              createdAt: now,
            })
          : Promise.resolve(),
      ]);
      await app.auditService.authEvent({
        eventType: 'requests.create',
        userId: user.sub,
        details: { workspaceId: doc.workspaceId, requestId: doc._id, status: doc.status },
      });
      return reply.status(201).send({ data: (await enrichRequests(app, [doc]))[0] });
    },
  );

  app.get(
    '/v1/requests/:requestId',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.REQUESTS_READ)],
      schema: {
        ...singleObjectSchema('getRequest', 'Requests', 'Dettaglio trattativa'),
        params: {
          type: 'object',
          required: ['requestId'],
          properties: { requestId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as JwtUser | undefined;
      const { requestId } = request.params as { requestId: string };
      const doc = await app.mongoDb.collection<RequestDocument>('tz_requests').findOne({
        ...mongoPrimaryKeyFilter(requestId),
        ...activeResourceStatusFilter(),
      } as any);
      if (doc == null)
        return sendApiError(reply, notFound('Request not found'), getTraceId(request));
      if (!(await canAccessWorkspace(app, doc.workspaceId, user))) {
        return sendApiError(reply, forbidden('No access to this workspace'), getTraceId(request));
      }
      return reply.send({ data: (await enrichRequests(app, [doc]))[0] });
    },
  );

  app.patch(
    '/v1/requests/:requestId/status',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.REQUESTS_UPDATE)],
      schema: {
        ...singleObjectSchema('updateRequestStatus', 'Requests', 'Aggiorna stato trattativa'),
        params: {
          type: 'object',
          required: ['requestId'],
          properties: { requestId: { type: 'string' } },
        },
        body: {
          type: 'object',
          required: ['status'],
          additionalProperties: false,
          properties: {
            status: { type: 'string', enum: [...requestStatuses] },
            notes: { type: 'string', maxLength: 2000 },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) return sendApiError(reply, unauthorized(), getTraceId(request));
      const { requestId } = request.params as { requestId: string };
      const payload = statusPatchSchema.parse(request.body);
      const current = await app.mongoDb.collection<RequestDocument>('tz_requests').findOne({
        ...mongoPrimaryKeyFilter(requestId),
        ...activeResourceStatusFilter(),
      } as any);
      if (current == null)
        return sendApiError(reply, notFound('Request not found'), getTraceId(request));
      if (!(await canAccessWorkspace(app, current.workspaceId, user))) {
        return sendApiError(reply, forbidden('No access to this workspace'), getTraceId(request));
      }
      if (
        payload.status !== current.status &&
        !allowedTransitions[current.status].includes(payload.status)
      ) {
        return sendApiError(
          reply,
          badRequest('Invalid request status transition'),
          getTraceId(request),
        );
      }
      const now = new Date().toISOString();
      await app.mongoDb
        .collection<RequestDocument>('tz_requests')
        .updateOne({ _id: current._id } as any, {
          $set: {
            status: payload.status,
            ...(payload.notes != null ? { notes: payload.notes.trim() } : {}),
            statusChangedAt: now,
            updatedAt: now,
          },
        });
      const updated = {
        ...current,
        status: payload.status,
        ...(payload.notes != null ? { notes: payload.notes.trim() } : {}),
        statusChangedAt: now,
        updatedAt: now,
      };
      await Promise.all([
        createTimelineEvent(app, {
          workspaceId: current.workspaceId,
          projectId: current.projectId,
          entityType: 'request',
          entityId: current._id,
          type: 'status_change',
          title: `Stato trattativa: ${current.status} → ${payload.status}`,
          description: payload.notes,
          actorUserId: user.sub,
          createdAt: now,
        }),
        createTimelineEvent(app, {
          workspaceId: current.workspaceId,
          projectId: current.projectId,
          entityType: 'client',
          entityId: current.clientId,
          type: 'status_change',
          title: `Trattativa “${current.title}”: ${current.status} → ${payload.status}`,
          description: payload.notes,
          actorUserId: user.sub,
          createdAt: now,
        }),
        current.apartmentId != null
          ? createTimelineEvent(app, {
              workspaceId: current.workspaceId,
              projectId: current.projectId,
              entityType: 'apartment',
              entityId: current.apartmentId,
              type: 'status_change',
              title: `Trattativa “${current.title}”: ${current.status} → ${payload.status}`,
              description: payload.notes,
              actorUserId: user.sub,
              createdAt: now,
            })
          : Promise.resolve(),
      ]);
      await app.auditService.authEvent({
        eventType: 'requests.status.update',
        userId: user.sub,
        details: {
          workspaceId: current.workspaceId,
          requestId: current._id,
          from: current.status,
          to: payload.status,
        },
      });
      return reply.send({ data: (await enrichRequests(app, [updated]))[0] });
    },
  );
}
