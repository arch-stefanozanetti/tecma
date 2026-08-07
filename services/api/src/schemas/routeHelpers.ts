import type { FastifySchema } from 'fastify';

const errorRef = { $ref: 'ErrorResponse#' };

const bearerSecurity = [{ ApiKeyAuth: [], BearerAuth: [] }];

/**
 * Schema policy 2026-05-11:
 * - envelope chiuso (`additionalProperties: false` sul root);
 * - `data` aperto solo nei helper generici per DTO resource evolutivi/legacy;
 * - route auth, token, secret, grant e mutazioni admin devono usare schema `data`
 *   specifici quando non passano da questi helper.
 *
 * Vedi `docs/API_SCHEMA_POLICY.md`.
 */

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
      additionalProperties: false,
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
      additionalProperties: false,
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
      additionalProperties: false,
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
      additionalProperties: false,
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
