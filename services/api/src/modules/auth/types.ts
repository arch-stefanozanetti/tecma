export type UserStatus = 'active' | 'disabled' | 'invited' | 'deleted';

export type SystemRole = 'tecma_admin' | 'user';

/** Documento `tz_users` — unico modello supportato dall’auth. */
export interface AuthUser {
  _id: { toString(): string };
  email: string;
  passwordHash: string;
  status: UserStatus;
  homeWorkspaceId?: string;
  authTokenVersion?: number;
  mfaEnabled?: boolean;
  mfaSecretEncrypted?: string;
  mfaPendingSecretEncrypted?: string;
  mfaPendingExpiresAt?: string;
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
  previousRefreshTokenHashes?: string[];
  createdAt: string;
  updatedAt?: string;
  rotatedAt?: string;
  expiresAt: string;
  userAgent?: string;
  ip?: string;
}

export interface PasswordResetToken {
  resetId: string;
  userId: string;
  tokenHash: string;
  createdAt: string;
  expiresAt: string;
  consumedAt?: string;
  consumedByIp?: string;
}
