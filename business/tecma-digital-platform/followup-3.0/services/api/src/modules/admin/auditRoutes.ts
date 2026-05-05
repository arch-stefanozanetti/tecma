import { z } from 'zod';

import type { FastifyInstance } from 'fastify';

import { listSchema } from '../../schemas/routeHelpers.js';

const auditQuerySchema = z.object({
  workspaceId: z.string().min(1).optional(),
  userId: z.string().min(1).optional(),
  eventType: z.string().min(1).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(500).optional(),
});

export const adminAuditRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get(
    '/v1/admin/audit-events',
    {
      preHandler: [app.authenticate, app.requireSystemRole('tecma_admin')],
      schema: listSchema(
        'listAdminAuditEvents',
        'Admin',
        'Audit events',
        'Elenco audit eventi platform, accessibile solo a Tecma SuperAdmin.',
      ),
    },
    async (request, reply) => {
      const filters = auditQuerySchema.parse(request.query);
      const data = await app.auditService.listAuthEvents(filters);
      return reply.send({
        data,
        paginationInfo: {
          totalDocs: data.length,
          page: 1,
          perPage: data.length,
          totalPages: data.length > 0 ? 1 : 0,
          hasPrevPage: false,
          hasNextPage: false,
          prevPage: null,
          nextPage: null,
        },
      });
    },
  );
};
