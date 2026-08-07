import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

import { MongoRepository } from '@followup/db';
import {
  computeEffectivePermissions,
  getPermissionsForRole,
  isTecmaPlatformAdmin,
  normalizeSystemRole,
  PERMISSIONS,
} from '@followup/shared-rbac';

import type { FastifyInstance } from 'fastify';

import {
  activeMembershipStatusFilter,
  expandForStringOrObjectIdIn,
} from '../../lib/mongoIdentity.js';
import { decryptSecret } from '../../lib/secrets.js';
import { AMBIGUOUS_LOGIN_IDENTITY_CODE } from '../../lib/workspaceScopedIdentity.js';

import type { AuthSession, AuthUser, PasswordResetToken } from './types.js';
import { verifyTotpCode } from './totp.js';

const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/** Token opaco URL-safe (~`length` caratteri). */
const randomOpaqueToken = (length: number): string => {
  const buf = crypto.randomBytes(Math.ceil((length * 3) / 4));
  return buf.toString('base64url').slice(0, length);
};

const basePermissions = [
  PERMISSIONS.WORKSPACES_READ,
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.SESSION_WRITE,
] as const;

const readUserOverrides = (user: AuthUser): readonly string[] => {
  const camel = (user as { permissionsOverride?: unknown }).permissionsOverride;
  if (Array.isArray(camel)) return camel.filter((id): id is string => typeof id === 'string');
  const snake = (user as { permissions_override?: unknown }).permissions_override;
  if (Array.isArray(snake)) return snake.filter((id): id is string => typeof id === 'string');
  return [];
};

const readAccessTokenVersion = (user: AuthUser): number => {
  const raw = (user as { authTokenVersion?: unknown }).authTokenVersion;
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return Math.floor(raw);
  }
  return 0;
};

const buildAccessClaims = async (app: FastifyInstance, user: AuthUser) => {
  const systemRole = normalizeSystemRole(user) ?? 'user';
  const isTecmaAdmin = isTecmaPlatformAdmin(systemRole);
  if (isTecmaAdmin) {
    return { systemRole, isTecmaAdmin, permissions: ['*'] };
  }

  const userId = typeof user._id?.toString === 'function' ? user._id.toString() : String(user._id);
  const memberships = await app.mongoDb
    .collection('tz_user_workspaces')
    .find({
      userId: { $in: expandForStringOrObjectIdIn([userId]) },
      ...activeMembershipStatusFilter(),
    } as any)
    .toArray();
  const customRoleDefinitions = await app.mongoDb
    .collection('tz_roleDefinitions')
    .find({ status: { $ne: 'deleted' } } as any)
    .project({ roleKey: 1, permissions: 1 })
    .toArray();
  const customRoleMap = Object.fromEntries(
    customRoleDefinitions
      .map((doc) => {
        const key = String((doc as { roleKey?: unknown }).roleKey ?? '')
          .trim()
          .toLowerCase();
        const permissions = Array.isArray((doc as { permissions?: unknown }).permissions)
          ? ((doc as { permissions?: unknown[] }).permissions ?? []).filter(
              (id): id is string => typeof id === 'string',
            )
          : [];
        return [key, permissions] as const;
      })
      .filter(([key, permissions]) => key.length > 0 && permissions.length > 0),
  );
  const rolePermissions = new Set<string>();
  for (const membership of memberships) {
    const role = String((membership as { role?: unknown }).role ?? '');
    const permissions = getPermissionsForRole(role, customRoleMap);
    for (const id of permissions) rolePermissions.add(id);
  }
  const overrides = readUserOverrides(user).filter((id) => id !== '*');
  const mergedRolePermissions = [...basePermissions, ...rolePermissions];
  return {
    systemRole,
    isTecmaAdmin,
    permissions: computeEffectivePermissions(mergedRolePermissions, overrides),
  };
};

export class AuthService {
  private usersRepo: MongoRepository<AuthUser>;
  private sessionsRepo: MongoRepository<AuthSession>;
  private passwordResetRepo: MongoRepository<PasswordResetToken>;
  private readonly jwtSignOptions: Record<string, unknown>;

  constructor(private readonly app: FastifyInstance) {
    this.usersRepo = new MongoRepository<AuthUser>(app.mongoDb.collection('tz_users'));
    this.sessionsRepo = new MongoRepository<AuthSession>(app.mongoDb.collection('tz_authSessions'));
    this.passwordResetRepo = new MongoRepository<PasswordResetToken>(
      app.mongoDb.collection('tz_authPasswordResets'),
    );
    const rawKid = app.config.AUTH_JWT_KID?.trim();
    this.jwtSignOptions =
      rawKid != null && rawKid !== '' ? { header: { kid: rawKid, alg: 'HS256' as const } } : {};
  }

  private async findUserForLogin(normalizedEmail: string): Promise<AuthUser | null> {
    return this.usersRepo.findOne({ email: normalizedEmail, status: { $ne: 'deleted' } } as any);
  }

  private async findUsersForLogin(normalizedEmail: string): Promise<AuthUser[]> {
    return this.usersRepo.findMany({ email: normalizedEmail, status: { $ne: 'deleted' } } as any);
  }

  private static toUserId(user: AuthUser): string {
    return user._id.toString();
  }

  private async findUserById(userId: string): Promise<AuthUser | null> {
    return this.usersRepo.findOne({ _id: { $in: expandForStringOrObjectIdIn([userId]) } } as any);
  }

  private static assertMfaCode(user: AuthUser, mfaCode?: string): void {
    const enabled = (user as { mfaEnabled?: unknown }).mfaEnabled === true;
    if (!enabled) return;

    const encryptedSecret = (user as { mfaSecretEncrypted?: unknown }).mfaSecretEncrypted;
    if (typeof encryptedSecret !== 'string' || encryptedSecret.trim() === '') {
      throw new Error('MFA_REQUIRED');
    }
    if (typeof mfaCode !== 'string' || mfaCode.trim() === '') {
      throw new Error('MFA_CODE_REQUIRED');
    }
    if (!verifyTotpCode(decryptSecret(encryptedSecret), mfaCode)) {
      throw new Error('MFA_INVALID_CODE');
    }
  }

  private async assertMfaIfWorkspaceRequires(userId: string, user: AuthUser): Promise<void> {
    const enabled = (user as { mfaEnabled?: unknown }).mfaEnabled === true;
    if (enabled) return;

    const membership = await this.app.mongoDb.collection('tz_user_workspaces').findOne({
      userId: { $in: expandForStringOrObjectIdIn([userId]) },
      ...activeMembershipStatusFilter(),
    } as any);
    if (membership == null) return;
    const workspaceId = (membership as { workspaceId?: { toString?: () => string } | string })
      .workspaceId;
    const normalizedWorkspaceId =
      typeof workspaceId === 'string'
        ? workspaceId
        : typeof workspaceId?.toString === 'function'
          ? workspaceId.toString()
          : '';
    if (normalizedWorkspaceId.trim() === '') return;
    const workspace = await this.app.mongoDb.collection('tz_workspaces').findOne({
      _id: { $in: expandForStringOrObjectIdIn([normalizedWorkspaceId]) },
    } as any);
    if ((workspace as { mfaRequired?: unknown } | null)?.mfaRequired === true) {
      throw new Error('MFA_REQUIRED');
    }
  }

  private async bumpAccessTokenVersion(userId: string): Promise<void> {
    const now = new Date().toISOString();
    await this.app.mongoDb
      .collection('tz_users')
      .updateMany(
        { _id: { $in: expandForStringOrObjectIdIn([userId]) } } as any,
        { $inc: { authTokenVersion: 1 }, $set: { updatedAt: now } } as any,
      );
  }

  async login(
    email: string,
    password: string,
    meta: { userAgent?: string; ip?: string; mfaCode?: string },
  ) {
    const normalizedEmail = email.trim().toLowerCase();
    const candidates = (await this.findUsersForLogin(normalizedEmail)).filter(
      (candidate) => candidate.status === 'active',
    );
    const matchingUsers: AuthUser[] = [];
    for (const candidate of candidates) {
      const storedHash = candidate.passwordHash;
      if (typeof storedHash !== 'string' || storedHash.length === 0) continue;
      if (await bcrypt.compare(password, storedHash)) matchingUsers.push(candidate);
    }
    if (matchingUsers.length === 0) throw new Error('Invalid credentials');
    if (matchingUsers.length > 1) throw new Error(AMBIGUOUS_LOGIN_IDENTITY_CODE);

    const user = matchingUsers[0]!;
    const userId = AuthService.toUserId(user);
    AuthService.assertMfaCode(user, meta.mfaCode);
    await this.assertMfaIfWorkspaceRequires(userId, user);

    const claims = await buildAccessClaims(this.app, user);
    const sessionId = crypto.randomUUID();
    const accessToken = await this.app.jwt.sign(
      {
        sub: userId,
        email: user.email,
        jti: crypto.randomUUID(),
        sid: sessionId,
        atv: readAccessTokenVersion(user),
        ...claims,
      },
      this.jwtSignOptions,
    );

    const refreshToken = randomOpaqueToken(64);
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(now.getDate() + this.app.config.AUTH_REFRESH_EXPIRES_DAYS);

    await this.sessionsRepo.create({
      sessionId,
      userId,
      refreshTokenHash: hashRefreshToken(refreshToken),
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      userAgent: meta.userAgent,
      ip: meta.ip,
    });

    await this.app.auditService.authEvent({
      eventType: 'auth.login.success',
      userId,
      details: { email: user.email },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email: user.email,
        systemRole: claims.systemRole,
        isTecmaAdmin: claims.isTecmaAdmin,
        permissions: claims.permissions,
      },
    };
  }

  async refresh(refreshToken: string) {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const session = await this.sessionsRepo.findOne({ refreshTokenHash });
    if (session == null) {
      const replayed = await this.sessionsRepo.findOne({
        previousRefreshTokenHashes: refreshTokenHash,
      } as any);
      if (replayed != null) {
        await this.sessionsRepo.deleteOne({ sessionId: replayed.sessionId });
        await this.app.auditService.authEvent({
          eventType: 'auth.refresh.replay_detected',
          userId: replayed.userId,
          details: { sessionId: replayed.sessionId },
        });
      }
      throw new Error('Invalid refresh token');
    }
    if (new Date(session.expiresAt).getTime() < Date.now())
      throw new Error('Refresh token expired');

    const user = await this.findUserById(session.userId);
    if (user == null) throw new Error('Session user not found');
    if (user.status !== 'active') throw new Error('Session user not found');
    const userId = AuthService.toUserId(user);

    const claims = await buildAccessClaims(this.app, user);
    const accessToken = await this.app.jwt.sign(
      {
        sub: userId,
        email: user.email,
        jti: crypto.randomUUID(),
        sid: session.sessionId,
        atv: readAccessTokenVersion(user),
        ...claims,
      },
      this.jwtSignOptions,
    );
    const nextRefreshToken = randomOpaqueToken(64);
    const now = new Date().toISOString();
    const rotateResult = await this.sessionsRepo.updateOne(
      { sessionId: session.sessionId, refreshTokenHash },
      {
        $set: {
          refreshTokenHash: hashRefreshToken(nextRefreshToken),
          updatedAt: now,
          rotatedAt: now,
        },
        $push: {
          previousRefreshTokenHashes: {
            $each: [refreshTokenHash],
            $slice: -5,
          },
        },
      } as any,
    );
    if (rotateResult.matchedCount === 0) {
      await this.sessionsRepo.deleteOne({ sessionId: session.sessionId });
      await this.app.auditService.authEvent({
        eventType: 'auth.refresh.race_detected',
        userId: session.userId,
        details: { sessionId: session.sessionId },
      });
      throw new Error('Invalid refresh token');
    }

    return { accessToken, refreshToken: nextRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const session = await this.sessionsRepo.findOne({ refreshTokenHash });
    if (session == null) return;

    await this.sessionsRepo.deleteOne({ sessionId: session.sessionId });
    await this.bumpAccessTokenVersion(session.userId);
    await this.app.auditService.authEvent({
      eventType: 'auth.logout',
      userId: session.userId,
      details: { sessionId: session.sessionId },
    });
  }

  async issueSsoAccessToken(identity: { sub: string; email: string }): Promise<string> {
    const normalizedEmail = identity.email.trim().toLowerCase();
    const candidates = await this.findUsersForLogin(normalizedEmail);

    // Blocca l'emissione se l'utente non esiste nel DB o non è attivo.
    // Un token OIDC esterno valido non è sufficiente per accedere alla piattaforma:
    // l'account deve essere stato creato e approvato esplicitamente.
    if (candidates.length === 0) {
      throw new Error('SSO user not provisioned');
    }
    if (candidates.length > 1) {
      throw new Error(AMBIGUOUS_LOGIN_IDENTITY_CODE);
    }
    const user = candidates[0]!;
    if (user.status !== 'active') {
      throw new Error('SSO user not active');
    }

    const claims = await buildAccessClaims(this.app, user);
    return this.app.jwt.sign(
      {
        sub: AuthService.toUserId(user),
        email: normalizedEmail,
        jti: crypto.randomUUID(),
        atv: readAccessTokenVersion(user),
        ...claims,
      },
      this.jwtSignOptions,
    );
  }

  async requestPasswordReset(email: string, ip?: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();
    const candidates = (await this.findUsersForLogin(normalizedEmail)).filter(
      (candidate) => candidate.status === 'active',
    );
    if (candidates.length !== 1) return;
    const user = candidates[0]!;

    await this.issuePasswordReset(user, { ip, requestedBy: 'self-service' });
  }

  async requestPasswordResetForUserId(input: {
    userId: string;
    ip?: string;
    actorUserId?: string;
  }): Promise<boolean> {
    const user = await this.findUserById(input.userId);
    if (user == null || user.status !== 'active') return false;

    await this.issuePasswordReset(user, {
      ip: input.ip,
      requestedBy: input.actorUserId ?? 'admin',
    });
    return true;
  }

  private async issuePasswordReset(
    user: AuthUser,
    meta: { ip?: string; requestedBy?: string },
  ): Promise<void> {
    const resetToken = randomOpaqueToken(72);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    await this.passwordResetRepo.create({
      resetId: crypto.randomUUID(),
      userId: AuthService.toUserId(user),
      tokenHash: hashRefreshToken(resetToken),
      createdAt: now.toISOString(),
      expiresAt,
    });

    const resetBaseUrl =
      process.env.AUTH_PASSWORD_RESET_URL?.trim() || 'https://app.followup/reset-password';
    const resetUrl = `${resetBaseUrl}?token=${encodeURIComponent(resetToken)}`;
    await this.app.mail.sendTemplate({
      to: user.email,
      flowKey: 'forgot_password',
      vars: { resetUrl },
    });
    await this.app.auditService.authEvent({
      eventType: 'auth.password_reset.requested',
      userId: AuthService.toUserId(user),
      details: { ip: meta.ip ?? null, requestedBy: meta.requestedBy ?? null },
    });
  }

  async resetPassword(input: {
    token: string;
    newPasswordHash: string;
    ip?: string;
  }): Promise<void> {
    const tokenHash = hashRefreshToken(input.token);
    const tokenDoc = await this.passwordResetRepo.findOne({
      tokenHash,
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date().toISOString() },
    } as any);
    if (tokenDoc == null) throw new Error('Invalid reset token');

    const consumeResult = await this.passwordResetRepo.updateOne(
      {
        resetId: tokenDoc.resetId,
        tokenHash,
        consumedAt: { $exists: false },
        expiresAt: { $gt: new Date().toISOString() },
      } as any,
      { $set: { consumedAt: new Date().toISOString(), consumedByIp: input.ip ?? null } } as any,
    );
    if (consumeResult.matchedCount === 0) throw new Error('Invalid reset token');

    const user = await this.findUserById(tokenDoc.userId);
    if (user == null || user.status === 'deleted') throw new Error('Invalid reset token');

    await this.usersRepo.updateOne(
      { _id: new ObjectId(tokenDoc.userId) } as any,
      {
        $set: {
          passwordHash: input.newPasswordHash,
          status: 'active',
          updatedAt: new Date().toISOString(),
        },
      } as any,
    );
    await this.app.mongoDb
      .collection('tz_authSessions')
      .deleteMany({ userId: tokenDoc.userId } as any);
    await this.bumpAccessTokenVersion(tokenDoc.userId);
    await this.app.mail.sendTemplate({
      to: user.email,
      flowKey: 'password_changed',
      vars: {},
    });
    await this.app.auditService.authEvent({
      eventType: 'auth.password_reset.completed',
      userId: tokenDoc.userId,
      details: { resetId: tokenDoc.resetId },
    });
  }

  async changePassword(input: {
    userId: string;
    currentPassword: string;
    newPasswordHash: string;
  }): Promise<void> {
    const user = await this.findUserById(input.userId);
    if (user == null || user.status !== 'active') throw new Error('Invalid credentials');

    const validPassword = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!validPassword) throw new Error('Invalid credentials');

    await this.usersRepo.updateOne(
      { _id: new ObjectId(input.userId) } as any,
      { $set: { passwordHash: input.newPasswordHash, updatedAt: new Date().toISOString() } } as any,
    );
    await this.app.mongoDb
      .collection('tz_authSessions')
      .deleteMany({ userId: input.userId } as any);
    await this.bumpAccessTokenVersion(input.userId);
    await this.app.mail.sendTemplate({
      to: user.email,
      flowKey: 'password_changed',
      vars: {},
    });
    await this.app.auditService.authEvent({
      eventType: 'auth.password_changed',
      userId: input.userId,
      details: {},
    });
  }
}
