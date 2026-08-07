import crypto from 'node:crypto';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { normalizeSystemRole } from '@followup/shared-rbac';

import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { verifySsoAccessToken } from './ssoVerify.js';
import { AuthService } from './service.js';
import { AMBIGUOUS_LOGIN_IDENTITY_CODE } from '../../lib/workspaceScopedIdentity.js';
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from './cookieAuth.js';
import {
  authForgotPasswordRateLimit,
  authLoginRateLimit,
  authRefreshRateLimit,
} from '../../lib/rateLimitProfiles.js';
import { expandForStringOrObjectIdIn } from '../../lib/mongoIdentity.js';
import { decryptSecret, encryptSecret } from '../../lib/secrets.js';
import { buildTotpUri, generateTotpSecret, verifyTotpCode } from './totp.js';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  mfaCode: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/)
    .optional(),
});
const ssoExchangeSchema = z.object({ token: z.string().min(10) });
const forgotPasswordSchema = z.object({ email: z.string().trim().email() });
const resetPasswordSchema = z.object({
  token: z.string().min(32),
  newPassword: z.string().min(12),
});
const inviteAcceptSchema = z.object({
  token: z.string().min(32),
  newPassword: z.string().min(12),
});
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});
const mfaCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/),
});
const mfaDisableSchema = z.object({
  currentPassword: z.string().min(1),
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/),
});

const err = { $ref: 'ErrorResponse#' };
const hashOpaqueToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const booleanDataResponse = (propertyName: string) => ({
  type: 'object',
  additionalProperties: false,
  required: ['data'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: [propertyName],
      properties: { [propertyName]: { type: 'boolean' } },
    },
  },
});

const accessTokenResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['data'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['accessToken'],
      properties: { accessToken: { type: 'string', minLength: 20 } },
    },
  },
};

const loginResponse = {
  type: 'object',
  additionalProperties: false,
  required: ['data'],
  properties: {
    data: {
      type: 'object',
      additionalProperties: false,
      required: ['accessToken', 'user'],
      properties: {
        accessToken: { type: 'string', minLength: 20 },
        user: {
          type: 'object',
          additionalProperties: false,
          required: ['id', 'email', 'systemRole', 'isTecmaAdmin', 'permissions'],
          properties: {
            id: { type: 'string' },
            email: { type: 'string', format: 'email' },
            systemRole: { type: 'string' },
            isTecmaAdmin: { type: 'boolean' },
            permissions: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  },
};

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  const authService = new AuthService(app);
  const loginGuards = app.mongoDb.collection('tz_auth_login_guards');
  const maxAttempts = Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS ?? 8);
  const lockMinutes = Number(process.env.AUTH_LOGIN_LOCK_MINUTES ?? 15);
  const guardKeys = (email: string, ip: string): string[] => [`email:${email}`, `ip:${ip}`];
  const nowIso = () => new Date().toISOString();
  const bumpAuthTokenVersion = async (
    userId: string,
    updatedAt: string = nowIso(),
  ): Promise<void> => {
    await app.mongoDb
      .collection('tz_users')
      .updateMany(
        { _id: { $in: expandForStringOrObjectIdIn([userId]) } } as any,
        { $inc: { authTokenVersion: 1 }, $set: { updatedAt } } as any,
      );
  };
  const findAuthenticatedUser = async (userId: string) =>
    app.mongoDb.collection('tz_users').findOne({
      _id: { $in: expandForStringOrObjectIdIn([userId]) },
      status: { $ne: 'deleted' },
    } as any);

  /**
   * Rate limit per IP su endpoint di recupero password.
   * Max 10 richieste / ora per IP (anti email-bombing e brute-force token).
   * Non attivo in dev/test per non bloccare i test automatici.
   */
  const isDevLike = app.config.NODE_ENV === 'development' || app.config.NODE_ENV === 'test';
  const passwordRateLimitMax = Number(process.env.AUTH_PASSWORD_RATE_LIMIT ?? 10);

  const passwordRateLimit = isDevLike
    ? []
    : [
        async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
          const now = Date.now();
          const windowMs = 60 * 60 * 1000; // 1 ora
          const bucketKey = `pwd_rate:${request.ip}:${Math.floor(now / windowMs)}`;
          const ts = new Date(now).toISOString();

          const guardResult = (await loginGuards.findOneAndUpdate(
            { _id: bucketKey } as any,
            {
              $inc: { attempts: 1 },
              $set: { ip: request.ip, type: 'password_rate', updatedAt: ts },
              $setOnInsert: { createdAt: ts },
            } as any,
            { upsert: true, returnDocument: 'after' } as any,
          )) as unknown as { attempts?: unknown; value?: { attempts?: unknown } | null };
          const attempts =
            typeof guardResult.attempts === 'number'
              ? guardResult.attempts
              : typeof guardResult.value?.attempts === 'number'
                ? guardResult.value.attempts
                : passwordRateLimitMax + 1;

          if (attempts > passwordRateLimitMax) {
            return reply.status(429).send({
              error: {
                code: 'TooManyRequests',
                message: `Troppe richieste. Riprova tra un'ora.`,
                status: 429,
              },
            });
          }
        },
      ];

  const isStrongPassword = (password: string): boolean =>
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password) &&
    password.length >= 12;

  /** Evita 404 confusi quando qualcuno apre GET /v1/auth/login nel browser (il login è solo POST). */
  app.get(
    '/v1/auth/login',
    {
      schema: {
        hide: true,
        tags: ['Auth'],
        operationId: 'authLoginMethodHint',
        summary: 'Login disponibile solo via POST',
        description:
          'Questa route non esegue login. Usare POST /v1/auth/login con body JSON { email, password }.',
        security: [],
        response: {
          405: err,
        },
      },
    },
    async (_request, reply) =>
      reply
        .code(405)
        .header('Allow', 'POST')
        .send({
          error: {
            code: 'MethodNotAllowed',
            message:
              'Usa POST /v1/auth/login con JSON { "email", "password" }. GET non è supportato (non aprire questo URL nel browser).',
            status: 405,
          },
        }),
  );

  app.post(
    '/v1/auth/login',
    {
      config: { rateLimit: authLoginRateLimit(app.config) },
      schema: {
        tags: ['Auth'],
        operationId: 'authLogin',
        summary: 'Login con email e password',
        description:
          'Autentica utente e restituisce access token + profilo. Il refresh token viene impostato via cookie HttpOnly.',
        security: [],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', description: 'Email utente' },
            password: { type: 'string', minLength: 1, description: 'Password' },
            mfaCode: {
              type: 'string',
              pattern: '^[0-9]{6}$',
              description: 'Codice a 6 cifre dell app authenticator, se MFA attiva',
            },
          },
          additionalProperties: false,
        },
        response: {
          200: {
            ...loginResponse,
            description: 'Access token + profilo (refresh in cookie HttpOnly)',
          },
          401: err,
          409: err,
          403: err,
          429: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = loginSchema.parse(request.body);
      const normalizedEmail = payload.email.trim().toLowerCase();
      const keys = guardKeys(normalizedEmail, request.ip);
      const currentGuards = (
        (await loginGuards.find({ _id: { $in: keys } } as any).toArray()) as Array<{
          _id: unknown;
          attempts?: unknown;
          lockUntil?: unknown;
        }>
      ).map((guard) => ({
        _id: String(guard._id),
        attempts: typeof guard.attempts === 'number' ? guard.attempts : undefined,
        lockUntil: typeof guard.lockUntil === 'string' ? guard.lockUntil : undefined,
      }));
      const lockedGuard = currentGuards.find(
        (guard) => guard.lockUntil != null && new Date(guard.lockUntil).getTime() > Date.now(),
      );
      if (lockedGuard != null) {
        return reply.status(429).send({
          error: {
            code: 'TooManyRequests',
            message: 'Too many login attempts. Please retry later.',
            status: 429,
          },
        });
      }
      try {
        const result = await authService.login(payload.email, payload.password, {
          ...(request.headers['user-agent'] != null
            ? { userAgent: String(request.headers['user-agent']) }
            : {}),
          ip: request.ip,
          ...(payload.mfaCode != null ? { mfaCode: payload.mfaCode } : {}),
        });
        setRefreshTokenCookie(app, reply, result.refreshToken);
        await loginGuards.deleteMany({ _id: { $in: keys } } as any);
        return reply.send({
          data: {
            accessToken: result.accessToken,
            user: result.user,
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message === 'MFA_REQUIRED') {
          return reply.status(403).send({
            error: {
              code: 'MfaRequired',
              message: 'MFA required for this workspace/user',
              status: 403,
            },
          });
        }
        if (error instanceof Error && error.message === 'MFA_CODE_REQUIRED') {
          return reply.status(401).send({
            error: {
              code: 'MfaCodeRequired',
              message: 'Codice di verifica richiesto.',
              status: 401,
            },
          });
        }
        if (error instanceof Error && error.message === 'MFA_INVALID_CODE') {
          return reply.status(401).send({
            error: {
              code: 'InvalidMfaCode',
              message: 'Codice di verifica non valido.',
              status: 401,
            },
          });
        }
        if (error instanceof Error && error.message === AMBIGUOUS_LOGIN_IDENTITY_CODE) {
          return reply.status(409).send({
            error: {
              code: 'AmbiguousLoginIdentity',
              message:
                'Questa email corrisponde a più identità. Contatta Tecma per scegliere quella corretta.',
              status: 409,
            },
          });
        }
        for (const key of keys) {
          const currentGuard = currentGuards.find((guard) => guard._id === key);
          const now = new Date();
          const attempts = (currentGuard?.attempts ?? 0) + 1;
          const lockUntil =
            attempts >= maxAttempts
              ? new Date(now.getTime() + lockMinutes * 60 * 1000).toISOString()
              : null;
          const ts = nowIso();
          await loginGuards.updateOne(
            { _id: key } as any,
            {
              $set: {
                email: normalizedEmail,
                ip: request.ip,
                attempts,
                lockUntil,
                lastFailedAt: ts,
                updatedAt: ts,
              },
              $setOnInsert: {
                createdAt: ts,
              },
            } as any,
            { upsert: true } as any,
          );
        }
        return reply.status(401).send({
          error: { code: 'InvalidCredentials', message: 'Invalid credentials', status: 401 },
        });
      }
    },
  );

  app.post(
    '/v1/auth/refresh',
    {
      config: { rateLimit: authRefreshRateLimit(app.config) },
      schema: {
        tags: ['Auth'],
        operationId: 'authRefresh',
        summary: 'Rinnova access token',
        description:
          'Scambia refresh token per nuova coppia (rotazione). Richiede cookie HttpOnly `followup_refresh_token` impostato dal login.',
        security: [],
        response: {
          200: accessTokenResponse,
          401: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const refreshToken = readRefreshTokenCookie(request);
      if (refreshToken == null) {
        return reply.status(401).send({
          error: { code: 'InvalidRefreshToken', message: 'Invalid refresh token', status: 401 },
        });
      }
      try {
        const result = await authService.refresh(refreshToken);
        setRefreshTokenCookie(app, reply, result.refreshToken);
        return reply.send({ data: { accessToken: result.accessToken } });
      } catch {
        return reply.status(401).send({
          error: { code: 'InvalidRefreshToken', message: 'Invalid refresh token', status: 401 },
        });
      }
    },
  );

  app.post(
    '/v1/auth/forgot-password',
    {
      config: { rateLimit: authForgotPasswordRateLimit(app.config) },
      preHandler: passwordRateLimit,
      schema: {
        tags: ['Auth'],
        operationId: 'authForgotPassword',
        summary: 'Richiede reset password',
        description: 'Risposta neutra anti-enumerazione; invia email solo se account valido.',
        security: [],
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email', description: 'Email utente' },
          },
        },
        response: {
          202: booleanDataResponse('accepted'),
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = forgotPasswordSchema.parse(request.body);
      try {
        await authService.requestPasswordReset(payload.email, request.ip);
      } catch {
        // neutral response by design
      }
      return reply.status(202).send({ data: { accepted: true } });
    },
  );

  app.post(
    '/v1/auth/reset-password',
    {
      preHandler: passwordRateLimit,
      schema: {
        tags: ['Auth'],
        operationId: 'authResetPassword',
        summary: 'Completa reset password',
        description: 'Consuma token monouso hashato e aggiorna password utente.',
        security: [],
        body: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: { type: 'string', minLength: 32, description: 'Token reset password' },
            newPassword: {
              type: 'string',
              minLength: 12,
              description: 'Nuova password forte',
            },
          },
        },
        response: {
          200: booleanDataResponse('reset'),
          400: err,
          401: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = resetPasswordSchema.parse(request.body);
      if (!isStrongPassword(payload.newPassword)) {
        return reply.status(400).send({
          error: {
            code: 'WeakPassword',
            message:
              'Password must be at least 12 chars and include upper/lower case, number and symbol.',
            status: 400,
          },
        });
      }
      try {
        await authService.resetPassword({
          token: payload.token,
          newPasswordHash: await bcrypt.hash(payload.newPassword, 10),
          ip: request.ip,
        });
        return reply.send({ data: { reset: true } });
      } catch {
        return reply.status(401).send({
          error: { code: 'InvalidResetToken', message: 'Invalid reset token', status: 401 },
        });
      }
    },
  );

  app.post(
    '/v1/auth/invite-accept',
    {
      preHandler: passwordRateLimit,
      schema: {
        tags: ['Auth'],
        operationId: 'authInviteAccept',
        summary: 'Accetta invito workspace',
        description: 'Consuma token invito monouso e imposta password forte.',
        security: [],
        body: {
          type: 'object',
          required: ['token', 'newPassword'],
          properties: {
            token: { type: 'string', minLength: 32 },
            newPassword: { type: 'string', minLength: 12 },
          },
        },
        response: {
          200: booleanDataResponse('accepted'),
          400: err,
          401: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = inviteAcceptSchema.parse(request.body);
      if (!isStrongPassword(payload.newPassword)) {
        return reply.status(400).send({
          error: {
            code: 'WeakPassword',
            message:
              'Password must be at least 12 chars and include upper/lower case, number and symbol.',
            status: 400,
          },
        });
      }

      const inviteTokens = app.mongoDb.collection('tz_inviteTokens');
      const tokenHash = hashOpaqueToken(payload.token);
      const now = new Date().toISOString();
      const tokenDoc = (await inviteTokens.findOne({
        tokenHash,
        status: 'active',
        consumedAt: { $exists: false },
        expiresAt: { $gt: now },
      } as any)) as {
        _id?: unknown;
        userId?: unknown;
        workspaceId?: unknown;
        role?: unknown;
      } | null;
      if (tokenDoc == null || tokenDoc.userId == null) {
        return reply.status(401).send({
          error: { code: 'InvalidInviteToken', message: 'Invalid invite token', status: 401 },
        });
      }

      const consume = await inviteTokens.updateOne(
        {
          tokenHash,
          status: 'active',
          consumedAt: { $exists: false },
          expiresAt: { $gt: now },
        } as any,
        { $set: { status: 'used', consumedAt: now, usedAt: now, consumedByIp: request.ip } } as any,
      );
      if (consume.matchedCount === 0) {
        return reply.status(401).send({
          error: { code: 'InvalidInviteToken', message: 'Invalid invite token', status: 401 },
        });
      }

      const userId = String(tokenDoc.userId);
      const userObjectId = ObjectId.isValid(userId) ? new ObjectId(userId) : null;
      const userFilter = userObjectId != null ? { _id: userObjectId } : { _id: userId };
      const passwordHash = await bcrypt.hash(payload.newPassword, 10);
      const userUpdate = await app.mongoDb
        .collection('tz_users')
        .updateOne(
          { ...userFilter, status: { $ne: 'deleted' } } as any,
          { $set: { passwordHash, status: 'active', updatedAt: now } } as any,
        );
      if (userUpdate.matchedCount === 0) {
        return reply.status(401).send({
          error: { code: 'InvalidInviteToken', message: 'Invalid invite token', status: 401 },
        });
      }

      if (tokenDoc.workspaceId != null) {
        const membershipSet: Record<string, unknown> = {
          status: 'active',
          acceptedAt: now,
          updatedAt: now,
        };
        if (typeof tokenDoc.role === 'string') membershipSet.role = tokenDoc.role;
        await app.mongoDb.collection('tz_user_workspaces').updateOne(
          {
            workspaceId: String(tokenDoc.workspaceId),
            userId,
            status: { $in: ['invited', 'active'] },
          } as any,
          {
            $set: membershipSet,
          } as any,
        );
      }
      await app.mongoDb.collection('tz_authSessions').deleteMany({ userId } as any);
      await bumpAuthTokenVersion(userId, now);
      await app.auditService.authEvent({
        eventType: 'auth.invite.accepted',
        userId,
        details: { workspaceId: tokenDoc.workspaceId },
      });

      return reply.send({ data: { accepted: true } });
    },
  );

  app.post(
    '/v1/auth/change-password',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Auth'],
        operationId: 'authChangePassword',
        summary: 'Cambio password autenticato',
        description: 'Aggiorna password e revoca sessioni attive.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentPassword', 'newPassword'],
          properties: {
            currentPassword: { type: 'string', minLength: 1, description: 'Password corrente' },
            newPassword: {
              type: 'string',
              minLength: 12,
              description: 'Nuova password forte',
            },
          },
        },
        response: {
          200: booleanDataResponse('changed'),
          400: err,
          401: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = changePasswordSchema.parse(request.body);
      if (payload.currentPassword === payload.newPassword) {
        return reply.status(400).send({
          error: {
            code: 'PasswordReuse',
            message: 'New password must be different from current password',
            status: 400,
          },
        });
      }
      if (!isStrongPassword(payload.newPassword)) {
        return reply.status(400).send({
          error: {
            code: 'WeakPassword',
            message:
              'Password must be at least 12 chars and include upper/lower case, number and symbol.',
            status: 400,
          },
        });
      }
      try {
        await authService.changePassword({
          userId: (request.user as { sub: string }).sub,
          currentPassword: payload.currentPassword,
          newPasswordHash: await bcrypt.hash(payload.newPassword, 10),
        });
        return reply.send({ data: { changed: true } });
      } catch {
        return reply.status(401).send({
          error: { code: 'InvalidCredentials', message: 'Invalid credentials', status: 401 },
        });
      }
    },
  );

  app.post(
    '/v1/auth/mfa/setup',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Auth'],
        operationId: 'authMfaSetup',
        summary: 'Avvia configurazione MFA',
        description:
          'Genera un segreto TOTP temporaneo per configurare un app authenticator. Il segreto va confermato con /v1/auth/mfa/verify.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['data'],
            properties: {
              data: {
                type: 'object',
                additionalProperties: false,
                required: ['secret', 'otpauthUrl', 'expiresAt'],
                properties: {
                  secret: { type: 'string' },
                  otpauthUrl: { type: 'string' },
                  expiresAt: { type: 'string' },
                },
              },
            },
          },
          401: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const userId = (request.user as { sub: string }).sub;
      const user = await findAuthenticatedUser(userId);
      if (user == null) {
        return reply.status(401).send({
          error: { code: 'InvalidCredentials', message: 'Invalid credentials', status: 401 },
        });
      }

      const secret = generateTotpSecret();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await app.mongoDb.collection('tz_users').updateOne(
        { _id: { $in: expandForStringOrObjectIdIn([userId]) } } as any,
        {
          $set: {
            mfaPendingSecretEncrypted: encryptSecret(secret),
            mfaPendingExpiresAt: expiresAt,
            updatedAt: nowIso(),
          },
        } as any,
      );

      await app.auditService.authEvent({
        eventType: 'auth.mfa.setup_started',
        userId,
        details: { expiresAt },
      });

      return reply.send({
        data: {
          secret,
          otpauthUrl: buildTotpUri({
            issuer: 'Followup 3.0',
            accountName: String((user as { email?: unknown }).email ?? userId),
            secret,
          }),
          expiresAt,
        },
      });
    },
  );

  app.post(
    '/v1/auth/mfa/verify',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Auth'],
        operationId: 'authMfaVerify',
        summary: 'Conferma configurazione MFA',
        description: 'Verifica codice TOTP e abilita MFA per utente autenticato.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['code'],
          additionalProperties: false,
          properties: { code: { type: 'string', pattern: '^[0-9]{6}$' } },
        },
        response: {
          200: booleanDataResponse('enabled'),
          400: err,
          401: err,
          409: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = mfaCodeSchema.parse(request.body);
      const userId = (request.user as { sub: string }).sub;
      const user = (await findAuthenticatedUser(userId)) as {
        mfaPendingSecretEncrypted?: unknown;
        mfaPendingExpiresAt?: unknown;
      } | null;
      if (user == null) {
        return reply.status(401).send({
          error: { code: 'InvalidCredentials', message: 'Invalid credentials', status: 401 },
        });
      }

      if (
        typeof user.mfaPendingSecretEncrypted !== 'string' ||
        typeof user.mfaPendingExpiresAt !== 'string' ||
        new Date(user.mfaPendingExpiresAt).getTime() <= Date.now()
      ) {
        return reply.status(409).send({
          error: {
            code: 'MfaSetupExpired',
            message: 'Configurazione MFA scaduta. Avviala di nuovo.',
            status: 409,
          },
        });
      }

      const secret = decryptSecret(user.mfaPendingSecretEncrypted);
      if (!verifyTotpCode(secret, payload.code)) {
        return reply.status(401).send({
          error: { code: 'InvalidMfaCode', message: 'Codice MFA non valido.', status: 401 },
        });
      }

      const now = nowIso();
      await app.mongoDb.collection('tz_users').updateOne(
        { _id: { $in: expandForStringOrObjectIdIn([userId]) } } as any,
        {
          $set: {
            mfaEnabled: true,
            mfaSecretEncrypted: user.mfaPendingSecretEncrypted,
            updatedAt: now,
          },
          $unset: { mfaPendingSecretEncrypted: '', mfaPendingExpiresAt: '' },
        } as any,
      );
      await app.auditService.authEvent({
        eventType: 'auth.mfa.enabled',
        userId,
        details: {},
      });
      return reply.send({ data: { enabled: true } });
    },
  );

  app.delete(
    '/v1/auth/mfa',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Auth'],
        operationId: 'authMfaDisable',
        summary: 'Disabilita MFA',
        description:
          'Disabilita MFA dopo verifica password corrente e codice TOTP. Revoca le sessioni attive.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['currentPassword', 'code'],
          additionalProperties: false,
          properties: {
            currentPassword: { type: 'string', minLength: 1 },
            code: { type: 'string', pattern: '^[0-9]{6}$' },
          },
        },
        response: {
          200: booleanDataResponse('enabled'),
          400: err,
          401: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = mfaDisableSchema.parse(request.body);
      const userId = (request.user as { sub: string }).sub;
      const user = (await findAuthenticatedUser(userId)) as {
        passwordHash?: unknown;
        mfaEnabled?: unknown;
        mfaSecretEncrypted?: unknown;
      } | null;
      if (
        user == null ||
        typeof user.passwordHash !== 'string' ||
        !(await bcrypt.compare(payload.currentPassword, user.passwordHash))
      ) {
        return reply.status(401).send({
          error: { code: 'InvalidCredentials', message: 'Invalid credentials', status: 401 },
        });
      }

      if (user.mfaEnabled === true) {
        if (
          typeof user.mfaSecretEncrypted !== 'string' ||
          !verifyTotpCode(decryptSecret(user.mfaSecretEncrypted), payload.code)
        ) {
          return reply.status(401).send({
            error: { code: 'InvalidMfaCode', message: 'Codice MFA non valido.', status: 401 },
          });
        }
      }

      const now = nowIso();
      await app.mongoDb.collection('tz_users').updateOne(
        { _id: { $in: expandForStringOrObjectIdIn([userId]) } } as any,
        {
          $set: { mfaEnabled: false, updatedAt: now },
          $unset: {
            mfaSecretEncrypted: '',
            mfaPendingSecretEncrypted: '',
            mfaPendingExpiresAt: '',
          },
          $inc: { authTokenVersion: 1 },
        } as any,
      );
      await app.mongoDb.collection('tz_authSessions').deleteMany({ userId } as any);
      await app.auditService.authEvent({
        eventType: 'auth.mfa.disabled',
        userId,
        details: {},
      });
      clearRefreshTokenCookie(app, reply);
      return reply.send({ data: { enabled: false } });
    },
  );

  app.post(
    '/v1/auth/logout',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'authLogout',
        summary: 'Invalida refresh token',
        description:
          'Revoca sessione refresh lato server. Usa cookie HttpOnly `followup_refresh_token` se presente.',
        security: [],
        response: {
          200: booleanDataResponse('ok'),
          400: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const refreshToken = readRefreshTokenCookie(request);
      if (refreshToken != null) {
        await authService.logout(refreshToken);
      }
      clearRefreshTokenCookie(app, reply);
      return reply.send({ data: { ok: true } });
    },
  );

  app.get(
    '/v1/auth/me',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Auth'],
        operationId: 'authMe',
        summary: 'Profilo da JWT',
        description: 'Dati minimi utente dal token corrente.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            required: ['data'],
            properties: {
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  email: { type: 'string' },
                  systemRole: { type: 'string' },
                  isTecmaAdmin: { type: 'boolean' },
                  permissions: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
          401: err,
          403: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const user = request.user as {
        sub: string;
        email: string;
        systemRole?: string;
        system_role?: string;
        isTecmaAdmin?: boolean;
        permissions?: string[];
      };
      const systemRole = normalizeSystemRole(user) ?? 'user';
      return reply.send({
        data: {
          id: user.sub,
          email: user.email,
          systemRole,
          isTecmaAdmin: user.isTecmaAdmin === true || systemRole === 'tecma_admin',
          permissions: user.permissions ?? [],
        },
      });
    },
  );

  /**
   * Wave B (PR40 cross-domain): gestione sessioni utente.
   * - GET    /v1/auth/sessions             elenco sessioni attive del chiamante
   * - DELETE /v1/auth/sessions/:sessionId  revoca singola sessione
   * - DELETE /v1/auth/sessions             revoca tutte le sessioni del chiamante
   *
   * Si appoggia direttamente alla collection `tz_authSessions` dove auth/service.ts
   * gia persiste sessionId/userId/createdAt/expiresAt/userAgent/ip per ogni login.
   */
  app.get(
    '/v1/auth/sessions',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Auth'],
        operationId: 'listAuthSessions',
        summary: 'Elenca sessioni attive del chiamante',
        description:
          'Ritorna le sessioni con scadenza futura per l utente autenticato. Non espone refreshTokenHash.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['data'],
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['sessionId', 'createdAt', 'expiresAt'],
                  properties: {
                    sessionId: { type: 'string' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                    rotatedAt: { type: 'string' },
                    expiresAt: { type: 'string' },
                    userAgent: { type: 'string' },
                    ip: { type: 'string' },
                  },
                  additionalProperties: false,
                },
              },
            },
          },
          401: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const sessions = await app.mongoDb
        .collection('tz_authSessions')
        .find({
          userId: user.sub,
          expiresAt: { $gt: new Date().toISOString() },
        } as any)
        .sort({ createdAt: -1 })
        .toArray();

      const data = sessions.map((s: Record<string, unknown>) => {
        const out: Record<string, unknown> = {
          sessionId: String(s.sessionId ?? ''),
          createdAt: typeof s.createdAt === 'string' ? s.createdAt : '',
          expiresAt: typeof s.expiresAt === 'string' ? s.expiresAt : '',
        };
        if (typeof s.updatedAt === 'string') out.updatedAt = s.updatedAt;
        if (typeof s.rotatedAt === 'string') out.rotatedAt = s.rotatedAt;
        if (typeof s.userAgent === 'string') out.userAgent = s.userAgent;
        if (typeof s.ip === 'string') out.ip = s.ip;
        return out;
      });
      return reply.send({ data });
    },
  );

  app.delete(
    '/v1/auth/sessions/:sessionId',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Auth'],
        operationId: 'revokeAuthSession',
        summary: 'Revoca singola sessione del chiamante',
        description:
          'Elimina la sessione (sessionId). Le sessioni di altri utenti restituiscono 404 senza distinguere da inesistente (anti-enumeration).',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        params: {
          type: 'object',
          required: ['sessionId'],
          properties: { sessionId: { type: 'string', minLength: 1 } },
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['data'],
            properties: {
              data: {
                type: 'object',
                additionalProperties: false,
                required: ['ok'],
                properties: { ok: { type: 'boolean' } },
              },
            },
          },
          401: err,
          404: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const { sessionId } = request.params as { sessionId: string };

      // Cerchiamo prima la sessione per verificarne la ownership.
      const session = await app.mongoDb.collection('tz_authSessions').findOne({ sessionId } as any);

      // Anti-enumeration: 404 sia per sessione inesistente sia per sessione di altro user.
      if (session == null || (session as { userId?: string }).userId !== user.sub) {
        return reply.status(404).send({
          error: { code: 'NotFound', message: 'Session not found', status: 404 },
        });
      }

      await app.mongoDb.collection('tz_authSessions').deleteOne({ sessionId } as any);
      return reply.send({ data: { ok: true } });
    },
  );

  app.delete(
    '/v1/auth/sessions',
    {
      preHandler: [app.authenticate],
      schema: {
        tags: ['Auth'],
        operationId: 'revokeAllAuthSessions',
        summary: 'Revoca tutte le sessioni del chiamante',
        description:
          'Elimina tutte le sessioni dell utente autenticato. Forza re-login su ogni device. Il client corrente ricevera 401 al prossimo refresh.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['data'],
            properties: {
              data: {
                type: 'object',
                additionalProperties: false,
                required: ['ok', 'revoked'],
                properties: {
                  ok: { type: 'boolean' },
                  revoked: { type: 'integer', minimum: 0 },
                },
              },
            },
          },
          401: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const user = request.user as { sub: string };
      const result = await app.mongoDb
        .collection('tz_authSessions')
        .deleteMany({ userId: user.sub } as any);
      await bumpAuthTokenVersion(user.sub);
      return reply.send({
        data: { ok: true, revoked: result.deletedCount ?? 0 },
      });
    },
  );

  app.post(
    '/v1/auth/sso-exchange',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'authSsoExchange',
        summary: 'Scambio token SSO con JWT interno',
        description: 'Valida access token OIDC via JWKS e emette JWT interno.',
        security: [],
        body: {
          type: 'object',
          required: ['token'],
          properties: {
            token: { type: 'string', minLength: 10, description: 'Access token OIDC' },
          },
        },
        response: {
          200: accessTokenResponse,
          401: err,
          403: err,
          503: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = ssoExchangeSchema.parse(request.body);
      if (!app.config.SSO_JWKS_URI?.trim()) {
        return reply.status(503).send({
          error: { code: 'SsoNotConfigured', message: 'SSO is not configured', status: 503 },
        });
      }

      let claims: { sub: string; email: string };
      try {
        claims = await verifySsoAccessToken(payload.token, app.config);
      } catch {
        return reply.status(401).send({
          error: { code: 'InvalidSsoToken', message: 'Invalid or expired SSO token', status: 401 },
        });
      }

      let accessToken: string;
      try {
        accessToken = await authService.issueSsoAccessToken(claims);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg === 'SSO user not provisioned') {
          return reply.status(403).send({
            error: {
              code: 'SsoUserNotProvisioned',
              message: "Account non trovato. Contatta l'amministratore per richiedere l'accesso.",
              status: 403,
            },
          });
        }
        if (msg === 'SSO user not active') {
          return reply.status(403).send({
            error: {
              code: 'SsoUserNotActive',
              message: "Account disabilitato. Contatta l'amministratore.",
              status: 403,
            },
          });
        }
        throw err;
      }

      await app.auditService.authEvent({
        eventType: 'auth.sso.exchange',
        userId: claims.sub,
        details: { provider: 'keycloak', email: claims.email },
      });

      return reply.send({ data: { accessToken } });
    },
  );
};
