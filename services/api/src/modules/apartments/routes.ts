import { isTecmaPlatformAdmin, normalizeSystemRole, PERMISSIONS } from '@followup/shared-rbac';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { badRequest, forbidden, notFound, sendApiError, unauthorized } from '../../lib/apiError.js';
import {
  activeMembershipStatusFilter,
  activeResourceStatusFilter,
  buildUserWorkspaceMembershipFilter,
  mongoPrimaryKeyFilter,
  normalizeToStringId,
  workspaceIdFieldFilter,
} from '../../lib/mongoIdentity.js';
import { listSchema } from '../../schemas/routeHelpers.js';
import { resolveUserIdentityCandidates } from '../../lib/userIdentity.js';
import {
  createMonthlyRent,
  listMonthlyRents,
  monthlyRentPatchSchema,
  monthlyRentSchema,
  resolveCurrentMonthlyRent,
  updateMonthlyRent,
} from './monthlyRents.js';
import { assertWorkspaceMembership, mapApartmentRow, queryApartments } from './queryApartments.js';
import {
  createSalePrice,
  listSalePrices,
  resolveCurrentSalePrice,
  salePricePatchSchema,
  salePriceSchema,
  updateSalePrice,
} from './salePrices.js';
import { getInventory, inventoryPatchSchema, updateInventory } from './inventory.js';
import {
  listPriceCalendar,
  priceCalendarQuerySchema,
  priceCalendarUpsertSchema,
  upsertPriceCalendar,
} from './priceCalendar.js';

type JwtUser = {
  sub: string;
  email?: string;
  systemRole?: string;
  system_role?: string;
};

const getTraceId = (request: FastifyRequest): string | undefined =>
  typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined;

const apartmentBodySchema = z
  .object({
    workspaceId: z.string().min(1),
    projectId: z.string().min(1),
    name: z.string().min(1).max(180),
    code: z.string().min(1).max(80),
    mode: z.enum(['RENT', 'SELL']),
    status: z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED']),
    price: z.coerce.number().min(0).optional(),
    deposit: z.coerce.number().min(0).optional(),
    floor: z.coerce.number().optional(),
    surfaceMq: z.coerce.number().min(0).optional(),
    planimetryUrl: z.string().url().optional().or(z.literal('')),
    planimetryAssetId: z.string().min(1).optional().or(z.literal('')),
    tags: z.array(z.string().min(1)).default([]),
    plan: z.unknown().optional(),
    building: z.unknown().optional(),
    sides: z.unknown().optional(),
    extraInfo: z.unknown().optional(),
  })
  .strict();

const apartmentPatchSchema = apartmentBodySchema
  .partial()
  .extend({ workspaceId: z.string().min(1) })
  .strict();

type ApartmentWriteBody = z.infer<typeof apartmentBodySchema>;
type ApartmentDoc = Record<string, unknown>;

const errorResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['error'],
  properties: {
    error: {
      type: 'object',
      additionalProperties: true,
      required: ['code', 'message', 'status'],
      properties: {
        code: { type: 'string' },
        message: { type: 'string' },
        status: { type: 'integer' },
      },
    },
  },
} as const;

const protectedApartmentResponses = {
  401: errorResponseSchema,
  403: errorResponseSchema,
  500: errorResponseSchema,
} as const;

const apartmentParamsSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['apartmentId'],
  properties: { apartmentId: { type: 'string', minLength: 1 } },
} as const;

const workspaceQuerySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['workspaceId'],
  properties: { workspaceId: { type: 'string', minLength: 1 } },
} as const;

const dataResponseSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['data'],
  properties: { data: {} },
} as const;

const apartmentBodyJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['workspaceId', 'projectId', 'name', 'code', 'mode', 'status'],
  properties: {
    workspaceId: { type: 'string' },
    projectId: { type: 'string' },
    name: { type: 'string', minLength: 1 },
    code: { type: 'string', minLength: 1 },
    mode: { type: 'string', enum: ['RENT', 'SELL'] },
    status: { type: 'string', enum: ['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED'] },
    price: { type: 'number', minimum: 0 },
    deposit: { type: 'number', minimum: 0 },
    floor: { type: 'number' },
    surfaceMq: { type: 'number', minimum: 0 },
    planimetryUrl: { type: 'string' },
    planimetryAssetId: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    plan: {},
    building: {},
    sides: {},
    extraInfo: {},
  },
} as const;

const apartmentPatchJsonSchema = {
  ...apartmentBodyJsonSchema,
  required: ['workspaceId'],
} as const;

const priceWorkspaceBodySchema = {
  type: 'object',
  additionalProperties: true,
  required: ['workspaceId'],
  properties: { workspaceId: { type: 'string', minLength: 1 } },
} as const;

async function assertWorkspaceActive(app: FastifyInstance, workspaceId: string): Promise<boolean> {
  const workspace = await app.mongoDb.collection('tz_workspaces').findOne({
    ...mongoPrimaryKeyFilter(workspaceId),
    ...activeResourceStatusFilter(),
  });
  return workspace != null;
}

async function assertProjectInActiveWorkspace(
  app: FastifyInstance,
  workspaceId: string,
  projectId: string,
): Promise<boolean> {
  const project = await app.mongoDb.collection('tz_projects').findOne({
    ...mongoPrimaryKeyFilter(projectId),
    ...activeResourceStatusFilter(),
  });
  if (project == null) return false;

  const projectWorkspaceId = normalizeToStringId(
    (project as { workspaceId?: unknown }).workspaceId,
  );
  if (projectWorkspaceId === workspaceId) return true;

  const link = await app.mongoDb.collection('tz_workspace_projects').findOne({
    ...workspaceIdFieldFilter(workspaceId),
    projectId,
    ...activeResourceStatusFilter(),
  });
  return link != null;
}

async function assertAssetInWorkspace(
  app: FastifyInstance,
  workspaceId: string,
  assetId: string | undefined,
): Promise<boolean> {
  if (assetId == null || assetId.trim() === '') return true;
  const asset = await app.mongoDb.collection('tz_assets').findOne({
    ...mongoPrimaryKeyFilter(assetId.trim()),
    ...workspaceIdFieldFilter(workspaceId),
    status: 'active',
  });
  return asset != null;
}

async function assertWorkspaceManager(
  app: FastifyInstance,
  workspaceId: string,
  viewer: { sub: string; email?: string; systemRole?: string },
): Promise<boolean> {
  if (isTecmaPlatformAdmin(normalizeSystemRole(viewer.systemRole ?? ''))) return true;
  const identityCandidates = await resolveUserIdentityCandidates(app, [viewer.sub, viewer.email]);
  const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
    ...buildUserWorkspaceMembershipFilter(workspaceId, identityCandidates),
    role: { $in: ['owner', 'admin'] },
    ...activeMembershipStatusFilter(),
  });
  return membership != null;
}

async function assertApartmentContext(
  app: FastifyInstance,
  workspaceId: string,
  apartmentId: string,
): Promise<{ apartment: ApartmentDoc; projectId: string } | null> {
  const apartment = await app.mongoDb.collection('tz_apartments').findOne({
    ...mongoPrimaryKeyFilter(apartmentId),
    ...workspaceIdFieldFilter(workspaceId),
    ...activeResourceStatusFilter(),
  });
  if (apartment == null) return null;
  const projectId = normalizeToStringId((apartment as { projectId?: unknown }).projectId);
  if (projectId == null) return null;
  const projectActive = await assertProjectInActiveWorkspace(app, workspaceId, projectId);
  if (!projectActive) return null;
  return { apartment: apartment as ApartmentDoc, projectId };
}

async function assertApartmentRead(
  app: FastifyInstance,
  request: FastifyRequest,
  workspaceId: string,
): Promise<{ user: JwtUser; allowed: true } | { allowed: false; reason: 'auth' | 'forbidden' }> {
  const user = request.user as JwtUser | undefined;
  if (user?.sub == null) return { allowed: false, reason: 'auth' };
  const allowed = await assertWorkspaceMembership(app, workspaceId, {
    sub: user.sub,
    email: user.email,
    systemRole: user.systemRole ?? user.system_role,
  });
  if (!allowed) return { allowed: false, reason: 'forbidden' };
  return { user, allowed: true };
}

async function assertApartmentManage(
  app: FastifyInstance,
  request: FastifyRequest,
  workspaceId: string,
): Promise<{ user: JwtUser; allowed: true } | { allowed: false; reason: 'auth' | 'forbidden' }> {
  const user = request.user as JwtUser | undefined;
  if (user?.sub == null) return { allowed: false, reason: 'auth' };
  const allowed = await assertWorkspaceManager(app, workspaceId, {
    sub: user.sub,
    email: user.email,
    systemRole: user.systemRole ?? user.system_role,
  });
  if (!allowed) return { allowed: false, reason: 'forbidden' };
  return { user, allowed: true };
}

function buildApartmentInsert(body: ApartmentWriteBody, now: string): Record<string, unknown> {
  return {
    _id: new ObjectId(),
    workspaceId: body.workspaceId,
    projectId: body.projectId,
    name: body.name.trim(),
    code: body.code.trim(),
    mode: body.mode,
    status: body.status,
    ...(body.price != null
      ? { price: body.price, rawPrice: { mode: body.mode, amount: body.price } }
      : {}),
    ...(body.deposit != null ? { deposit: body.deposit } : {}),
    ...(body.floor != null ? { floor: body.floor } : {}),
    ...(body.surfaceMq != null ? { surfaceMq: body.surfaceMq } : {}),
    ...(body.planimetryUrl != null && body.planimetryUrl !== ''
      ? { planimetryUrl: body.planimetryUrl }
      : {}),
    ...(body.planimetryAssetId != null && body.planimetryAssetId !== ''
      ? { planimetryAssetId: body.planimetryAssetId }
      : {}),
    tags: body.tags,
    ...(body.plan !== undefined ? { plan: body.plan } : {}),
    ...(body.building !== undefined ? { building: body.building } : {}),
    ...(body.sides !== undefined ? { sides: body.sides } : {}),
    ...(body.extraInfo !== undefined ? { extraInfo: body.extraInfo } : {}),
    createdAt: now,
    updatedAt: now,
  };
}

function buildApartmentPatch(
  body: z.infer<typeof apartmentPatchSchema>,
  now: string,
): Record<string, unknown> {
  const patch: Record<string, unknown> = { updatedAt: now };
  for (const field of [
    'projectId',
    'name',
    'code',
    'mode',
    'status',
    'price',
    'deposit',
    'floor',
    'surfaceMq',
    'tags',
    'plan',
    'building',
    'sides',
    'extraInfo',
  ] as const) {
    if (body[field] !== undefined) patch[field] = body[field];
  }
  if (body.planimetryUrl !== undefined) {
    patch.planimetryUrl = body.planimetryUrl;
  }
  if (body.planimetryAssetId !== undefined) {
    patch.planimetryAssetId = body.planimetryAssetId;
  }
  if (body.price !== undefined) {
    patch.rawPrice = { mode: body.mode ?? 'SELL', amount: body.price };
  }
  return patch;
}

export const apartmentsRoutes = async (app: FastifyInstance) => {
  app.post(
    '/v1/apartments/query',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_READ)],
      schema: {
        ...listSchema(
          'queryApartments',
          'Apartments',
          'Lista appartamenti per workspace e progetti',
        ),
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['workspaceId', 'projectIds'],
          properties: {
            workspaceId: { type: 'string', description: 'Workspace id' },
            projectIds: {
              type: 'array',
              items: { type: 'string' },
              minItems: 1,
              description: 'Progetti nel perimetro',
            },
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
            searchText: { type: 'string', description: 'Ricerca su nome/codice' },
            sort: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                direction: { type: 'integer' },
              },
            },
            filters: {
              type: 'object',
              properties: {
                status: { type: 'array', items: { type: 'string' } },
                mode: { type: 'array', items: { type: 'string' } },
                priceMin: { type: 'number', minimum: 0 },
                priceMax: { type: 'number', minimum: 0 },
                surfaceMin: { type: 'number', minimum: 0 },
                surfaceMax: { type: 'number', minimum: 0 },
                floorMin: { type: 'number' },
                floorMax: { type: 'number' },
                tags: { type: 'array', items: { type: 'string' } },
                hasPlanimetry: { type: 'boolean' },
                hasGallery: { type: 'boolean' },
                hasAdvancedData: { type: 'boolean' },
                buildingName: { type: 'string' },
                typology: { type: 'string' },
                roomsMin: { type: 'number', minimum: 0 },
                roomsMax: { type: 'number', minimum: 0 },
              },
            },
          },
        },
        response: {
          200: dataResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as { workspaceId?: string };
      const workspaceId = body.workspaceId?.trim() ?? '';
      if (workspaceId === '') {
        return sendApiError(reply, badRequest('workspaceId is required'), getTraceId(request));
      }

      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) {
        return sendApiError(reply, unauthorized(), getTraceId(request));
      }

      const allowed = await assertWorkspaceMembership(app, workspaceId, {
        sub: user.sub,
        email: user.email,
        systemRole: user.systemRole ?? user.system_role,
      });
      if (!allowed) {
        return sendApiError(reply, forbidden('Workspace access required'), getTraceId(request));
      }

      const collection = app.mongoDb.collection('tz_apartments');
      const result = await queryApartments(
        {
          collection: collection as Parameters<typeof queryApartments>[0]['collection'],
          assignmentsCollection: app.mongoDb.collection(
            'tz_workspace_entity_assignments',
          ) as Parameters<typeof queryApartments>[0]['assignmentsCollection'],
          viewer: {
            sub: user.sub,
            email: user.email,
            systemRole: user.systemRole ?? user.system_role,
          },
          applyEntityAssignmentFilter: true,
        },
        request.body,
      );

      return reply.send(result);
    },
  );

  app.post(
    '/v1/apartments',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_CREATE)],
      schema: {
        tags: ['Apartments'],
        operationId: 'createApartment',
        summary: 'Crea appartamento',
        description: 'Crea un appartamento nel workspace/progetto attivo.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        body: apartmentBodyJsonSchema,
        response: {
          201: dataResponseSchema,
          400: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) return sendApiError(reply, unauthorized(), getTraceId(request));
      const parsed = apartmentBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return sendApiError(reply, badRequest('Invalid apartment payload'), getTraceId(request));
      }
      const body = parsed.data;
      const viewer = {
        sub: user.sub,
        email: user.email,
        systemRole: user.systemRole ?? user.system_role,
      };
      const canManage = await assertWorkspaceManager(app, body.workspaceId, viewer);
      if (!canManage)
        return sendApiError(
          reply,
          forbidden('Workspace admin access required'),
          getTraceId(request),
        );
      if (!(await assertWorkspaceActive(app, body.workspaceId))) {
        return sendApiError(
          reply,
          badRequest('Workspace not found or not active'),
          getTraceId(request),
        );
      }
      if (!(await assertProjectInActiveWorkspace(app, body.workspaceId, body.projectId))) {
        return sendApiError(
          reply,
          badRequest('Project not found in active workspace'),
          getTraceId(request),
        );
      }
      if (!(await assertAssetInWorkspace(app, body.workspaceId, body.planimetryAssetId))) {
        return sendApiError(
          reply,
          badRequest('Floor plan asset not found in workspace'),
          getTraceId(request),
        );
      }

      const collection = app.mongoDb.collection('tz_apartments');
      const duplicate = await collection.findOne({
        ...workspaceIdFieldFilter(body.workspaceId),
        projectId: body.projectId,
        $or: [{ code: body.code.trim() }, { name: body.name.trim() }],
        ...activeResourceStatusFilter(),
      });
      if (duplicate != null) {
        return sendApiError(
          reply,
          badRequest('Apartment code or name already exists'),
          getTraceId(request),
        );
      }

      const now = new Date().toISOString();
      const doc = buildApartmentInsert(body, now);
      await collection.insertOne(doc);
      await app.auditService.authEvent({
        eventType: 'apartments.create',
        userId: user.sub,
        workspaceId: body.workspaceId,
        projectId: body.projectId,
        details: {
          apartmentId: mapApartmentRow(doc)._id,
          code: body.code,
        },
      });
      return reply.code(201).send({ data: mapApartmentRow(doc) });
    },
  );

  app.get(
    '/v1/apartments/:apartmentId',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_READ)],
      schema: {
        tags: ['Apartments'],
        operationId: 'getApartmentById',
        summary: 'Dettaglio appartamento',
        description: 'Restituisce un appartamento nel workspace richiesto.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: apartmentParamsSchema,
        querystring: workspaceQuerySchema,
        response: {
          200: dataResponseSchema,
          400: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) return sendApiError(reply, unauthorized(), getTraceId(request));
      const params = request.params as { apartmentId?: string };
      const query = request.query as { workspaceId?: string };
      const workspaceId = query.workspaceId?.trim() ?? '';
      const apartmentId = params.apartmentId?.trim() ?? '';
      if (workspaceId === '' || apartmentId === '') {
        return sendApiError(
          reply,
          badRequest('workspaceId and apartmentId are required'),
          getTraceId(request),
        );
      }
      const allowed = await assertWorkspaceMembership(app, workspaceId, {
        sub: user.sub,
        email: user.email,
        systemRole: user.systemRole ?? user.system_role,
      });
      if (!allowed)
        return sendApiError(reply, forbidden('Workspace access required'), getTraceId(request));

      const doc = await app.mongoDb.collection('tz_apartments').findOne({
        ...mongoPrimaryKeyFilter(apartmentId),
        ...workspaceIdFieldFilter(workspaceId),
        ...activeResourceStatusFilter(),
      });
      if (doc == null)
        return sendApiError(reply, badRequest('Apartment not found'), getTraceId(request));
      return reply.send({ data: mapApartmentRow(doc as Record<string, unknown>) });
    },
  );

  app.patch(
    '/v1/apartments/:apartmentId',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_UPDATE)],
      schema: {
        tags: ['Apartments'],
        operationId: 'patchApartment',
        summary: 'Aggiorna appartamento',
        description: 'Aggiorna i campi principali di un appartamento.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: apartmentParamsSchema,
        body: apartmentPatchJsonSchema,
        response: {
          200: dataResponseSchema,
          400: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) return sendApiError(reply, unauthorized(), getTraceId(request));
      const params = request.params as { apartmentId?: string };
      const apartmentId = params.apartmentId?.trim() ?? '';
      const parsed = apartmentPatchSchema.safeParse(request.body);
      if (!parsed.success || apartmentId === '') {
        return sendApiError(reply, badRequest('Invalid apartment patch'), getTraceId(request));
      }
      const body = parsed.data;
      const viewer = {
        sub: user.sub,
        email: user.email,
        systemRole: user.systemRole ?? user.system_role,
      };
      const canManage = await assertWorkspaceManager(app, body.workspaceId, viewer);
      if (!canManage)
        return sendApiError(
          reply,
          forbidden('Workspace admin access required'),
          getTraceId(request),
        );
      if (!(await assertWorkspaceActive(app, body.workspaceId))) {
        return sendApiError(
          reply,
          badRequest('Workspace not found or not active'),
          getTraceId(request),
        );
      }
      const current = await app.mongoDb.collection('tz_apartments').findOne({
        ...mongoPrimaryKeyFilter(apartmentId),
        ...workspaceIdFieldFilter(body.workspaceId),
        ...activeResourceStatusFilter(),
      });
      if (current == null)
        return sendApiError(reply, badRequest('Apartment not found'), getTraceId(request));
      const projectId =
        body.projectId ?? String((current as { projectId?: unknown }).projectId ?? '');
      if (!(await assertProjectInActiveWorkspace(app, body.workspaceId, projectId))) {
        return sendApiError(
          reply,
          badRequest('Project not found in active workspace'),
          getTraceId(request),
        );
      }
      if (!(await assertAssetInWorkspace(app, body.workspaceId, body.planimetryAssetId))) {
        return sendApiError(
          reply,
          badRequest('Floor plan asset not found in workspace'),
          getTraceId(request),
        );
      }

      const now = new Date().toISOString();
      if (body.price !== undefined && body.mode === undefined) {
        body.mode = String((current as { mode?: unknown }).mode ?? 'SELL') as 'RENT' | 'SELL';
      }
      const patch = buildApartmentPatch(body, now);
      await app.mongoDb
        .collection('tz_apartments')
        .updateOne(
          { ...mongoPrimaryKeyFilter(apartmentId), ...workspaceIdFieldFilter(body.workspaceId) },
          { $set: patch },
        );
      const updated = await app.mongoDb.collection('tz_apartments').findOne({
        ...mongoPrimaryKeyFilter(apartmentId),
        ...workspaceIdFieldFilter(body.workspaceId),
      });
      await app.auditService.authEvent({
        eventType: 'apartments.update',
        userId: user.sub,
        workspaceId: body.workspaceId,
        projectId,
        details: {
          apartmentId,
        },
      });
      return reply.send({ data: mapApartmentRow(updated as Record<string, unknown>) });
    },
  );

  app.get(
    '/v1/apartments/:apartmentId/prices',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_READ)],
      schema: {
        tags: ['Apartments'],
        operationId: 'listApartmentPrices',
        summary: 'Prezzi appartamento',
        description: 'Restituisce prezzo corrente, storico prezzi vendita e canoni.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: apartmentParamsSchema,
        querystring: workspaceQuerySchema,
        response: {
          200: dataResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { apartmentId?: string };
      const query = request.query as { workspaceId?: string };
      const apartmentId = params.apartmentId?.trim() ?? '';
      const workspaceId = query.workspaceId?.trim() ?? '';
      if (apartmentId === '' || workspaceId === '') {
        return sendApiError(
          reply,
          badRequest('workspaceId and apartmentId are required'),
          getTraceId(request),
        );
      }
      const auth = await assertApartmentRead(app, request, workspaceId);
      if (!auth.allowed) {
        return sendApiError(
          reply,
          auth.reason === 'auth' ? unauthorized() : forbidden('Workspace access required'),
          getTraceId(request),
        );
      }
      const context = await assertApartmentContext(app, workspaceId, apartmentId);
      if (context == null) {
        return sendApiError(reply, notFound('Apartment not found'), getTraceId(request));
      }
      const [salePrices, monthlyRents] = await Promise.all([
        listSalePrices(app.mongoDb.collection('tz_sale_prices'), apartmentId, workspaceId),
        listMonthlyRents(app.mongoDb.collection('tz_monthly_rents'), apartmentId, workspaceId),
      ]);
      const apartment = mapApartmentRow(context.apartment);
      const currentSale = resolveCurrentSalePrice(salePrices);
      const currentRent = resolveCurrentMonthlyRent(monthlyRents);
      const current =
        apartment.mode === 'RENT'
          ? {
              type: 'monthlyRent',
              value: currentRent?.pricePerMonth ?? apartment.price ?? null,
              source: currentRent == null ? 'apartment' : 'monthlyRent',
              currency: 'EUR',
            }
          : {
              type: 'salePrice',
              value: currentSale?.price ?? apartment.price ?? null,
              source: currentSale == null ? 'apartment' : 'salePrice',
              currency: 'EUR',
            };
      return reply.send({ data: { current, salePrices, monthlyRents } });
    },
  );

  app.post(
    '/v1/apartments/:apartmentId/prices/sale',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_UPDATE)],
      schema: {
        tags: ['Apartments'],
        operationId: 'createApartmentSalePrice',
        summary: 'Crea prezzo vendita',
        description: 'Aggiunge un prezzo vendita valido per l appartamento.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: apartmentParamsSchema,
        body: priceWorkspaceBodySchema,
        response: {
          201: dataResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const apartmentId = ((request.params as { apartmentId?: string }).apartmentId ?? '').trim();
      const parsed = salePriceSchema.safeParse(request.body);
      if (!parsed.success || apartmentId === '') {
        return sendApiError(reply, badRequest('Invalid sale price payload'), getTraceId(request));
      }
      const auth = await assertApartmentManage(app, request, parsed.data.workspaceId);
      if (!auth.allowed) {
        return sendApiError(
          reply,
          auth.reason === 'auth' ? unauthorized() : forbidden('Workspace admin access required'),
          getTraceId(request),
        );
      }
      const context = await assertApartmentContext(app, parsed.data.workspaceId, apartmentId);
      if (context == null) {
        return sendApiError(reply, notFound('Apartment not found'), getTraceId(request));
      }
      const salePrice = await createSalePrice(
        app.mongoDb.collection('tz_sale_prices'),
        apartmentId,
        parsed.data,
      );
      await app.auditService.authEvent({
        eventType: 'apartment.sale_price.created',
        userId: auth.user.sub,
        workspaceId: parsed.data.workspaceId,
        projectId: context.projectId,
        details: { apartmentId, priceId: salePrice._id, price: salePrice.price },
      });
      return reply.code(201).send({ data: salePrice });
    },
  );

  app.patch(
    '/v1/apartments/:apartmentId/prices/sale/:priceId',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_UPDATE)],
      schema: {
        tags: ['Apartments'],
        operationId: 'patchApartmentSalePrice',
        summary: 'Aggiorna prezzo vendita',
        description: 'Aggiorna un prezzo vendita esistente.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['apartmentId', 'priceId'],
          properties: {
            apartmentId: { type: 'string', minLength: 1 },
            priceId: { type: 'string', minLength: 1 },
          },
        },
        body: priceWorkspaceBodySchema,
        response: {
          200: dataResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { apartmentId?: string; priceId?: string };
      const apartmentId = params.apartmentId?.trim() ?? '';
      const priceId = params.priceId?.trim() ?? '';
      const parsed = salePricePatchSchema.safeParse(request.body);
      if (!parsed.success || apartmentId === '' || priceId === '') {
        return sendApiError(reply, badRequest('Invalid sale price patch'), getTraceId(request));
      }
      const auth = await assertApartmentManage(app, request, parsed.data.workspaceId);
      if (!auth.allowed) {
        return sendApiError(
          reply,
          auth.reason === 'auth' ? unauthorized() : forbidden('Workspace admin access required'),
          getTraceId(request),
        );
      }
      const context = await assertApartmentContext(app, parsed.data.workspaceId, apartmentId);
      if (context == null) {
        return sendApiError(reply, notFound('Apartment not found'), getTraceId(request));
      }
      const salePrice = await updateSalePrice(
        app.mongoDb.collection('tz_sale_prices'),
        apartmentId,
        priceId,
        parsed.data,
      );
      if (salePrice == null) {
        return sendApiError(reply, notFound('Sale price not found'), getTraceId(request));
      }
      await app.auditService.authEvent({
        eventType: 'apartment.sale_price.updated',
        userId: auth.user.sub,
        workspaceId: parsed.data.workspaceId,
        projectId: context.projectId,
        details: { apartmentId, priceId: salePrice._id, price: salePrice.price },
      });
      return reply.send({ data: salePrice });
    },
  );

  app.post(
    '/v1/apartments/:apartmentId/prices/monthly-rent',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_UPDATE)],
      schema: {
        tags: ['Apartments'],
        operationId: 'createApartmentMonthlyRent',
        summary: 'Crea canone mensile',
        description: 'Aggiunge un canone mensile valido per l appartamento.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: apartmentParamsSchema,
        body: priceWorkspaceBodySchema,
        response: {
          201: dataResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const apartmentId = ((request.params as { apartmentId?: string }).apartmentId ?? '').trim();
      const parsed = monthlyRentSchema.safeParse(request.body);
      if (!parsed.success || apartmentId === '') {
        return sendApiError(reply, badRequest('Invalid monthly rent payload'), getTraceId(request));
      }
      const auth = await assertApartmentManage(app, request, parsed.data.workspaceId);
      if (!auth.allowed) {
        return sendApiError(
          reply,
          auth.reason === 'auth' ? unauthorized() : forbidden('Workspace admin access required'),
          getTraceId(request),
        );
      }
      const context = await assertApartmentContext(app, parsed.data.workspaceId, apartmentId);
      if (context == null) {
        return sendApiError(reply, notFound('Apartment not found'), getTraceId(request));
      }
      const monthlyRent = await createMonthlyRent(
        app.mongoDb.collection('tz_monthly_rents'),
        apartmentId,
        parsed.data,
      );
      await app.auditService.authEvent({
        eventType: 'apartment.monthly_rent.created',
        userId: auth.user.sub,
        workspaceId: parsed.data.workspaceId,
        projectId: context.projectId,
        details: {
          apartmentId,
          rentId: monthlyRent._id,
          pricePerMonth: monthlyRent.pricePerMonth,
        },
      });
      return reply.code(201).send({ data: monthlyRent });
    },
  );

  app.patch(
    '/v1/apartments/:apartmentId/prices/monthly-rent/:rentId',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_UPDATE)],
      schema: {
        tags: ['Apartments'],
        operationId: 'patchApartmentMonthlyRent',
        summary: 'Aggiorna canone mensile',
        description: 'Aggiorna un canone mensile esistente.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['apartmentId', 'rentId'],
          properties: {
            apartmentId: { type: 'string', minLength: 1 },
            rentId: { type: 'string', minLength: 1 },
          },
        },
        body: priceWorkspaceBodySchema,
        response: {
          200: dataResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { apartmentId?: string; rentId?: string };
      const apartmentId = params.apartmentId?.trim() ?? '';
      const rentId = params.rentId?.trim() ?? '';
      const parsed = monthlyRentPatchSchema.safeParse(request.body);
      if (!parsed.success || apartmentId === '' || rentId === '') {
        return sendApiError(reply, badRequest('Invalid monthly rent patch'), getTraceId(request));
      }
      const auth = await assertApartmentManage(app, request, parsed.data.workspaceId);
      if (!auth.allowed) {
        return sendApiError(
          reply,
          auth.reason === 'auth' ? unauthorized() : forbidden('Workspace admin access required'),
          getTraceId(request),
        );
      }
      const context = await assertApartmentContext(app, parsed.data.workspaceId, apartmentId);
      if (context == null) {
        return sendApiError(reply, notFound('Apartment not found'), getTraceId(request));
      }
      const monthlyRent = await updateMonthlyRent(
        app.mongoDb.collection('tz_monthly_rents'),
        apartmentId,
        rentId,
        parsed.data,
      );
      if (monthlyRent == null) {
        return sendApiError(reply, notFound('Monthly rent not found'), getTraceId(request));
      }
      await app.auditService.authEvent({
        eventType: 'apartment.monthly_rent.updated',
        userId: auth.user.sub,
        workspaceId: parsed.data.workspaceId,
        projectId: context.projectId,
        details: {
          apartmentId,
          rentId: monthlyRent._id,
          pricePerMonth: monthlyRent.pricePerMonth,
        },
      });
      return reply.send({ data: monthlyRent });
    },
  );

  app.get(
    '/v1/apartments/:apartmentId/inventory',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_READ)],
      schema: {
        tags: ['Apartments'],
        operationId: 'getApartmentInventory',
        summary: 'Disponibilita appartamento',
        description: 'Restituisce lo stato inventory dell appartamento.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: apartmentParamsSchema,
        querystring: workspaceQuerySchema,
        response: {
          200: dataResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const apartmentId = ((request.params as { apartmentId?: string }).apartmentId ?? '').trim();
      const workspaceId = ((request.query as { workspaceId?: string }).workspaceId ?? '').trim();
      if (apartmentId === '' || workspaceId === '') {
        return sendApiError(
          reply,
          badRequest('workspaceId and apartmentId are required'),
          getTraceId(request),
        );
      }
      const auth = await assertApartmentRead(app, request, workspaceId);
      if (!auth.allowed) {
        return sendApiError(
          reply,
          auth.reason === 'auth' ? unauthorized() : forbidden('Workspace access required'),
          getTraceId(request),
        );
      }
      const context = await assertApartmentContext(app, workspaceId, apartmentId);
      if (context == null) {
        return sendApiError(reply, notFound('Apartment not found'), getTraceId(request));
      }
      const inventory = await getInventory(
        app.mongoDb.collection('tz_inventory'),
        apartmentId,
        workspaceId,
      );
      return reply.send({ data: inventory });
    },
  );

  app.patch(
    '/v1/apartments/:apartmentId/inventory',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_UPDATE)],
      schema: {
        tags: ['Apartments'],
        operationId: 'patchApartmentInventory',
        summary: 'Aggiorna disponibilita appartamento',
        description: 'Aggiorna lo stato inventory dell appartamento.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: apartmentParamsSchema,
        body: priceWorkspaceBodySchema,
        response: {
          200: dataResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const apartmentId = ((request.params as { apartmentId?: string }).apartmentId ?? '').trim();
      const parsed = inventoryPatchSchema.safeParse(request.body);
      if (!parsed.success || apartmentId === '') {
        return sendApiError(reply, badRequest('Invalid inventory payload'), getTraceId(request));
      }
      const auth = await assertApartmentManage(app, request, parsed.data.workspaceId);
      if (!auth.allowed) {
        return sendApiError(
          reply,
          auth.reason === 'auth' ? unauthorized() : forbidden('Workspace admin access required'),
          getTraceId(request),
        );
      }
      const context = await assertApartmentContext(app, parsed.data.workspaceId, apartmentId);
      if (context == null) {
        return sendApiError(reply, notFound('Apartment not found'), getTraceId(request));
      }
      const inventory = await updateInventory(
        app.mongoDb.collection('tz_inventory'),
        apartmentId,
        parsed.data,
      );
      await app.auditService.authEvent({
        eventType: 'apartment.inventory.updated',
        userId: auth.user.sub,
        workspaceId: parsed.data.workspaceId,
        projectId: context.projectId,
        details: {
          apartmentId,
          inventoryStatus: inventory.inventoryStatus,
          requestId: inventory.requestId,
        },
      });
      return reply.send({ data: inventory });
    },
  );

  app.get(
    '/v1/apartments/:apartmentId/prices/calendar',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_READ)],
      schema: {
        tags: ['Apartments'],
        operationId: 'listApartmentPriceCalendar',
        summary: 'Calendario prezzi appartamento',
        description: 'Restituisce prezzi e disponibilita calendario per range date.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: apartmentParamsSchema,
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['workspaceId', 'from', 'to'],
          properties: {
            workspaceId: { type: 'string', minLength: 1 },
            from: { type: 'string' },
            to: { type: 'string' },
          },
        },
        response: {
          200: dataResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const apartmentId = ((request.params as { apartmentId?: string }).apartmentId ?? '').trim();
      const parsed = priceCalendarQuerySchema.safeParse(request.query);
      if (!parsed.success || apartmentId === '') {
        return sendApiError(reply, badRequest('Invalid calendar query'), getTraceId(request));
      }
      const auth = await assertApartmentRead(app, request, parsed.data.workspaceId);
      if (!auth.allowed) {
        return sendApiError(
          reply,
          auth.reason === 'auth' ? unauthorized() : forbidden('Workspace access required'),
          getTraceId(request),
        );
      }
      const context = await assertApartmentContext(app, parsed.data.workspaceId, apartmentId);
      if (context == null) {
        return sendApiError(reply, notFound('Apartment not found'), getTraceId(request));
      }
      const entries = await listPriceCalendar(
        app.mongoDb.collection('tz_price_calendar'),
        apartmentId,
        parsed.data,
      );
      return reply.send({ data: entries });
    },
  );

  app.put(
    '/v1/apartments/:apartmentId/prices/calendar',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_UPDATE)],
      schema: {
        tags: ['Apartments'],
        operationId: 'putApartmentPriceCalendar',
        summary: 'Aggiorna calendario prezzi appartamento',
        description: 'Inserisce o aggiorna entries calendario prezzo/disponibilita.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: apartmentParamsSchema,
        body: priceWorkspaceBodySchema,
        response: {
          200: dataResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          ...protectedApartmentResponses,
        },
      },
    },
    async (request, reply) => {
      const apartmentId = ((request.params as { apartmentId?: string }).apartmentId ?? '').trim();
      const parsed = priceCalendarUpsertSchema.safeParse(request.body);
      if (!parsed.success || apartmentId === '') {
        return sendApiError(reply, badRequest('Invalid calendar payload'), getTraceId(request));
      }
      const auth = await assertApartmentManage(app, request, parsed.data.workspaceId);
      if (!auth.allowed) {
        return sendApiError(
          reply,
          auth.reason === 'auth' ? unauthorized() : forbidden('Workspace admin access required'),
          getTraceId(request),
        );
      }
      const context = await assertApartmentContext(app, parsed.data.workspaceId, apartmentId);
      if (context == null) {
        return sendApiError(reply, notFound('Apartment not found'), getTraceId(request));
      }
      const entries = await upsertPriceCalendar(
        app.mongoDb.collection('tz_price_calendar'),
        apartmentId,
        parsed.data,
      );
      await app.auditService.authEvent({
        eventType: 'apartment.price_calendar.upserted',
        userId: auth.user.sub,
        workspaceId: parsed.data.workspaceId,
        projectId: context.projectId,
        details: { apartmentId, count: entries.length },
      });
      return reply.send({ data: entries });
    },
  );
};
