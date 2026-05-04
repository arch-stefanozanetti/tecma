export type UserStatus = 'active' | 'disabled' | 'invited';

export type SystemRole = 'tecma_admin' | 'tecma_superadmin' | 'user';

/** Documento `tz_users` — unico modello supportato dall’auth. */
export interface AuthUser {
  _id: { toString(): string };
  email: string;
  passwordHash: string;
  status: UserStatus;
  systemRole: SystemRole;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  sessionId: string;
  userId: string;
  refreshTokenHash: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string;
  ip?: string;
}
