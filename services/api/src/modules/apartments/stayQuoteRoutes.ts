import { PERMISSIONS } from '@followup/shared-rbac';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { badRequest, forbidden, notFound, sendApiError, unauthorized } from '../../lib/apiError.js';
import {
  activeResourceStatusFilter,
  mongoPrimaryKeyFilter,
  workspaceIdFieldFilter,
} from '../../lib/mongoIdentity.js';
import { listMonthlyRents, resolveCurrentMonthlyRent } from './monthlyRents.js';
import { listPriceCalendar } from './priceCalendar.js';
import { assertWorkspaceMembership } from './queryApartments.js';
import { buildStayQuote, stayQuoteQuerySchema } from './stayQuote.js';

type JwtUser = {
  sub: string;
  email?: string;
  systemRole?: string;
  system_role?: string;
};

const NIGHTS_PER_MONTH = 30;

const getTraceId = (request: FastifyRequest): string | undefined =>
  typeof request.headers['x-request-id'] === 'string' ? request.headers['x-request-id'] : undefined;

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

const dataResponseSchema = {
  type: 'object',
  additionalProperties: true,
  required: ['data'],
  properties: { data: {} },
} as const;

/** Prezzo di fallback per notte: canone mensile corrente / 30, altrimenti prezzo unita. */
const resolveFallbackPricePerNight = async (
  app: FastifyInstance,
  apartment: Record<string, unknown>,
  apartmentId: string,
  workspaceId: string,
): Promise<number | null> => {
  const monthlyRents = await listMonthlyRents(
    app.mongoDb.collection('tz_monthly_rents'),
    apartmentId,
    workspaceId,
  );
  const currentRent = resolveCurrentMonthlyRent(monthlyRents);
  const monthly =
    currentRent?.pricePerMonth ??
    (typeof apartment.price === 'number' && apartment.mode === 'RENT' ? apartment.price : null);
  if (monthly == null || monthly <= 0) return null;
  return Math.round((monthly / NIGHTS_PER_MONTH) * 100) / 100;
};

export const apartmentStayQuoteRoutes = async (app: FastifyInstance): Promise<void> => {
  /** Preventivo soggiorno rent su calendario prezzi stagionali. */
  app.get(
    '/v1/apartments/:apartmentId/prices/quote',
    {
      preHandler: [app.authenticate, app.requirePermission(PERMISSIONS.APARTMENTS_READ)],
      schema: {
        tags: ['Apartments'],
        operationId: 'getApartmentStayQuote',
        summary: 'Preventivo soggiorno',
        description:
          'Calcola totale, media per notte, min stay e blocchi disponibilita per un soggiorno rent.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: {
          type: 'object',
          additionalProperties: false,
          required: ['apartmentId'],
          properties: { apartmentId: { type: 'string', minLength: 1 } },
        },
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: ['workspaceId', 'checkIn', 'checkOut'],
          properties: {
            workspaceId: { type: 'string', minLength: 1 },
            checkIn: { type: 'string', description: 'Data check-in (YYYY-MM-DD)' },
            checkOut: { type: 'string', description: 'Data check-out esclusa (YYYY-MM-DD)' },
            guests: { type: 'integer', minimum: 1, maximum: 30 },
          },
        },
        response: {
          200: dataResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          500: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const apartmentId = ((request.params as { apartmentId?: string }).apartmentId ?? '').trim();
      const parsed = stayQuoteQuerySchema.safeParse(request.query);
      if (!parsed.success || apartmentId === '') {
        return sendApiError(reply, badRequest('Invalid stay quote query'), getTraceId(request));
      }
      const { workspaceId, checkIn, checkOut } = parsed.data;

      const user = request.user as JwtUser | undefined;
      if (user?.sub == null) return sendApiError(reply, unauthorized(), getTraceId(request));
      const allowed = await assertWorkspaceMembership(app, workspaceId, {
        sub: user.sub,
        email: user.email,
        systemRole: user.systemRole ?? user.system_role,
      });
      if (!allowed) {
        return sendApiError(reply, forbidden('Workspace access required'), getTraceId(request));
      }

      const apartment = await app.mongoDb.collection('tz_apartments').findOne({
        ...mongoPrimaryKeyFilter(apartmentId),
        ...workspaceIdFieldFilter(workspaceId),
        ...activeResourceStatusFilter(),
      });
      if (apartment == null) {
        return sendApiError(reply, notFound('Apartment not found'), getTraceId(request));
      }

      const lastNight = new Date(new Date(`${checkOut}T00:00:00.000Z`).getTime() - 86_400_000)
        .toISOString()
        .slice(0, 10);
      const entries = await listPriceCalendar(
        app.mongoDb.collection('tz_price_calendar'),
        apartmentId,
        { workspaceId, from: checkIn, to: lastNight },
      );
      const fallbackPricePerNight = await resolveFallbackPricePerNight(
        app,
        apartment as Record<string, unknown>,
        apartmentId,
        workspaceId,
      );

      const quote = buildStayQuote({
        input: { checkIn, checkOut },
        entries,
        fallbackPricePerNight,
      });

      return reply.send({
        data: {
          apartmentId,
          workspaceId,
          ...quote,
          fallbackPricePerNight,
        },
      });
    },
  );
};
