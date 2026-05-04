import crypto from 'node:crypto';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

import { MongoRepository } from '@followup/db';

import type { FastifyInstance } from 'fastify';

import { singlePagePaginationInfo } from '../../lib/pagination.js';
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
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  systemRole: z.enum(['user', 'tecma_admin', 'tecma_superadmin']).optional(),
});

const omitPasswordHash = (doc: Record<string, unknown>): Record<string, unknown> => {
  const out = { ...doc };
  delete out.passwordHash;
  return out;
};

export const usersRoutes = async (app: FastifyInstance): Promise<void> => {
  const usersRepo = new MongoRepository<any>(app.mongoDb.collection('tz_users'));
  const parseUserObjectId = (rawUserId: string): ObjectId | null => {
    if (!ObjectId.isValid(rawUserId)) return null;
    return new ObjectId(rawUserId);
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
      preHandler: [app.authenticate, app.requirePermission('users.invite')],
      schema: {
        ...createdObjectSchema('inviteUser', 'Users', 'Invita utente'),
        body: {
          type: 'object',
          required: ['email', 'fullName'],
          properties: {
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string', minLength: 2 },
            role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = createUserSchema.parse(request.body);
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
            systemRole: { type: 'string', enum: ['user', 'tecma_admin', 'tecma_superadmin'] },
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
      await usersRepo.updateOne(
        { _id: userObjectId },
        { $set: { ...payload, updatedAt: new Date().toISOString() } },
      );
      const user = await usersRepo.findOne({ _id: userObjectId });
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
