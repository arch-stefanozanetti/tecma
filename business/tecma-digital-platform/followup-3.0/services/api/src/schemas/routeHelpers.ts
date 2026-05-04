import type { FastifySchema } from 'fastify';

const errorRef = { $ref: 'ErrorResponse#' };

const bearerSecurity = [{ ApiKeyAuth: [], BearerAuth: [] }];

/** Lista con `data` + `paginationInfo` (TECMA). */
export const listSchema = (
  operationId: string,
  tag: string,
  summary: string,
  description?: string,
): FastifySchema => ({
  tags: [tag],
  summary,
  description: description ?? summary,
  operationId,
  security: bearerSecurity,
  response: {
    200: {
      type: 'object',
      required: ['data', 'paginationInfo'],
      properties: {
        data: { type: 'array', items: { type: 'object', additionalProperties: true } },
        paginationInfo: { $ref: 'PaginationInfo#' },
      },
    },
    401: errorRef,
    403: errorRef,
    500: errorRef,
  },
});

export const singleObjectSchema = (
  operationId: string,
  tag: string,
  summary: string,
  description?: string,
): FastifySchema => ({
  tags: [tag],
  summary,
  description: description ?? summary,
  operationId,
  security: bearerSecurity,
  response: {
    200: {
      type: 'object',
      required: ['data'],
      properties: {
        data: { type: 'object', additionalProperties: true },
      },
    },
    401: errorRef,
    403: errorRef,
    404: errorRef,
    500: errorRef,
  },
});

export const createdObjectSchema = (
  operationId: string,
  tag: string,
  summary: string,
): FastifySchema => ({
  tags: [tag],
  summary,
  description: summary,
  operationId,
  security: bearerSecurity,
  response: {
    201: {
      type: 'object',
      required: ['data'],
      properties: {
        data: { type: 'object', additionalProperties: true },
      },
    },
    400: errorRef,
    401: errorRef,
    403: errorRef,
    500: errorRef,
  },
});

export const okDeletedSchema = (
  operationId: string,
  tag: string,
  summary: string,
): FastifySchema => ({
  tags: [tag],
  summary,
  description: summary,
  operationId,
  security: bearerSecurity,
  response: {
    200: {
      type: 'object',
      required: ['data'],
      properties: {
        data: { type: 'object', additionalProperties: true },
      },
    },
    401: errorRef,
    403: errorRef,
    404: errorRef,
    500: errorRef,
  },
});
