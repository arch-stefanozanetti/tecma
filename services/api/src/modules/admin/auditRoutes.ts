import { z } from 'zod';

import type { FastifyInstance } from 'fastify';

import { buildPaginationInfo, parsePaginationQuery } from '../../lib/pagination.js';
import { listSchema } from '../../schemas/routeHelpers.js';

const auditSortFields = ['createdAt', 'eventType'] as const;

const auditQuerySchema = z.object({
  workspaceId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  sortField: z.enum(auditSortFields).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const adminAuditRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get(
    '/v1/admin/audit-events',
    {
      preHandler: [app.authenticate, app.requireSystemRole('tecma_admin')],
      schema: {
        ...listSchema(
          'listAdminAuditEvents',
          'Admin',
          'Audit events',
          'Elenco audit eventi platform, accessibile solo a Tecma SuperAdmin.',
        ),
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            workspaceId: { type: 'string', minLength: 1 },
            userId: { type: 'string', minLength: 1 },
            eventType: { type: 'string', minLength: 1 },
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: [...auditSortFields] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        },
      },
    },
    async (request, reply) => {
      const query = auditQuerySchema.parse(request.query);
      const { page, perPage, sortField, sortOrder, ...filters } = query;
      const paginationParams = parsePaginationQuery(
        { page, perPage, sortField, sortOrder },
        auditSortFields,
      );
      const { data, totalDocs } = await app.auditService.listAuthEventsPaginated(
        filters,
        paginationParams,
      );
      return reply.send({
        data,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );
};
