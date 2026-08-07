import { isTecmaPlatformAdmin, normalizeSystemRole } from '@followup/shared-rbac';

import type { FastifyInstance } from 'fastify';

export const AMBIGUOUS_USER_IDENTITY_CODE = 'AmbiguousUserIdentity';
export const AMBIGUOUS_LOGIN_IDENTITY_CODE = 'AmbiguousLoginIdentity';

export type WorkspaceScopedUserRecord = {
  _id?: unknown;
  email?: unknown;
  status?: unknown;
  systemRole?: unknown;
  system_role?: unknown;
  homeWorkspaceId?: unknown;
};

export const isTecmaUserRecord = (record: WorkspaceScopedUserRecord | null | undefined): boolean =>
  isTecmaPlatformAdmin(normalizeSystemRole(record as Record<string, unknown> | null | undefined));

export const normalizeUserEmail = (email: string): string => email.trim().toLowerCase();

export const userIdFromRecord = (record: WorkspaceScopedUserRecord): string =>
  typeof (record._id as { toString?: () => string } | undefined)?.toString === 'function'
    ? (record._id as { toString: () => string }).toString()
    : String(record._id ?? '');

export type WorkspaceIdentityLookup =
  | { kind: 'none' }
  | { kind: 'single'; user: WorkspaceScopedUserRecord }
  | { kind: 'ambiguous'; count: number }
  | { kind: 'tecma'; count: number };

export const resolveWorkspaceScopedIdentityByEmail = async (
  app: FastifyInstance,
  email: string,
): Promise<WorkspaceIdentityLookup> => {
  const normalizedEmail = normalizeUserEmail(email);
  const users = (await app.mongoDb
    .collection('tz_users')
    .find({
      email: normalizedEmail,
      status: { $in: ['active', 'invited'] },
    } as any)
    .toArray()) as WorkspaceScopedUserRecord[];

  const tecmaUsers = users.filter(isTecmaUserRecord);
  if (tecmaUsers.length > 0) return { kind: 'tecma', count: tecmaUsers.length };

  const scopedUsers = users.filter((user) => !isTecmaUserRecord(user));
  if (scopedUsers.length === 0) return { kind: 'none' };
  if (scopedUsers.length === 1) {
    const [user] = scopedUsers;
    if (user != null) return { kind: 'single', user };
  }
  return { kind: 'ambiguous', count: scopedUsers.length };
};
