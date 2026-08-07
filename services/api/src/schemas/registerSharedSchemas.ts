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
      hasPrevPage: { type: 'boolean', description: 'Indica se esiste una pagina precedente' },
      hasNextPage: { type: 'boolean', description: 'Indica se esiste una pagina successiva' },
      prevPage: { type: 'integer', nullable: true, description: 'Pagina precedente' },
      nextPage: { type: 'integer', nullable: true, description: 'Pagina successiva' },
    },
    additionalProperties: false,
  });

  await app.addSchema({
    $id: 'ErrorDetail',
    type: 'object',
    description: 'Dettaglio opzionale di validazione o diagnostica errore',
    properties: {
      field: { type: 'string', description: 'Campo che ha generato il dettaglio errore' },
      value: { description: 'Valore ricevuto, quando esponibile in sicurezza' },
      messageDetail: {
        type: 'array',
        description: 'Dettagli tecnici o di validazione normalizzati',
        items: { type: 'string' },
      },
    },
    additionalProperties: false,
  });

  await app.addSchema({
    $id: 'ErrorEnvelope',
    type: 'object',
    description: 'Envelope errore standard Followup',
    required: ['code', 'message', 'status'],
    properties: {
      code: { type: 'string', description: 'Codice errore' },
      message: { type: 'string', description: 'Messaggio sicuro per client e log applicativi' },
      status: { type: 'integer', description: 'Codice HTTP associato all’errore' },
      traceId: { type: 'string', description: 'ID transazione / tracing' },
      details: {
        type: 'array',
        description: 'Dettagli opzionali dell’errore',
        items: { $ref: 'ErrorDetail#' },
      },
    },
    additionalProperties: false,
  });

  await app.addSchema({
    $id: 'ErrorResponse',
    type: 'object',
    description: 'Risposta errore standard Followup',
    required: ['error'],
    properties: {
      error: { $ref: 'ErrorEnvelope#' },
    },
    additionalProperties: false,
  });
};
