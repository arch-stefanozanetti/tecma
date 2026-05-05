import crypto from 'node:crypto';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

import { MongoRepository } from '@followup/db';
import {
  hasPermission,
  isTecmaPlatformAdmin,
  normalizeSystemRole,
  PERMISSIONS,
} from '@followup/shared-rbac';

import type { FastifyInstance } from 'fastify';

import { buildUserWorkspaceMembershipFilter } from '../../lib/mongoIdentity.js';
import { singlePagePaginationInfo } from '../../lib/pagination.js';
import { resolveUserIdentityCandidates } from '../../lib/userIdentity.js';
import {
  createdObjectSchema,
  listSchema,
  okDeletedSchema,
  singleObjectSchema,
} from '../../schemas/routeHelpers.js';

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(['owner', 'admin', 'collaborator', 'viewer']).default('viewer'),
  /** Se presente, l’invito è consentito ai soli owner/admin del workspace (senza `users.invite` globale). */
  workspaceId: z.string().min(1).optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  systemRole: z.enum(['user', 'tecma_admin']).optional(),
});

const omitPasswordHash = (doc: Record<string, unknown>): Record<string, unknown> => {
  const out = { ...doc };
  delete out.passwordHash;
  return out;
};

export const usersRoutes = async (app: FastifyInstance): Promise<void> => {
  const usersRepo = new MongoRepository<any>(app.mongoDb.collection('tz_users'));
  const usersCollection = app.mongoDb.collection('tz_users');
  const parseUserObjectId = (rawUserId: string): ObjectId | null => {
    if (!ObjectId.isValid(rawUserId)) return null;
    return new ObjectId(rawUserId);
  };
  const isLastActiveTecmaAdmin = async (userId: ObjectId): Promise<boolean> => {
    const activeAdmins = await usersCollection
      .find({
        status: 'active',
        $or: [
          { systemRole: 'tecma_admin' },
          { system_role: 'tecma_admin' },
          { systemRole: 'tecma_superadmin' },
          { system_role: 'tecma_superadmin' },
          { systemRole: 'tecma_super_admin' },
          { system_role: 'tecma_super_admin' },
        ],
      })
      .project({ _id: 1 })
      .toArray();

    return (
      activeAdmins.length === 1 &&
      String((activeAdmins[0] as { _id?: unknown })._id ?? '') === userId.toString()
    );
  };

  app.get(
    '/v1/users',
    {
      preHandler: [app.authenticate, app.requirePermission('users.read')],
      schema: listSchema('listUsers', 'Users', 'Elenco utenti'),
    },
    async (_request, reply) => {
      const rows = await usersRepo.findMany({});
      const data = rows.map(
        (row: Record<string, unknown>) => omitPasswordHash(row) as Record<string, unknown>,
      );
      return reply.send({ data, paginationInfo: singlePagePaginationInfo(data.length) });
    },
  );

  app.post(
    '/v1/users',
    {
      preHandler: [app.authenticate],
      schema: {
        ...createdObjectSchema('inviteUser', 'Users', 'Invita utente'),
        body: {
          type: 'object',
          required: ['email', 'fullName'],
          properties: {
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string', minLength: 2 },
            role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
            workspaceId: {
              type: 'string',
              description: 'Workspace in cui si invita (richiede ruolo owner/admin).',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = createUserSchema.parse(request.body);
      const actor = request.user as {
        sub?: string;
        email?: string;
        permissions?: string[];
        systemRole?: string;
        system_role?: string;
      };
      const isTecma = isTecmaPlatformAdmin(normalizeSystemRole(actor));
      const permissions = actor.permissions ?? [];
      if (payload.workspaceId != null) {
        if (!isTecma) {
          const identities = await resolveUserIdentityCandidates(app, [
            actor.sub ?? '',
            actor.email,
          ]);
          const membership = await app.mongoDb
            .collection('tz_user_workspaces')
            .findOne(buildUserWorkspaceMembershipFilter(payload.workspaceId, identities) as any);
          if (
            membership == null ||
            !['owner', 'admin'].includes(String((membership as { role?: string }).role ?? ''))
          ) {
            return reply.status(403).send({
              error: {
                code: 'Forbidden',
                message: 'Workspace owner or admin required to invite into this workspace',
                status: 403,
              },
            });
          }
        }
      } else if (!isTecma && !hasPermission(permissions, PERMISSIONS.USERS_INVITE)) {
        return reply.status(403).send({
          error: { code: 'Forbidden', message: 'Missing required permission', status: 403 },
        });
      }
      const now = new Date().toISOString();
      const randomSecret = crypto.randomBytes(32).toString('base64url');
      const passwordHash = await bcrypt.hash(randomSecret, 12);
      const doc = {
        _id: new ObjectId(),
        email: payload.email.toLowerCase(),
        fullName: payload.fullName,
        passwordHash,
        systemRole: 'user',
        role: payload.role,
        status: 'invited' as const,
        createdAt: now,
        updatedAt: now,
      };

      await usersRepo.create(doc);

      await app.auditService.authEvent({
        eventType: 'users.invite',
        userId: (request.user as { sub?: string })?.sub ?? 'system',
        details: { invitedEmail: doc.email },
      });

      return reply.status(201).send({ data: omitPasswordHash(doc as Record<string, unknown>) });
    },
  );

  app.get(
    '/v1/users/:userId',
    {
      preHandler: [app.authenticate, app.requirePermission('users.read')],
      schema: {
        ...singleObjectSchema('getUserById', 'Users', 'Dettaglio utente'),
        params: {
          type: 'object',
          required: ['userId'],
          properties: { userId: { type: 'string', description: 'ObjectId utente' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { userId: string };
      const userObjectId = parseUserObjectId(params.userId);
      if (userObjectId == null) {
        return reply
          .status(400)
          .send({ error: { code: 'InvalidUserId', message: 'Invalid user id', status: 400 } });
      }
      const user = await usersRepo.findOne({ _id: userObjectId });
      if (user == null) {
        return reply
          .status(404)
          .send({ error: { code: 'UserNotFound', message: 'User not found', status: 404 } });
      }
      return reply.send({ data: omitPasswordHash(user as Record<string, unknown>) });
    },
  );

  app.patch(
    '/v1/users/:userId',
    {
      preHandler: [app.authenticate, app.requirePermission('users.write')],
      schema: {
        ...singleObjectSchema('patchUser', 'Users', 'Aggiorna utente'),
        params: {
          type: 'object',
          required: ['userId'],
          properties: { userId: { type: 'string' } },
        },
        body: {
          type: 'object',
          properties: {
            fullName: { type: 'string', minLength: 2 },
            systemRole: { type: 'string', enum: ['user', 'tecma_admin'] },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { userId: string };
      const userObjectId = parseUserObjectId(params.userId);
      if (userObjectId == null) {
        return reply
          .status(400)
          .send({ error: { code: 'InvalidUserId', message: 'Invalid user id', status: 400 } });
      }
      const payload = updateUserSchema.parse(request.body);
      const actor = request.user as { sub?: string; systemRole?: string; system_role?: string };
      const before = await usersRepo.findOne({ _id: userObjectId });
      if (before == null) {
        return reply
          .status(404)
          .send({ error: { code: 'UserNotFound', message: 'User not found', status: 404 } });
      }

      const roleChangeRequested = payload.systemRole != null;
      if (roleChangeRequested && !isTecmaPlatformAdmin(normalizeSystemRole(actor))) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Only Tecma SuperAdmin can change systemRole',
            status: 403,
          },
        });
      }

      const beforeIsTecmaAdmin = isTecmaPlatformAdmin(normalizeSystemRole(before));
      if (
        roleChangeRequested &&
        payload.systemRole !== 'tecma_admin' &&
        beforeIsTecmaAdmin &&
        actor.sub === userObjectId.toString() &&
        (await isLastActiveTecmaAdmin(userObjectId))
      ) {
        return reply.status(409).send({
          error: {
            code: 'LastTecmaAdmin',
            message: 'Cannot remove the last active Tecma SuperAdmin',
            status: 409,
          },
        });
      }

      const update: Record<string, unknown> = {
        $set: { updatedAt: new Date().toISOString() },
      };
      if (payload.fullName != null) {
        (update.$set as Record<string, unknown>).fullName = payload.fullName;
      }
      if (payload.systemRole === 'tecma_admin') {
        (update.$set as Record<string, unknown>).systemRole = 'tecma_admin';
        (update.$set as Record<string, unknown>).system_role = 'tecma_admin';
        (update.$set as Record<string, unknown>).isTecmaAdmin = true;
      } else if (payload.systemRole === 'user') {
        (update.$set as Record<string, unknown>).systemRole = 'user';
        update.$unset = { system_role: '', isTecmaAdmin: '' };
      }

      await usersRepo.updateOne({ _id: userObjectId }, update as any);
      const user = await usersRepo.findOne({ _id: userObjectId });
      if (roleChangeRequested) {
        await app.auditService.authEvent({
          eventType: 'users.systemRole.update',
          userId: actor.sub ?? 'system',
          details: {
            targetUserId: userObjectId.toString(),
            before: normalizeSystemRole(before) ?? 'user',
            after: payload.systemRole,
          },
        });
      }
      return reply.send({ data: omitPasswordHash(user as Record<string, unknown>) });
    },
  );

  app.delete(
    '/v1/users/:userId',
    {
      preHandler: [app.authenticate, app.requirePermission('users.write')],
      schema: {
        ...okDeletedSchema('deleteUser', 'Users', 'Elimina utente'),
        params: {
          type: 'object',
          required: ['userId'],
          properties: { userId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { userId: string };
      const userObjectId = parseUserObjectId(params.userId);
      if (userObjectId == null) {
        return reply
          .status(400)
          .send({ error: { code: 'InvalidUserId', message: 'Invalid user id', status: 400 } });
      }
      await usersRepo.deleteOne({ _id: userObjectId });
      return reply.send({ data: { deleted: true } });
    },
  );

  app.post(
    '/v1/users/:userId/password-reset',
    {
      preHandler: [app.authenticate, app.requirePermission('users.invite')],
      schema: {
        ...singleObjectSchema(
          'requestUserPasswordReset',
          'Users',
          'Richiesta reset password (stub)',
        ),
        params: {
          type: 'object',
          required: ['userId'],
          properties: { userId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { userId: string };
      await app.auditService.authEvent({
        eventType: 'users.password-reset',
        userId: (request.user as { sub?: string })?.sub ?? 'system',
        details: { targetUserId: params.userId },
      });
      return reply.send({ data: { requested: true } });
    },
  );
};
