/**
 * Rate limit per-rotta sensibili.
 *
 * Ogni rotta sensibile (login, password-reset, invite, mutazioni utenti/progetti/workspace)
 * dichiara qui la propria policy. Le policy sono profile-aware:
 * - `strict` (default per `staging`/`production`): limiti bassi e identita-specific.
 * - `loose` (default per `development`/`test`): max=10000/min (di fatto disattivati).
 *
 * Le policy sono pure funzioni che ricevono `app.config` e ritornano l'oggetto config
 * per `@fastify/rate-limit` per-route. Si appoggiano a `resolveRateLimitProfile`.
 *
 * NOTA: il limite "di fatto disattivato" in `loose` (10000/min) e necessario perche le
 * suite integration tipicamente eseguono molte chiamate dallo stesso IP nello stesso
 * file di test. Lo spostamento al profilo `strict` per i test specifici di abuse e
 * deliberato (vedi `tests/integration/rate-limit-per-route.integration.test.ts`).
 */
import type { FastifyRequest } from 'fastify';

import { resolveRateLimitProfile, type AppConfig } from '@followup/shared-config';

const LOOSE_MAX = 10_000;

interface PerRouteRateLimitConfig {
  max: number;
  timeWindow: string;
  keyGenerator: (req: FastifyRequest) => string;
}

const extractEmailFromBody = (req: FastifyRequest): string => {
  const body = req.body as { email?: unknown } | undefined;
  if (body == null || typeof body.email !== 'string') return '';
  return body.email.trim().toLowerCase();
};

const getActorUserId = (req: FastifyRequest): string => {
  const user = (req as FastifyRequest & { user?: { sub?: string } }).user;
  return typeof user?.sub === 'string' && user.sub.length > 0 ? user.sub : '';
};

/** POST /v1/auth/login — strict: 5/min per IP+email. */
export const authLoginRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 5 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `auth.login:${req.ip}:${extractEmailFromBody(req)}`,
  };
};

/** POST /v1/auth/refresh — strict: 30/min per IP. */
export const authRefreshRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 30 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `auth.refresh:${req.ip}`,
  };
};

/** POST /v1/auth/forgot-password — strict: 3/min per IP+email (anti-enumeration + anti-spam). */
export const authForgotPasswordRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 3 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `auth.forgot:${req.ip}:${extractEmailFromBody(req)}`,
  };
};

/** POST /v1/users — strict: 10/min per actor (autenticato). */
export const usersCreateRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 10 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `users.create:${getActorUserId(req) || req.ip}`,
  };
};

/** POST /v1/users/bulk-invite — strict: 3/min per actor (chiamata pesante). */
export const usersBulkInviteRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 3 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `users.bulkInvite:${getActorUserId(req) || req.ip}`,
  };
};

/** POST /v1/users/:userId/password-reset — strict: 5/min per actor. */
export const usersPasswordResetRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 5 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `users.passwordReset:${getActorUserId(req) || req.ip}`,
  };
};

/** POST /v1/users/:userId/{deactivate,reactivate} — strict: 10/min per actor. */
export const usersStateChangeRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 10 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `users.stateChange:${getActorUserId(req) || req.ip}`,
  };
};

/** POST /v1/projects — strict: 20/min per actor. */
export const projectsCreateRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 20 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `projects.create:${getActorUserId(req) || req.ip}`,
  };
};

/** POST /v1/projects/:projectId/access — strict: 30/min per actor. */
export const projectsGrantCreateRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 30 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `projects.grant.create:${getActorUserId(req) || req.ip}`,
  };
};

/** DELETE /v1/projects/:projectId/access/:grantId — strict: 30/min per actor. */
export const projectsGrantDeleteRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 30 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `projects.grant.delete:${getActorUserId(req) || req.ip}`,
  };
};

/** POST /v1/workspaces — strict: 10/min per actor. */
export const workspacesCreateRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 10 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `workspaces.create:${getActorUserId(req) || req.ip}`,
  };
};

/** POST /v1/workspaces/:id/invitations — strict: 20/min per actor. */
export const workspaceInvitationCreateRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 20 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `workspaces.invitation.create:${getActorUserId(req) || req.ip}`,
  };
};

/** PATCH /v1/workspaces/:id/members/:userId — strict: 30/min per actor. */
export const workspaceMemberUpdateRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 30 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `workspaces.member.update:${getActorUserId(req) || req.ip}`,
  };
};

/** PUT/PATCH/DELETE bundle i18n (admin o workspace) — strict: 60/min per actor. */
export const i18nBundleWriteRateLimit = (config: AppConfig): PerRouteRateLimitConfig => {
  const profile = resolveRateLimitProfile(config);
  return {
    max: profile === 'strict' ? 60 : LOOSE_MAX,
    timeWindow: '1 minute',
    keyGenerator: (req) => `i18n.bundle.write:${getActorUserId(req) || req.ip}`,
  };
};
