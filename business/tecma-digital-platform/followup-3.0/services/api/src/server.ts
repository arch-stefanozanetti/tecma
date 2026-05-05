import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

import fastify from 'fastify';
import type { Db } from 'mongodb';

import { FollowupMongoClient, ensureCoreIndexes } from '@followup/db';
import { appLogger } from '@followup/logger';
import { loadEnv, type AppConfig } from '@followup/shared-config';

import './types.js';
import { initSentry, installRequestContextHooks } from './infra/observability.js';
import { adminAuditRoutes } from './modules/admin/auditRoutes.js';
import { assetsRoutes } from './modules/assets/routes.js';
import { AuditService } from './modules/auditService.js';
import { createMailPort } from './modules/mail/createMailPort.js';
import { authRoutes } from './modules/auth/routes.js';
import { projectsRoutes } from './modules/projects/routes.js';
import { rbacRoutes } from './modules/rbac/routes.js';
import { usersRoutes } from './modules/users/routes.js';
import { workspacesRoutes } from './modules/workspaces/routes.js';
import { apiKeyPlugin } from './plugins/apiKey.js';
import { jwtPlugin } from './plugins/jwt.js';
import { permissionPlugin } from './plugins/permission.js';
import { securityPlugin } from './plugins/security.js';
import { registerSharedSchemas } from './schemas/registerSharedSchemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });

export const buildServer = async () => {
  const config: AppConfig = loadEnv();
  const app = fastify({ logger: false });

  app.decorate('config', config);

  initSentry(config.SENTRY_DSN);
  installRequestContextHooks(app, appLogger);

  await app.register(import('@fastify/swagger'), {
    openapi: {
      openapi: '3.0.1',
      info: {
        title: 'Followup 3.0 API',
        version: '1.0.0',
        description: 'API REST Followup 3.0 (workspaces, progetti, utenti, sessione).',
        contact: { name: 'Tecma Platform', email: 'platform@tecma.example' },
      },
      servers: [{ url: '/v1' }],
      tags: [
        { name: 'Health', description: 'Probe e stato servizio' },
        { name: 'Auth', description: 'Login, token e SSO' },
        { name: 'Users', description: 'Gestione utenti' },
        { name: 'Rbac', description: 'Catalogo permessi e ruoli RBAC' },
        { name: 'Workspaces', description: 'Workspace e membri' },
        { name: 'Assets', description: 'Asset workspace (logo, branding, attachments)' },
        { name: 'Projects', description: 'Progetti e accessi' },
        { name: 'Admin', description: 'Funzioni platform Tecma' },
        { name: 'Session', description: 'Preferenze e lookup sessione' },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
          BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
    },
  });

  await registerSharedSchemas(app);

  await app.register(import('@fastify/swagger-ui'), {
    routePrefix: '/v1/docs',
  });

  const isOpenApiGeneration = process.env.OPENAPI_GENERATE === '1';

  if (!isOpenApiGeneration) {
    const mongo = new FollowupMongoClient({
      mongoUri: config.MONGO_URI,
      mongoDbName: config.MONGO_DB_NAME,
      nodeEnv: config.NODE_ENV,
    });
    await mongo.connect();

    const db = mongo.getDb();
    await ensureCoreIndexes(db);

    app.decorate('mongoDb', db);
    app.decorate('auditService', new AuditService(app));
    app.decorate(
      'mail',
      createMailPort({
        nodeEnv: config.NODE_ENV,
        log: (_msg, meta) => {
          appLogger.debug(meta as Record<string, unknown>);
        },
      }),
    );

    app.addHook('onClose', async () => {
      await mongo.close();
    });
  } else {
    app.decorate('mongoDb', {
      collection: () => ({
        findOne: async () => null,
        find: () => ({ toArray: async () => [] }),
        insertOne: async () => ({ acknowledged: true, insertedId: 'openapi-mock' }),
        updateOne: async () => ({
          acknowledged: true,
          matchedCount: 0,
          modifiedCount: 0,
          upsertedCount: 0,
        }),
        deleteOne: async () => ({ acknowledged: true, deletedCount: 0 }),
        createIndex: async () => 'idx_mock',
      }),
    } as unknown as Db);
    app.decorate('auditService', {
      authEvent: async () => undefined,
      listAuthEvents: async () => [],
    } as unknown as AuditService);
    app.decorate('mail', createMailPort({ nodeEnv: 'test' }));
  }

  await app.register(securityPlugin);
  await app.register(apiKeyPlugin);
  await app.register(jwtPlugin);
  await app.register(permissionPlugin);

  app.get(
    '/v1/health',
    {
      schema: {
        tags: ['Health'],
        operationId: 'getHealth',
        description: 'Liveness/readiness; pubblico.',
        security: [],
        response: {
          200: {
            type: 'object',
            required: ['data'],
            properties: {
              data: {
                type: 'object',
                required: ['status', 'appEnv'],
                properties: {
                  status: { type: 'string', example: 'ok' },
                  appEnv: { type: 'string', example: 'dev-1' },
                },
              },
            },
          },
          500: { $ref: 'ErrorResponse#' },
        },
      },
    },
    async () => ({ data: { status: 'ok', appEnv: config.APP_ENV } }),
  );

  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(rbacRoutes);
  await app.register(workspacesRoutes);
  await app.register(assetsRoutes);
  await app.register(projectsRoutes);
  await app.register(adminAuditRoutes);

  /** Spec OpenAPI 3 in JSON (stesso contenuto generato per YAML); pubblico come `/v1/docs`. */
  app.get(
    '/v1/openapi.json',
    {
      schema: {
        hide: true,
        description: 'OpenAPI 3 specification (JSON)',
        tags: ['Health'],
      },
    },
    async (_request, reply) => reply.send(await app.swagger()),
  );

  return app;
};

const run = async (): Promise<void> => {
  const app = await buildServer();

  await app.listen({
    host: '0.0.0.0',
    port: app.config.PORT,
  });

  appLogger.info({ port: app.config.PORT }, 'Followup API started');
};

if (import.meta.url === `file://${process.argv[1]}`) {
  void run();
}
