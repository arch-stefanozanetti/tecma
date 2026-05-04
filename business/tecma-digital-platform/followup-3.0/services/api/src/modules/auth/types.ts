export type UserStatus = 'active' | 'disabled' | 'invited';

export type SystemRole = 'tecma_admin' | 'user';

/** Documento `tz_users` — unico modello supportato dall’auth. */
export interface AuthUser {
  _id: { toString(): string };
  email: string;
  passwordHash: string;
  status: UserStatus;
  systemRole?: SystemRole;
  system_role?: SystemRole | 'tecma_superadmin' | 'tecma_super_admin' | null;
  isTecmaAdmin?: boolean;
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
