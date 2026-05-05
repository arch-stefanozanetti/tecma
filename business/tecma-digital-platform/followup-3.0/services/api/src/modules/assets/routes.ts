import crypto from 'node:crypto';

import { z } from 'zod';
import { ObjectId } from 'mongodb';

import { AssetsRepository } from '@followup/db';

import type { FastifyInstance } from 'fastify';

import { singlePagePaginationInfo } from '../../lib/pagination.js';
import {
  createdObjectSchema,
  listSchema,
  okDeletedSchema,
  singleObjectSchema,
} from '../../schemas/routeHelpers.js';

const ASSET_KINDS = [
  'workspace.logo',
  'workspace.email-header',
  'workspace.favicon',
  'project.logo',
  'project.branding',
  'project.email-header',
  'generic',
] as const;

const ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/svg+xml',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/octet-stream',
];

const MAX_INLINE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MiB

const requestUploadSchema = z.object({
  fileName: z.string().min(1).max(256),
  contentType: z.string().min(3).max(120),
  kind: z.enum(ASSET_KINDS).default('generic'),
  byteSize: z.number().int().positive().max(MAX_INLINE_SIZE_BYTES).optional(),
});

const createAssetSchema = z.object({
  fileName: z.string().min(1).max(256),
  contentType: z.string().min(3).max(120),
  kind: z.enum(ASSET_KINDS).default('generic'),
  storageKey: z.string().min(1).max(512).optional(),
  inlineData: z.string().min(1).max(8 * 1024 * 1024).optional(), // base64 max ~6 MiB raw
  projectId: z.string().min(1).optional(),
  byteSize: z.number().int().nonnegative().optional(),
});

const featureFlagEnabled = (): boolean => {
  const value = (process.env.ENABLE_ASSET_UPLOADS ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
};

const sanitizeForList = (
  doc: Record<string, unknown>,
): Record<string, unknown> => {
  const out = { ...doc };
  if (typeof out.inlineData === 'string' && out.inlineData.length > 80) {
    out.inlineData = `${out.inlineData.slice(0, 64)}...`;
  }
  return out;
};

export const assetsRoutes = async (app: FastifyInstance): Promise<void> => {
  const assetsRepo = new AssetsRepository(app.mongoDb);

  app.post(
    '/v1/workspaces/:workspaceId/assets/upload-url',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...singleObjectSchema(
          'requestAssetUploadUrl',
          'Assets',
          'Richiede signed URL per upload asset workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string', description: 'Workspace target' },
          },
        },
        body: {
          type: 'object',
          required: ['fileName', 'contentType'],
          properties: {
            fileName: { type: 'string', minLength: 1, maxLength: 256 },
            contentType: { type: 'string', minLength: 3, maxLength: 120 },
            kind: { type: 'string', enum: ASSET_KINDS as unknown as string[] },
            byteSize: { type: 'integer', minimum: 1 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = requestUploadSchema.parse(request.body);

      if (!ALLOWED_CONTENT_TYPES.includes(payload.contentType)) {
        return reply.status(400).send({
          error: {
            code: 'AssetContentTypeNotAllowed',
            message: `Content-type "${payload.contentType}" non consentito`,
            status: 400,
          },
        });
      }

      const enabled = featureFlagEnabled();
      const storageKey = `workspaces/${params.workspaceId}/${payload.kind}/${crypto.randomUUID()}-${payload.fileName}`;

      if (!enabled) {
        return reply.send({
          data: {
            mode: 'inline-fallback' as const,
            storageKey,
            uploadUrl: null,
            expiresIn: null,
            note: 'ENABLE_ASSET_UPLOADS=false: usare POST /assets con inlineData base64 (dev/test).',
          },
        });
      }

      // Stub: signed URL generato lato edge/storage (non implementato qui).
      // In produzione delegheremmo a S3/MinIO/Cloudflare R2 con expirations.
      const expiresIn = 600;
      const fakeSignedUrl = `https://storage.tecma.local/${encodeURIComponent(storageKey)}?signed=${crypto
        .randomBytes(16)
        .toString('hex')}&expires=${expiresIn}`;
      return reply.send({
        data: {
          mode: 'signed-url' as const,
          storageKey,
          uploadUrl: fakeSignedUrl,
          expiresIn,
        },
      });
    },
  );

  app.post(
    '/v1/workspaces/:workspaceId/assets',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...createdObjectSchema('createAsset', 'Assets', 'Registra asset workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string', description: 'Workspace target' },
          },
        },
        body: {
          type: 'object',
          required: ['fileName', 'contentType'],
          properties: {
            fileName: { type: 'string', minLength: 1, maxLength: 256 },
            contentType: { type: 'string', minLength: 3, maxLength: 120 },
            kind: { type: 'string', enum: ASSET_KINDS as unknown as string[] },
            storageKey: { type: 'string', minLength: 1, maxLength: 512 },
            inlineData: {
              type: 'string',
              description:
                'Base64 (senza prefix data:) usato come fallback quando ENABLE_ASSET_UPLOADS=false',
            },
            projectId: { type: 'string', minLength: 1 },
            byteSize: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const payload = createAssetSchema.parse(request.body);

      if (!ALLOWED_CONTENT_TYPES.includes(payload.contentType)) {
        return reply.status(400).send({
          error: {
            code: 'AssetContentTypeNotAllowed',
            message: `Content-type "${payload.contentType}" non consentito`,
            status: 400,
          },
        });
      }

      if (payload.storageKey == null && payload.inlineData == null) {
        return reply.status(400).send({
          error: {
            code: 'AssetMissingPayload',
            message: 'Specificare storageKey (signed URL) o inlineData (fallback base64)',
            status: 400,
          },
        });
      }

      const actor = request.user as { sub?: string };
      const now = new Date().toISOString();
      const doc = {
        _id: new ObjectId(),
        workspaceId: params.workspaceId,
        projectId: payload.projectId,
        kind: payload.kind,
        fileName: payload.fileName,
        contentType: payload.contentType,
        byteSize: payload.byteSize,
        storageKey: payload.storageKey,
        inlineData: payload.inlineData,
        status: 'active' as const,
        uploadedBy: actor.sub,
        createdAt: now,
        updatedAt: now,
      };
      await assetsRepo.create(doc as any);

      await app.auditService.authEvent({
        eventType: 'assets.create',
        userId: actor.sub ?? 'system',
        details: {
          workspaceId: params.workspaceId,
          assetId: doc._id.toString(),
          kind: payload.kind,
          mode: payload.storageKey != null ? 'signed-url' : 'inline-fallback',
        },
      });

      return reply.status(201).send({ data: sanitizeForList(doc as Record<string, unknown>) });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/assets',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...listSchema('listAssets', 'Assets', 'Asset workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: {
            workspaceId: { type: 'string', description: 'Workspace target' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const rows: Array<Record<string, unknown>> = (await assetsRepo.listForWorkspace(
        params.workspaceId,
      )) as unknown as Array<Record<string, unknown>>;
      const data = rows.map((row) => sanitizeForList(row));
      return reply.send({
        data,
        paginationInfo: singlePagePaginationInfo(data.length),
      });
    },
  );

  app.get(
    '/v1/workspaces/:workspaceId/assets/:assetId/download-url',
    {
      preHandler: [app.authenticate, app.requireCanAccessWorkspace()],
      schema: {
        ...singleObjectSchema(
          'getAssetDownloadUrl',
          'Assets',
          'Signed URL download asset workspace',
        ),
        params: {
          type: 'object',
          required: ['workspaceId', 'assetId'],
          properties: {
            workspaceId: { type: 'string', description: 'Workspace target' },
            assetId: { type: 'string', description: 'ObjectId asset' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; assetId: string };
      if (!ObjectId.isValid(params.assetId)) {
        return reply.status(400).send({
          error: { code: 'InvalidAssetId', message: 'Invalid asset id', status: 400 },
        });
      }
      const asset = (await assetsRepo.findOne({
        _id: new ObjectId(params.assetId),
        workspaceId: params.workspaceId,
      } as any)) as Record<string, unknown> | null;
      if (asset == null || asset.status === 'deleted') {
        return reply.status(404).send({
          error: { code: 'AssetNotFound', message: 'Asset not found', status: 404 },
        });
      }

      const enabled = featureFlagEnabled();
      if (!enabled || typeof asset.storageKey !== 'string' || asset.storageKey === '') {
        return reply.send({
          data: {
            mode: 'inline-fallback' as const,
            inlineData: typeof asset.inlineData === 'string' ? asset.inlineData : null,
            contentType: asset.contentType,
            fileName: asset.fileName,
            downloadUrl: null,
          },
        });
      }
      const expiresIn = 600;
      const fakeSignedUrl = `https://storage.tecma.local/${encodeURIComponent(
        String(asset.storageKey),
      )}?signed=${crypto.randomBytes(12).toString('hex')}&expires=${expiresIn}`;
      return reply.send({
        data: {
          mode: 'signed-url' as const,
          downloadUrl: fakeSignedUrl,
          expiresIn,
          contentType: asset.contentType,
          fileName: asset.fileName,
        },
      });
    },
  );

  app.delete(
    '/v1/workspaces/:workspaceId/assets/:assetId',
    {
      preHandler: [app.authenticate, app.requireWorkspaceAdminOrOwner()],
      schema: {
        ...okDeletedSchema('deleteAsset', 'Assets', 'Soft-delete asset workspace'),
        params: {
          type: 'object',
          required: ['workspaceId', 'assetId'],
          properties: {
            workspaceId: { type: 'string', description: 'Workspace target' },
            assetId: { type: 'string', description: 'ObjectId asset' },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string; assetId: string };
      if (!ObjectId.isValid(params.assetId)) {
        return reply.status(400).send({
          error: { code: 'InvalidAssetId', message: 'Invalid asset id', status: 400 },
        });
      }
      const ok = await assetsRepo.softDelete(params.workspaceId, params.assetId);
      if (!ok) {
        return reply.status(404).send({
          error: { code: 'AssetNotFound', message: 'Asset not found', status: 404 },
        });
      }
      const actor = request.user as { sub?: string };
      await app.auditService.authEvent({
        eventType: 'assets.delete',
        userId: actor.sub ?? 'system',
        details: { workspaceId: params.workspaceId, assetId: params.assetId },
      });
      return reply.send({ data: { deleted: true } });
    },
  );
};
