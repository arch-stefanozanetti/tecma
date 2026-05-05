import type { FastifyInstance } from 'fastify';

/** Schemi JSON condivisi per OpenAPI / serializzazione route (`$ref` in Fastify). */
export const registerSharedSchemas = async (app: FastifyInstance): Promise<void> => {
  await app.addSchema({
    $id: 'PaginationInfo',
    type: 'object',
    description: 'Metadati paginazione standard TECMA',
    required: ['totalDocs', 'page', 'perPage', 'totalPages', 'hasPrevPage', 'hasNextPage'],
    properties: {
      totalDocs: { type: 'integer', minimum: 0, description: 'Totale documenti' },
      page: { type: 'integer', minimum: 1, description: 'Pagina corrente (1-based)' },
      perPage: { type: 'integer', minimum: 1, description: 'Elementi per pagina' },
      totalPages: { type: 'integer', minimum: 0, description: 'Numero pagine' },
      hasPrevPage: { type: 'boolean' },
      hasNextPage: { type: 'boolean' },
      prevPage: { type: 'integer', nullable: true, description: 'Pagina precedente' },
      nextPage: { type: 'integer', nullable: true, description: 'Pagina successiva' },
    },
  });

  await app.addSchema({
    $id: 'ErrorDetail',
    type: 'object',
    properties: {
      field: { type: 'string' },
      value: {},
      messageDetail: { type: 'array', items: { type: 'string' } },
    },
  });

  await app.addSchema({
    $id: 'ErrorEnvelope',
    type: 'object',
    required: ['code', 'message', 'status'],
    properties: {
      code: { type: 'string', description: 'Codice errore' },
      message: { type: 'string' },
      status: { type: 'integer' },
      traceId: { type: 'string', description: 'ID transazione / tracing' },
      details: { type: 'array', items: { $ref: 'ErrorDetail#' } },
    },
  });

  await app.addSchema({
    $id: 'ErrorResponse',
    type: 'object',
    required: ['error'],
    properties: {
      error: { $ref: 'ErrorEnvelope#' },
    },
  });
};
