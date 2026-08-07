import crypto from 'node:crypto';
import path from 'node:path';

import { z } from 'zod';
import { ObjectId } from 'mongodb';

import { AssetsRepository } from '@followup/db';
import type { Asset } from '@followup/shared-types';

import type { FastifyInstance } from 'fastify';

import {
  buildMongoSkip,
  buildMongoSort,
  buildPaginationInfo,
  parsePaginationQuery,
} from '../../lib/pagination.js';
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
  'apartment.floorplan',
  'apartment.gallery',
  'generic',
] as const;

const ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
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
  inlineData: z
    .string()
    .min(1)
    .max(8 * 1024 * 1024)
    .optional(), // base64 max ~6 MiB raw
  projectId: z.string().min(1).optional(),
  byteSize: z.number().int().nonnegative().optional(),
});

/**
 * Valida che il contenuto base64 corrisponda effettivamente al contentType dichiarato,
 * confrontando i magic bytes (file signature). Previene content-type spoofing e upload
 * di SVG/HTML/eseguibili camuffati da immagini.
 */
const validateInlineDataMagic = (base64: string, contentType: string): boolean => {
  let rawBytes: Buffer;
  try {
    if (/^data:/i.test(base64) || !/^[A-Za-z0-9+/=_-]+$/.test(base64)) return false;
    rawBytes = Buffer.from(base64, 'base64');
  } catch {
    return false;
  }
  if (rawBytes.length < 4) return false;

  if (contentType === 'image/png') {
    return rawBytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
    return rawBytes[0] === 0xff && rawBytes[1] === 0xd8 && rawBytes[2] === 0xff;
  }
  if (contentType === 'image/webp') {
    return (
      rawBytes.length >= 12 &&
      rawBytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      rawBytes.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (contentType === 'image/gif') {
    const header = rawBytes.subarray(0, 6).toString('ascii');
    return header === 'GIF87a' || header === 'GIF89a';
  }
  if (contentType === 'application/pdf') {
    return rawBytes.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  return false;
};

const sanitizeAssetFileName = (fileName: string): string => {
  let decoded = fileName;
  try {
    decoded = decodeURIComponent(fileName);
  } catch {
    decoded = fileName;
  }
  const base = path.posix.basename(decoded.replace(/\\/g, '/'));
  const sanitized = base
    .split('')
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 160)
    .trim();
  return sanitized.length > 0 ? sanitized : 'asset';
};

const featureFlagEnabled = (): boolean => {
  const value = (process.env.ENABLE_ASSET_UPLOADS ?? '').trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
};

const isProduction = (app: FastifyInstance): boolean => app.config.NODE_ENV === 'production';
const signedUrlMode = (): string =>
  (process.env.ASSET_SIGNED_URL_MODE ?? 'stub').trim().toLowerCase();

const sanitizeForList = (doc: Record<string, unknown>): Record<string, unknown> => {
  const out = { ...doc };
  if (typeof out.inlineData === 'string' && out.inlineData.length > 80) {
    out.inlineData = `${out.inlineData.slice(0, 64)}...`;
  }
  return out;
};

export const assetsRoutes = async (app: FastifyInstance): Promise<void> => {
  const assetsRepo = new AssetsRepository(app.mongoDb);
  const assetsListAllowedSortFields = ['createdAt', 'updatedAt', 'fileName', 'kind'] as const;

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
      const safeFileName = sanitizeAssetFileName(payload.fileName);
      const storageKey = `workspaces/${params.workspaceId}/${payload.kind}/${crypto.randomUUID()}-${safeFileName}`;
      const inlineFallbackAllowed = !enabled && !isProduction(app);

      if (!enabled && inlineFallbackAllowed) {
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
      if (!enabled && !inlineFallbackAllowed) {
        return reply.status(503).send({
          error: {
            code: 'AssetInlineFallbackDisabled',
            message: 'Inline fallback disabled in production',
            status: 503,
          },
        });
      }
      if (isProduction(app) && signedUrlMode() === 'stub') {
        return reply.status(503).send({
          error: {
            code: 'AssetSignedUrlProviderNotConfigured',
            message: 'Signed URL provider must be configured for production',
            status: 503,
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

      const inlineFallbackAllowed = !featureFlagEnabled() && !isProduction(app);
      if (payload.storageKey == null && payload.inlineData == null) {
        return reply.status(400).send({
          error: {
            code: 'AssetMissingPayload',
            message: 'Specificare storageKey (signed URL) o inlineData (fallback base64)',
            status: 400,
          },
        });
      }
      if (!inlineFallbackAllowed && payload.inlineData != null) {
        return reply.status(400).send({
          error: {
            code: 'AssetInlineDataDisabled',
            message: 'inlineData fallback is disabled in this environment',
            status: 400,
          },
        });
      }

      // Validazione magic bytes: il contenuto base64 deve corrispondere al contentType dichiarato.
      // Previene upload di SVG/HTML/script camuffati da immagine.
      if (
        payload.inlineData != null &&
        !validateInlineDataMagic(payload.inlineData, payload.contentType)
      ) {
        return reply.status(400).send({
          error: {
            code: 'AssetContentMismatch',
            message: 'Il contenuto del file non corrisponde al content-type dichiarato.',
            status: 400,
          },
        });
      }

      const actor = request.user as { sub?: string };
      const now = new Date().toISOString();
      const doc: Asset & { _id: ObjectId } = {
        _id: new ObjectId(),
        workspaceId: params.workspaceId,
        projectId: payload.projectId,
        kind: payload.kind,
        fileName: sanitizeAssetFileName(payload.fileName),
        contentType: payload.contentType,
        byteSize: payload.byteSize,
        storageKey: payload.storageKey,
        inlineData: payload.inlineData,
        status: 'active' as const,
        uploadedBy: actor.sub,
        createdAt: now,
        updatedAt: now,
      };
      await assetsRepo.create(doc);

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
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: assetsListAllowedSortFields as unknown as string[] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const paginationParams = parsePaginationQuery(request.query, assetsListAllowedSortFields);
      const [totalDocs, rows] = await Promise.all([
        assetsRepo.countForWorkspace(params.workspaceId),
        assetsRepo.listForWorkspace(params.workspaceId, {
          skip: buildMongoSkip(paginationParams),
          limit: paginationParams.perPage,
          sort: buildMongoSort(paginationParams, 'createdAt'),
        }),
      ]);
      const data = rows.map((row) => sanitizeForList(row as Record<string, unknown>));
      return reply.send({
        data,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
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
      const asset = await assetsRepo.findForWorkspaceAsset(params.workspaceId, params.assetId);
      if (asset == null || asset.status === 'deleted') {
        return reply.status(404).send({
          error: { code: 'AssetNotFound', message: 'Asset not found', status: 404 },
        });
      }

      const enabled = featureFlagEnabled();
      const inlineFallbackAllowed = !enabled && !isProduction(app);
      if (
        (isProduction(app) && signedUrlMode() === 'stub') ||
        (!inlineFallbackAllowed && !enabled)
      ) {
        return reply.status(503).send({
          error: {
            code: 'AssetSignedUrlProviderNotConfigured',
            message: 'Signed URL provider must be configured for this environment',
            status: 503,
          },
        });
      }
      if (!enabled || typeof asset.storageKey !== 'string' || asset.storageKey === '') {
        if (!inlineFallbackAllowed) {
          return reply.status(503).send({
            error: {
              code: 'AssetInlineFallbackDisabled',
              message: 'Inline fallback disabled in this environment',
              status: 503,
            },
          });
        }
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
