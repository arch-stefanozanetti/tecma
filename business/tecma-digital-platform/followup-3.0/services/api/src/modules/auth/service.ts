import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';

import { MongoRepository } from '@followup/db';
import { isTecmaPlatformAdmin, normalizeSystemRole, PERMISSIONS } from '@followup/shared-rbac';

import type { FastifyInstance } from 'fastify';

import type { AuthSession, AuthUser } from './types.js';

const hashRefreshToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

/** Token opaco URL-safe (~`length` caratteri). */
const randomOpaqueToken = (length: number): string => {
  const buf = crypto.randomBytes(Math.ceil((length * 3) / 4));
  return buf.toString('base64url').slice(0, length);
};

const basePermissions = [
  PERMISSIONS.USERS_READ,
  PERMISSIONS.WORKSPACES_READ,
  PERMISSIONS.PROJECTS_READ,
  PERMISSIONS.SESSION_WRITE,
] as const;

const buildAccessClaims = (user: AuthUser) => {
  const systemRole = normalizeSystemRole(user) ?? 'user';
  const isTecmaAdmin = isTecmaPlatformAdmin(systemRole);
  return {
    systemRole,
    isTecmaAdmin,
    permissions: isTecmaAdmin ? ['*'] : [...basePermissions],
  };
};

export class AuthService {
  private usersRepo: MongoRepository<AuthUser>;
  private sessionsRepo: MongoRepository<AuthSession>;

  constructor(private readonly app: FastifyInstance) {
    this.usersRepo = new MongoRepository<AuthUser>(app.mongoDb.collection('tz_users'));
    this.sessionsRepo = new MongoRepository<AuthSession>(app.mongoDb.collection('tz_authSessions'));
  }

  private async findUserForLogin(normalizedEmail: string): Promise<AuthUser | null> {
    return this.usersRepo.findOne({ email: normalizedEmail } as any);
  }

  private static toUserId(user: AuthUser): string {
    return user._id.toString();
  }

  private async findUserById(userId: string): Promise<AuthUser | null> {
    if (!ObjectId.isValid(userId)) return null;
    return this.usersRepo.findOne({ _id: new ObjectId(userId) } as any);
  }

  async login(email: string, password: string, meta: { userAgent?: string; ip?: string }) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.findUserForLogin(normalizedEmail);
    if (user == null) throw new Error('Invalid credentials');
    if (user.status !== 'active') throw new Error('Invalid credentials');
    const userId = AuthService.toUserId(user);

    const storedHash = user.passwordHash;
    if (typeof storedHash !== 'string' || storedHash.length === 0)
      throw new Error('Invalid credentials');

    const validPassword = await bcrypt.compare(password, storedHash);
    if (!validPassword) throw new Error('Invalid credentials');

    const claims = buildAccessClaims(user);
    const accessToken = await this.app.jwt.sign({
      sub: userId,
      email: user.email,
      ...claims,
    });

    const refreshToken = randomOpaqueToken(64);
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(now.getDate() + this.app.config.AUTH_REFRESH_EXPIRES_DAYS);

    await this.sessionsRepo.create({
      sessionId: crypto.randomUUID(),
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
    if (session == null) throw new Error('Invalid refresh token');
    if (new Date(session.expiresAt).getTime() < Date.now())
      throw new Error('Refresh token expired');

    const user = await this.findUserById(session.userId);
    if (user == null) throw new Error('Session user not found');
    if (user.status !== 'active') throw new Error('Session user not found');
    const userId = AuthService.toUserId(user);

    const claims = buildAccessClaims(user);
    const accessToken = await this.app.jwt.sign({
      sub: userId,
      email: user.email,
      ...claims,
    });

    return { accessToken };
  }

  async logout(refreshToken: string): Promise<void> {
    const refreshTokenHash = hashRefreshToken(refreshToken);
    const session = await this.sessionsRepo.findOne({ refreshTokenHash });
    if (session == null) return;

    await this.sessionsRepo.deleteOne({ sessionId: session.sessionId });
    await this.app.auditService.authEvent({
      eventType: 'auth.logout',
      userId: session.userId,
      details: { sessionId: session.sessionId },
    });
  }
}
