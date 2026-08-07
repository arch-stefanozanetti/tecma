import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';

import { stringify } from 'yaml';

import { buildServer } from '../server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type OpenApiNode = Record<string, unknown>;

const isRecord = (value: unknown): value is OpenApiNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const cloneNode = (value: unknown): OpenApiNode => JSON.parse(JSON.stringify(value)) as OpenApiNode;

const normalizeRef = (value: unknown, schemaNamesByDef: Map<string, string>): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const match = value.match(/^#\/components\/schemas\/(def-\d+)$/);
  if (!match) {
    return value;
  }

  const defName = match[1];
  if (!defName) {
    return value;
  }

  const schemaName = schemaNamesByDef.get(defName);
  return schemaName ? `#/components/schemas/${schemaName}` : value;
};

const addDefaultDescriptions = (node: unknown, fallback = 'Campo dello schema API'): void => {
  if (!isRecord(node)) {
    return;
  }

  if (node.$ref) {
    return;
  }

  if (node.properties && isRecord(node.properties)) {
    for (const [propertyName, propertySchema] of Object.entries(node.properties)) {
      if (isRecord(propertySchema) && !propertySchema.$ref && !propertySchema.description) {
        propertySchema.description = `Campo ${propertyName}`;
      }
      addDefaultDescriptions(propertySchema, `Campo ${propertyName}`);
    }
  }

  if (node.items) {
    addDefaultDescriptions(node.items, fallback);
  }

  if (node.allOf && Array.isArray(node.allOf)) {
    node.allOf.forEach((item) => addDefaultDescriptions(item, fallback));
  }
  if (node.oneOf && Array.isArray(node.oneOf)) {
    node.oneOf.forEach((item) => addDefaultDescriptions(item, fallback));
  }
  if (node.anyOf && Array.isArray(node.anyOf)) {
    node.anyOf.forEach((item) => addDefaultDescriptions(item, fallback));
  }
};

const rewriteRefs = (node: unknown, schemaNamesByDef: Map<string, string>): void => {
  if (Array.isArray(node)) {
    node.forEach((item) => rewriteRefs(item, schemaNamesByDef));
    return;
  }

  if (!isRecord(node)) {
    return;
  }

  if (node.$ref) {
    node.$ref = normalizeRef(node.$ref, schemaNamesByDef);
  }

  Object.values(node).forEach((value) => rewriteRefs(value, schemaNamesByDef));
};

const parameterDescription = (parameter: OpenApiNode): string => {
  const name = String(parameter.name ?? 'parametro');
  const location = String(parameter.in ?? 'request');
  return `Parametro ${name} in ${location}`;
};

const ensureResponse = (responses: OpenApiNode, status: string, description: string): void => {
  if (responses[status]) {
    return;
  }

  responses[status] = {
    description,
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  };
};

const hardenOpenApiSpec = (spec: OpenApiNode): OpenApiNode => {
  const components = isRecord(spec.components) ? spec.components : {};
  spec.components = components;
  const schemas = isRecord(components.schemas) ? components.schemas : {};
  components.schemas = schemas;

  const schemaNamesByDef = new Map<string, string>();
  const defSchemaKeys: string[] = [];
  for (const [schemaKey, schema] of Object.entries(schemas)) {
    if (!isRecord(schema) || typeof schema.title !== 'string') {
      continue;
    }

    schemaNamesByDef.set(schemaKey, schema.title);
    if (schemaKey.startsWith('def-')) {
      defSchemaKeys.push(schemaKey);
    }
    if (!schemas[schema.title]) {
      schemas[schema.title] = cloneNode(schema);
    }
  }
  defSchemaKeys.forEach((schemaKey) => {
    delete schemas[schemaKey];
  });

  if (!schemas.ErrorEnvelope) {
    schemas.ErrorEnvelope = {
      type: 'object',
      description: 'Envelope errore standard Followup',
      required: ['code', 'message', 'status'],
      properties: {
        code: { type: 'string', description: 'Codice errore' },
        message: { type: 'string', description: 'Messaggio sicuro per il client' },
        status: { type: 'integer', description: 'Codice HTTP associato' },
        traceId: { type: 'string', description: 'ID tracing richiesta' },
        details: {
          type: 'array',
          description: 'Dettagli opzionali',
          items: { type: 'object', description: 'Dettaglio errore' },
        },
      },
    };
  }
  if (!schemas.ErrorResponse) {
    schemas.ErrorResponse = {
      type: 'object',
      description: 'Risposta errore standard Followup',
      required: ['error'],
      properties: {
        error: { $ref: '#/components/schemas/ErrorEnvelope' },
      },
    };
  }

  rewriteRefs(spec, schemaNamesByDef);
  Object.values(schemas).forEach((schema) => addDefaultDescriptions(schema));

  const paths = isRecord(spec.paths) ? spec.paths : {};
  for (const pathItem of Object.values(paths)) {
    if (!isRecord(pathItem)) {
      continue;
    }

    for (const operation of Object.values(pathItem)) {
      if (!isRecord(operation) || !operation.responses || !isRecord(operation.responses)) {
        continue;
      }

      if (Array.isArray(operation.security) && operation.security.length === 0) {
        delete operation.security;
      }

      if (Array.isArray(operation.parameters)) {
        operation.parameters.forEach((parameter) => {
          if (isRecord(parameter) && !parameter.description) {
            parameter.description = parameterDescription(parameter);
          }
        });
      }

      const responses = operation.responses;
      if (operation.security) {
        ensureResponse(responses, '401', 'Sessione mancante o non valida');
      }
      ensureResponse(responses, '500', 'Errore interno');
    }
  }

  return spec;
};

const run = async (): Promise<void> => {
  process.env.OPENAPI_GENERATE = '1';
  const app = await buildServer();
  await app.ready();
  const spec = hardenOpenApiSpec((await app.swagger()) as OpenApiNode);

  const outDir = path.resolve(__dirname, '../../openapi');
  await mkdir(outDir, { recursive: true });
  const target = path.join(outDir, 'openapi.v1.yaml');
  await writeFile(target, stringify(spec, { lineWidth: 120 }), 'utf8');

  await app.close();
};

void run();
