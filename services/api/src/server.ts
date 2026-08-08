import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import dotenv from 'dotenv';

import fastify from 'fastify';
import type { Db } from 'mongodb';

import { FollowupMongoClient, ensureCoreIndexes } from '@followup/db';
import { appLogger } from '@followup/logger';
import { loadEnv, type AppConfig } from '@followup/shared-config';

import './types.js';
import { initSentry, installRequestContextHooks } from './infra/observability.js';
import { JobQueue } from './infra/jobQueue.js';
import { resolveAppEnv } from './lib/appEnv.js';
import { adminAuditRoutes } from './modules/admin/auditRoutes.js';
import { adminEmailFlowRoutes } from './modules/admin/emailFlowRoutes.js';
import { assetsRoutes } from './modules/assets/routes.js';
import { AuditService } from './modules/auditService.js';
import { installAuditResponseHook } from './modules/audit/withAudit.js';
import { createMailPort } from './modules/mail/createMailPort.js';
import { authRoutes } from './modules/auth/routes.js';
import { adminI18nBundleWriteRoutes } from './modules/i18n/adminI18nBundleWriteRoutes.js';
import { i18nRoutes } from './modules/i18n/routes.js';
import { workspaceI18nBundleWriteRoutes } from './modules/i18n/workspaceI18nBundleWriteRoutes.js';
import { projectsRoutes } from './modules/projects/routes.js';
import { projectDetailRoutes } from './modules/projects/detailRoutes.js';
import { rbacRoutes } from './modules/rbac/routes.js';
import { requestsRoutes } from './modules/requests/routes.js';
import { usersRoutes } from './modules/users/routes.js';
import { apartmentsRoutes } from './modules/apartments/routes.js';
import { apartmentStayQuoteRoutes } from './modules/apartments/stayQuoteRoutes.js';
import { workspacesRoutes } from './modules/workspaces/routes.js';
import { apiKeyPlugin } from './plugins/apiKey.js';
import { jwtPlugin } from './plugins/jwt.js';
import { permissionPlugin } from './plugins/permission.js';
import { initRateLimitStore } from './plugins/rateLimitStore.js';
import { securityPlugin } from './plugins/security.js';
import { registerSharedSchemas } from './schemas/registerSharedSchemas.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
if (process.env.SKIP_DOTENV_LOCAL_FOR_TEST !== '1') {
  dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
}

export const buildServer = async () => {
  const config: AppConfig = loadEnv();
  const app = fastify({ logger: false });

  app.decorate('config', config);

  initSentry(config.SENTRY_DSN, { node_env: config.NODE_ENV });
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
        { name: 'Apartments', description: 'Appartamenti / unità immobiliari' },
        { name: 'Requests', description: 'Trattative CRM collegate a clienti e appartamenti' },
        { name: 'Connectors', description: 'Lookup connettori marketing (stub)' },
        { name: 'Workflows', description: 'Lookup workflow workspace/progetto' },
        { name: 'Admin', description: 'Funzioni platform Tecma' },
        { name: 'Session', description: 'Preferenze e lookup sessione' },
        { name: 'I18n', description: 'Bundle traduzioni UI (Mongo-backed)' },
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
    if (process.env.ENABLE_POC_TZ_WRITES === '1') {
      await ensureCoreIndexes(db);
    } else {
      appLogger.warn({
        event: 'db.poc_tz_bootstrap.disabled',
        message: 'POC tz_* index bootstrap is disabled',
      });
    }

    let auditMongo: FollowupMongoClient | null = null;
    let auditDb = db;
    if (config.AUDIT_MONGO_URI != null) {
      auditMongo = new FollowupMongoClient({
        mongoUri: config.AUDIT_MONGO_URI,
        mongoDbName: config.AUDIT_MONGO_DB_NAME ?? config.MONGO_DB_NAME,
        nodeEnv: config.NODE_ENV,
      });
      await auditMongo.connect();
      auditDb = auditMongo.getDb();
    }

    // Ambiente demo: connessione separata, stesso database. Se `MONGO_URI_DEMO`
    // non e' configurata, `/demo` ricade sulla connessione di produzione.
    let demoMongo: FollowupMongoClient | null = null;
    let demoDb = db;
    if (config.MONGO_URI_DEMO != null) {
      demoMongo = new FollowupMongoClient({
        mongoUri: config.MONGO_URI_DEMO,
        mongoDbName: config.MONGO_DB_NAME,
        nodeEnv: config.NODE_ENV,
      });
      await demoMongo.connect();
      demoDb = demoMongo.getDb();
    }

    app.decorate('mongoDb', db);
    app.decorateRequest('appEnv', 'prod');
    app.decorateRequest('envDb', null as unknown as Db);
    app.addHook('onRequest', async (request) => {
      request.appEnv = resolveAppEnv(request.headers['x-app-env']);
      request.envDb = request.appEnv === 'demo' ? demoDb : db;
    });

    // Contatori del rate limit condivisi tra istanze (vedi plugins/rateLimitStore.ts).
    await initRateLimitStore(db);

    // La coda dei job e' scritta dall'API e consumata dal processo worker.
    const jobQueue = new JobQueue(db);
    await jobQueue.ensureIndexes();
    app.decorate('jobQueue', jobQueue);

    app.decorate('auditService', new AuditService(auditDb));
    app.decorate(
      'mail',
      createMailPort({
        nodeEnv: config.NODE_ENV,
        log: (_msg, meta) => {
          appLogger.debug(meta as Record<string, unknown>);
        },
        lookupFlow: async (flowKey) => {
          const doc = (await db
            .collection('tz_email_flows')
            .findOne({ flowKey, status: { $ne: 'deleted' } })) as {
            subject?: string;
            text?: string;
            html?: string;
          } | null;
          if (!doc?.subject || !doc?.text) return null;
          return { subject: doc.subject, text: doc.text, html: doc.html };
        },
      }),
    );

    app.addHook('onClose', async () => {
      if (auditMongo != null) await auditMongo.close();
      if (demoMongo != null) await demoMongo.close();
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
    app.decorate('jobQueue', new JobQueue(app.mongoDb));
    app.decorateRequest('appEnv', 'prod');
    app.decorateRequest('envDb', null as unknown as Db);
    app.addHook('onRequest', async (request) => {
      request.appEnv = 'prod';
      request.envDb = app.mongoDb;
    });
    app.decorate('mail', createMailPort({ nodeEnv: 'test' }));
  }

  await app.register(securityPlugin);
  await app.register(import('@fastify/cookie'));
  await app.register(apiKeyPlugin);
  await app.register(jwtPlugin);
  await app.register(permissionPlugin);

  // Hook onResponse globale che emette gli audit events preparati da `withAudit`.
  // Cattura lo statusCode effettivo per derivare outcome (success/failure).
  installAuditResponseHook(app);

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
  await app.register(i18nRoutes);
  await app.register(workspacesRoutes);
  await app.register(workspaceI18nBundleWriteRoutes);
  await app.register(assetsRoutes);
  await app.register(projectsRoutes);
  await app.register(projectDetailRoutes);
  await app.register(requestsRoutes);
  await app.register(apartmentsRoutes);
  await app.register(apartmentStayQuoteRoutes);
  await app.register(adminAuditRoutes);
  await app.register(adminEmailFlowRoutes);
  await app.register(adminI18nBundleWriteRoutes);

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

const isMainModule =
  process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  void run();
}
