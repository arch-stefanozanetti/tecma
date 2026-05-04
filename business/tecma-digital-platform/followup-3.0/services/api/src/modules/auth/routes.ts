import { z } from 'zod';

import type { FastifyInstance } from 'fastify';

import { verifySsoAccessToken } from './ssoVerify.js';
import { AuthService } from './service.js';

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
const refreshSchema = z.object({ refreshToken: z.string().min(20) });
const logoutSchema = z.object({ refreshToken: z.string().min(20) });
const ssoExchangeSchema = z.object({ token: z.string().min(10) });

const err = { $ref: 'ErrorResponse#' };

export const authRoutes = async (app: FastifyInstance): Promise<void> => {
  const authService = new AuthService(app);

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
          405: { type: 'object', additionalProperties: true, description: 'Method not allowed' },
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
      schema: {
        tags: ['Auth'],
        operationId: 'authLogin',
        summary: 'Login con email e password',
        description: 'Autentica utente e restituisce access/refresh token.',
        security: [],
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email', description: 'Email utente' },
            password: { type: 'string', minLength: 1, description: 'Password' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true, description: 'Token e profilo' },
          401: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = loginSchema.parse(request.body);
      try {
        const result = await authService.login(
          payload.email,
          payload.password,
          request.headers['user-agent'] != null
            ? { userAgent: String(request.headers['user-agent']), ip: request.ip }
            : { ip: request.ip },
        );
        return reply.send({ data: result });
      } catch {
        return reply.status(401).send({
          error: { code: 'InvalidCredentials', message: 'Invalid credentials', status: 401 },
        });
      }
    },
  );

  app.post(
    '/v1/auth/refresh',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'authRefresh',
        summary: 'Rinnova access token',
        description: 'Scambia refresh token per nuova coppia di token.',
        security: [],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', minLength: 20, description: 'Refresh token opaco' },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          401: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = refreshSchema.parse(request.body);
      try {
        const result = await authService.refresh(payload.refreshToken);
        return reply.send({ data: result });
      } catch {
        return reply.status(401).send({
          error: { code: 'InvalidRefreshToken', message: 'Invalid refresh token', status: 401 },
        });
      }
    },
  );

  app.post(
    '/v1/auth/logout',
    {
      schema: {
        tags: ['Auth'],
        operationId: 'authLogout',
        summary: 'Invalida refresh token',
        description: 'Revoca sessione refresh lato server.',
        security: [],
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string', minLength: 20 },
          },
        },
        response: {
          200: { type: 'object', additionalProperties: true },
          400: err,
          500: err,
        },
      },
    },
    async (request, reply) => {
      const payload = logoutSchema.parse(request.body);
      await authService.logout(payload.refreshToken);
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
      const user = request.user as { sub: string; email: string; systemRole?: string };
      return reply.send({
        data: {
          id: user.sub,
          email: user.email,
          systemRole: user.systemRole ?? 'user',
        },
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
          200: { type: 'object', additionalProperties: true },
          401: err,
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

      const accessToken = await app.jwt.sign({
        sub: claims.sub,
        email: claims.email,
        systemRole: 'user',
        permissions: ['users.read', 'workspaces.read', 'projects.read', 'session.write'],
      });

      await app.auditService.authEvent({
        eventType: 'auth.sso.exchange',
        userId: claims.sub,
        details: { provider: 'keycloak', email: claims.email },
      });

      return reply.send({ data: { accessToken } });
    },
  );
};
