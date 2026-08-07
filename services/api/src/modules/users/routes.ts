import crypto from 'node:crypto';

import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { MongoServerError, ObjectId } from 'mongodb';

import { MongoRepository } from '@followup/db';
import {
  ALL_PERMISSION_IDS,
  hasPermission,
  isTecmaPlatformAdmin,
  normalizeSystemRole,
  PERMISSION_WILDCARD,
  PERMISSIONS,
} from '@followup/shared-rbac';

import type { FastifyInstance } from 'fastify';

import { serializeRecordForJsonApi } from '../../lib/jsonSafeMongo.js';
import {
  activeMembershipStatusFilter,
  buildUserWorkspaceMembershipFilter,
  expandForStringOrObjectIdIn,
  normalizeToStringId,
} from '../../lib/mongoIdentity.js';
import {
  buildMongoSkip,
  buildMongoSort,
  buildPaginationInfo,
  parsePaginationQuery,
} from '../../lib/pagination.js';
import {
  usersBulkInviteRateLimit,
  usersCreateRateLimit,
  usersPasswordResetRateLimit,
  usersStateChangeRateLimit,
} from '../../lib/rateLimitProfiles.js';
import { resolveUserIdentityCandidates } from '../../lib/userIdentity.js';
import { buildSoftDeleteFields, enqueueLifecycleNotice } from '../../lib/lifecycleRetention.js';
import {
  AMBIGUOUS_USER_IDENTITY_CODE,
  isTecmaUserRecord,
  normalizeUserEmail,
  resolveWorkspaceScopedIdentityByEmail,
  userIdFromRecord,
} from '../../lib/workspaceScopedIdentity.js';
import {
  createdObjectSchema,
  listSchema,
  okDeletedSchema,
  singleObjectSchema,
} from '../../schemas/routeHelpers.js';
import { AuthService } from '../auth/service.js';

const createUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(2),
  role: z.enum(['owner', 'admin', 'collaborator', 'viewer']).default('viewer'),
  /** Se presente, l’invito è consentito ai soli owner/admin del workspace (senza `users.invite` globale). */
  workspaceId: z.string().min(1).optional(),
  /** Tecma-only: forza una nuova identità scoped al workspace anche se l'email esiste altrove. */
  createNewIdentity: z.boolean().optional(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  systemRole: z.enum(['user', 'tecma_admin']).optional(),
  /**
   * Lista permessi extra rispetto al ruolo workspace effettivo.
   * Validati in route handler: ogni id deve essere nel catalogo
   * `ALL_PERMISSION_IDS`; la wildcard `*` e ammessa solo se l'attore
   * e platform admin Tecma.
   */
  permissionsOverride: z.array(z.string().min(1)).max(64).optional(),
});

const omitPasswordHash = (doc: Record<string, unknown>): Record<string, unknown> => {
  const out = { ...doc };
  delete out.passwordHash;
  return out;
};

const WORKSPACE_MEMBER_ROLES = new Set(['owner', 'admin', 'collaborator', 'viewer']);
const normalizeWorkspaceMembershipRole = (
  raw: unknown,
): 'owner' | 'admin' | 'collaborator' | 'viewer' => {
  const s = String(raw ?? '')
    .toLowerCase()
    .trim();
  if (WORKSPACE_MEMBER_ROLES.has(s)) return s as 'owner' | 'admin' | 'collaborator' | 'viewer';
  return 'collaborator';
};

/**
 * Aggiunge `workspaces` per utente da `tz_user_workspaces` + nomi da `tz_workspaces`.
 * `visibleWorkspaceIds` = null → Tecma admin: tutte le membership dell’utente.
 * Altrimenti solo membership i cui workspace sono nell’elenco (coerente con tenant visibility).
 */
const enrichUsersWithWorkspaceMemberships = async (
  app: FastifyInstance,
  usersOut: Record<string, unknown>[],
  visibleWorkspaceIds: string[] | null,
): Promise<Record<string, unknown>[]> => {
  if (usersOut.length === 0) return usersOut;

  const candidateToCanonicalUserId = new Map<string, string>();
  const membershipIdentityCandidates: string[] = [];
  const normalizedEmailCounts = new Map<string, number>();
  for (const row of usersOut) {
    if (typeof row.email !== 'string') continue;
    const email = row.email.trim().toLowerCase();
    if (email === '') continue;
    normalizedEmailCounts.set(email, (normalizedEmailCounts.get(email) ?? 0) + 1);
  }
  for (const row of usersOut) {
    const uid = normalizeToStringId(row._id);
    if (uid == null || uid.length === 0) continue;
    candidateToCanonicalUserId.set(uid, uid);
    candidateToCanonicalUserId.set(uid.toLowerCase(), uid);
    membershipIdentityCandidates.push(uid);
    if (typeof row.email === 'string') {
      const email = row.email.trim().toLowerCase();
      if (email !== '' && normalizedEmailCounts.get(email) === 1) {
        candidateToCanonicalUserId.set(email, uid);
        membershipIdentityCandidates.push(email);
      }
    }
  }

  if (membershipIdentityCandidates.length === 0) {
    return usersOut.map((row) => ({ ...row, workspaces: [] as unknown[] }));
  }

  const membershipFilter: Record<string, unknown> = {
    userId: { $in: expandForStringOrObjectIdIn(membershipIdentityCandidates) },
    ...activeMembershipStatusFilter(),
  };
  if (visibleWorkspaceIds != null) {
    if (visibleWorkspaceIds.length === 0) {
      return usersOut.map((row) => ({ ...row, workspaces: [] as unknown[] }));
    }
    membershipFilter.workspaceId = { $in: expandForStringOrObjectIdIn(visibleWorkspaceIds) };
  }

  const memberships = await app.mongoDb
    .collection('tz_user_workspaces')
    .find(membershipFilter as any)
    .toArray();

  const workspaceIdsNeeded = Array.from(
    new Set(
      memberships
        .map((m) => normalizeToStringId((m as { workspaceId?: unknown }).workspaceId))
        .filter((id): id is string => id != null && id.length > 0),
    ),
  );

  const workspacesColl = app.mongoDb.collection('tz_workspaces');
  const workspaceNameById = new Map<string, string>();
  if (workspaceIdsNeeded.length > 0) {
    const wsDocs = await workspacesColl
      .find({
        _id: { $in: expandForStringOrObjectIdIn(workspaceIdsNeeded) },
        status: { $ne: 'deleted' },
      } as any)
      .project({ name: 1 })
      .toArray();
    for (const w of wsDocs) {
      const id = normalizeToStringId((w as { _id?: unknown })._id);
      if (id == null || id === '') continue;
      const name =
        typeof (w as { name?: unknown }).name === 'string' && (w as { name: string }).name !== ''
          ? (w as { name: string }).name
          : id;
      workspaceNameById.set(id, name);
    }
  }

  const byUser = new Map<
    string,
    Array<{ workspaceId: string; workspaceName: string; role: string }>
  >();
  for (const m of memberships) {
    const membershipUserId = normalizeToStringId((m as { userId?: unknown }).userId);
    const uid =
      membershipUserId != null
        ? (candidateToCanonicalUserId.get(membershipUserId) ??
          candidateToCanonicalUserId.get(membershipUserId.toLowerCase()) ??
          null)
        : null;
    const wid = normalizeToStringId((m as { workspaceId?: unknown }).workspaceId);
    if (uid == null || wid == null) continue;
    const role = normalizeWorkspaceMembershipRole((m as { role?: unknown }).role);
    const workspaceName = workspaceNameById.get(wid) ?? wid;
    const list = byUser.get(uid) ?? [];
    list.push({ workspaceId: wid, workspaceName, role });
    byUser.set(uid, list);
  }

  for (const [, list] of byUser) {
    list.sort((a, b) => a.workspaceName.localeCompare(b.workspaceName, 'it'));
  }

  return usersOut.map((row) => {
    const uid = normalizeToStringId(row._id);
    const workspaces = uid != null ? (byUser.get(uid) ?? []) : [];
    return { ...row, workspaces };
  });
};

const nonDeletedUserFilter = {
  status: { $ne: 'deleted' },
} as const;
const hashOpaqueToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const buildInviteAcceptUrl = (token: string): string => {
  const base = (process.env.APP_PUBLIC_URL ?? 'http://localhost:5177').replace(/\/+$/, '');
  return `${base}/invite-accept?token=${encodeURIComponent(token)}`;
};

type UserDocument = {
  _id: ObjectId | string;
  email: string;
  fullName?: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  passwordHash?: string;
  status?: string;
  role?: string;
  systemRole?: string;
  system_role?: string;
  permissionsOverride?: string[];
  permissions_override?: string[];
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  deletedReason?: string;
  deleteReason?: string;
  purgeEligibleAt?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  reactivatedAt?: string;
  reactivatedBy?: string;
  inviteTokenHash?: string;
  inviteExpiresAt?: string;
  homeWorkspaceId?: string;
};

export const usersRoutes = async (app: FastifyInstance): Promise<void> => {
  const authService = new AuthService(app);
  const usersRepo = new MongoRepository<UserDocument>(
    app.mongoDb.collection<UserDocument>('tz_users'),
  );
  const membershipsRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_user_workspaces'),
  );
  const inviteTokensRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_inviteTokens'),
  );
  const authSessionsRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_authSessions'),
  );
  const workspaceUserProjectsRepo = new MongoRepository<Record<string, unknown>>(
    app.mongoDb.collection('tz_workspace_user_projects'),
  );
  const parseUserObjectId = (rawUserId: string): ObjectId | null => {
    if (!ObjectId.isValid(rawUserId)) return null;
    return new ObjectId(rawUserId);
  };

  /** Risolve `tz_users` per `_id` stringa o ObjectId (dataset legacy / seed). */
  const findUserDocumentByParamId = async (
    userIdParam: string,
  ): Promise<Record<string, unknown> | null> => {
    const t = userIdParam.trim();
    if (t === '') return null;
    const expanded = expandForStringOrObjectIdIn([t]);
    if (expanded.length === 0) return null;
    const doc = await usersRepo.findOne({
      ...nonDeletedUserFilter,
      _id: { $in: expanded },
    } as any);
    return doc as Record<string, unknown> | null;
  };

  const createInvitedWorkspaceUser = async (input: {
    email: string;
    fullName: string;
    role: string;
    workspaceId: string;
    now: string;
  }): Promise<UserDocument> => {
    const randomSecret = crypto.randomBytes(32).toString('base64url');
    const passwordHash = await bcrypt.hash(randomSecret, 12);
    return {
      _id: new ObjectId(),
      email: normalizeUserEmail(input.email),
      fullName: input.fullName,
      passwordHash,
      systemRole: 'user',
      role: input.role,
      homeWorkspaceId: input.workspaceId,
      status: 'invited' as const,
      createdAt: input.now,
      updatedAt: input.now,
    };
  };

  const resolveUserForWorkspaceInvite = async (input: {
    email: string;
    fullName: string;
    role: string;
    workspaceId: string;
    now: string;
    forceCreateNewIdentity?: boolean;
  }): Promise<{ doc: UserDocument; created: boolean }> => {
    if (input.forceCreateNewIdentity === true) {
      return {
        doc: await createInvitedWorkspaceUser(input),
        created: true,
      };
    }

    const lookup = await resolveWorkspaceScopedIdentityByEmail(app, input.email);
    if (lookup.kind === 'tecma') {
      throw new Error('TecmaIdentityCannotBeInvited');
    }
    if (lookup.kind === 'ambiguous') {
      throw new Error(AMBIGUOUS_USER_IDENTITY_CODE);
    }
    if (lookup.kind === 'single') {
      const existing = lookup.user as UserDocument;
      const existingHomeWorkspaceId = String(existing.homeWorkspaceId ?? '').trim();
      if (existingHomeWorkspaceId === input.workspaceId) {
        throw new Error('DuplicateWorkspaceEmail');
      }
      if (existingHomeWorkspaceId === '') {
        await usersRepo.updateOne(
          { _id: existing._id } as any,
          { $set: { homeWorkspaceId: input.workspaceId, updatedAt: input.now } } as any,
        );
        existing.homeWorkspaceId = input.workspaceId;
      }
      return { doc: existing, created: false };
    }

    return {
      doc: await createInvitedWorkspaceUser(input),
      created: true,
    };
  };

  const identityMatchesUserDocument = (
    identityCandidates: string[],
    userDoc: Record<string, unknown>,
  ): boolean => {
    const uidNorm = normalizeToStringId(userDoc._id);
    if (uidNorm == null) return false;
    const userExpanded = new Set(expandForStringOrObjectIdIn([uidNorm]).map((x) => x.toString()));
    for (const raw of identityCandidates) {
      for (const cand of expandForStringOrObjectIdIn([raw])) {
        if (userExpanded.has(cand.toString())) return true;
      }
    }
    return false;
  };
  const isLastActiveTecmaAdmin = async (userId: ObjectId): Promise<boolean> => {
    const activeAdmins = await usersRepo.findMany({
      status: 'active',
      $or: [
        { systemRole: 'tecma_admin' },
        { system_role: 'tecma_admin' },
        { systemRole: 'tecma_superadmin' },
        { system_role: 'tecma_superadmin' },
        { systemRole: 'tecma_super_admin' },
        { system_role: 'tecma_super_admin' },
      ],
    } as any);

    return (
      activeAdmins.length === 1 &&
      String((activeAdmins[0] as { _id?: unknown })._id ?? '') === userId.toString()
    );
  };
  const actorContext = async (actor: {
    sub?: string;
    email?: string;
    systemRole?: string;
    system_role?: string;
  }): Promise<{
    isTecma: boolean;
    identities: string[];
    workspaceIds: string[];
    adminWorkspaceIds: string[];
  }> => {
    const isTecma = isTecmaPlatformAdmin(normalizeSystemRole(actor));
    if (isTecma) return { isTecma, identities: [], workspaceIds: [], adminWorkspaceIds: [] };

    const identities = await resolveUserIdentityCandidates(app, [actor.sub, actor.email]);
    if (identities.length === 0) {
      return { isTecma, identities: [], workspaceIds: [], adminWorkspaceIds: [] };
    }

    const memberships = await membershipsRepo.findMany({
      userId: { $in: expandForStringOrObjectIdIn(identities) },
      ...activeMembershipStatusFilter(),
    } as any);
    const workspaceIds = Array.from(
      new Set(
        memberships
          .map((membership) =>
            normalizeToStringId((membership as { workspaceId?: unknown }).workspaceId),
          )
          .filter((id): id is string => id != null && id.length > 0),
      ),
    );
    const adminWorkspaceIds = Array.from(
      new Set(
        memberships
          .filter((membership) =>
            ['owner', 'admin'].includes(String((membership as { role?: unknown }).role ?? '')),
          )
          .map((membership) =>
            normalizeToStringId((membership as { workspaceId?: unknown }).workspaceId),
          )
          .filter((id): id is string => id != null && id.length > 0),
      ),
    );
    return { isTecma, identities, workspaceIds, adminWorkspaceIds };
  };
  const targetHasMembershipIn = async (
    targetUserId: string,
    workspaceIds: string[],
  ): Promise<boolean> => {
    if (workspaceIds.length === 0) return false;
    const membership = await membershipsRepo.findOne({
      userId: { $in: expandForStringOrObjectIdIn([targetUserId]) },
      workspaceId: { $in: expandForStringOrObjectIdIn(workspaceIds) },
      ...activeMembershipStatusFilter(),
    } as any);
    return membership != null;
  };

  const lastPrivilegedWorkspaceIdsForUser = async (userIdentities: string[]): Promise<string[]> => {
    const targetMemberships = await membershipsRepo.findMany({
      userId: { $in: expandForStringOrObjectIdIn(userIdentities) },
      role: { $in: ['owner', 'admin'] },
      ...activeMembershipStatusFilter(),
    } as any);
    const blocked: string[] = [];
    for (const membership of targetMemberships) {
      const workspaceId = normalizeToStringId(
        (membership as { workspaceId?: unknown }).workspaceId,
      );
      if (workspaceId == null) continue;
      const activePeers = await membershipsRepo.count({
        workspaceId,
        role: { $in: ['owner', 'admin'] },
        ...activeMembershipStatusFilter(),
      } as any);
      if (activePeers <= 1) blocked.push(workspaceId);
    }
    return blocked;
  };

  const usersListAllowedSortFields = ['email', 'createdAt', 'updatedAt'] as const;
  const userAuditAllowedSortFields = ['createdAt', 'eventType'] as const;
  const buildUserFilterFromMembershipIdentities = (
    identities: string[],
  ): Record<string, unknown> | null => {
    const normalized = Array.from(
      new Set(identities.map((identity) => identity.trim()).filter((identity) => identity !== '')),
    );
    if (normalized.length === 0) return null;
    const emailIdentities = Array.from(
      new Set(
        normalized
          .filter((identity) => identity.includes('@'))
          .flatMap((identity) => [identity, identity.toLowerCase()]),
      ),
    );
    const or: Record<string, unknown>[] = [
      { _id: { $in: expandForStringOrObjectIdIn(normalized) } },
    ];
    if (emailIdentities.length > 0) {
      or.push({ email: { $in: emailIdentities } });
    }
    return { $or: or };
  };

  app.get(
    '/v1/users',
    {
      preHandler: [app.authenticate, app.requirePermission('users.read')],
      schema: {
        ...listSchema('listUsers', 'Users', 'Elenco utenti'),
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: [...usersListAllowedSortFields] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
            workspaceId: {
              type: 'string',
              description:
                'Quando presente limita la lista agli utenti membri del workspace indicato.',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as {
        page?: string | number;
        perPage?: string | number;
        sortField?: string;
        sortOrder?: string;
        workspaceId?: string;
      };
      const requestedWorkspaceId =
        typeof query.workspaceId === 'string' && query.workspaceId.trim() !== ''
          ? query.workspaceId.trim()
          : null;
      const paginationParams = parsePaginationQuery(
        {
          page: query.page,
          perPage: query.perPage,
          sortField: query.sortField,
          sortOrder: query.sortOrder,
        },
        usersListAllowedSortFields,
      );
      const sort = buildMongoSort(paginationParams, 'createdAt');
      const skip = buildMongoSkip(paginationParams);
      const limit = paginationParams.perPage;

      const actor = request.user as {
        sub?: string;
        email?: string;
        systemRole?: string;
        system_role?: string;
      };
      const actorIsTecmaAdmin = isTecmaPlatformAdmin(normalizeSystemRole(actor));

      let filter: Record<string, unknown>;
      /** `null` = nessun filtro su workspace (Tecma admin); altrimenti solo membership in questi workspace. */
      let membershipWorkspaceScope: string[] | null = null;

      if (actorIsTecmaAdmin) {
        membershipWorkspaceScope = requestedWorkspaceId != null ? [requestedWorkspaceId] : null;
        filter = { ...nonDeletedUserFilter };
        if (requestedWorkspaceId != null) {
          const workspaceMembers = await membershipsRepo.findMany({
            workspaceId: { $in: expandForStringOrObjectIdIn([requestedWorkspaceId]) },
            ...activeMembershipStatusFilter(),
          } as any);
          const membershipUserIdentities = workspaceMembers
            .map((membership) => normalizeToStringId((membership as { userId?: unknown }).userId))
            .filter((id): id is string => id != null && id.length > 0);
          const identityFilter = buildUserFilterFromMembershipIdentities(membershipUserIdentities);
          if (identityFilter == null) {
            return reply.send({
              data: [],
              paginationInfo: buildPaginationInfo(0, paginationParams),
            });
          }
          filter = { ...filter, ...identityFilter };
        }
      } else {
        const identities = await resolveUserIdentityCandidates(app, [actor.sub, actor.email]);
        if (identities.length === 0) {
          return reply.send({ data: [], paginationInfo: buildPaginationInfo(0, paginationParams) });
        }

        const memberships = await membershipsRepo.findMany({
          userId: { $in: expandForStringOrObjectIdIn(identities) },
          ...activeMembershipStatusFilter(),
        } as any);

        const workspaceIds = Array.from(
          new Set(
            memberships
              .map((membership) =>
                normalizeToStringId((membership as { workspaceId?: unknown }).workspaceId),
              )
              .filter((id): id is string => id != null && id.length > 0),
          ),
        );

        if (workspaceIds.length === 0) {
          return reply.send({ data: [], paginationInfo: buildPaginationInfo(0, paginationParams) });
        }

        if (requestedWorkspaceId != null && !workspaceIds.includes(requestedWorkspaceId)) {
          return reply.send({ data: [], paginationInfo: buildPaginationInfo(0, paginationParams) });
        }

        const scopedWorkspaceIds =
          requestedWorkspaceId != null ? [requestedWorkspaceId] : workspaceIds;
        membershipWorkspaceScope = scopedWorkspaceIds;

        const visibleMemberships = await membershipsRepo.findMany({
          workspaceId: { $in: expandForStringOrObjectIdIn(scopedWorkspaceIds) },
          ...activeMembershipStatusFilter(),
        } as any);

        const visibleUserIds = Array.from(
          new Set(
            visibleMemberships
              .map((membership) => normalizeToStringId((membership as { userId?: unknown }).userId))
              .filter((id): id is string => id != null && id.length > 0),
          ),
        );

        if (visibleUserIds.length === 0) {
          return reply.send({ data: [], paginationInfo: buildPaginationInfo(0, paginationParams) });
        }
        const identityFilter = buildUserFilterFromMembershipIdentities(visibleUserIds);
        if (identityFilter == null) {
          return reply.send({ data: [], paginationInfo: buildPaginationInfo(0, paginationParams) });
        }

        filter = {
          ...nonDeletedUserFilter,
          ...identityFilter,
        };
      }

      const [totalDocs, rows] = await Promise.all([
        usersRepo.count(filter as any),
        usersRepo.listPaginated(filter as any, { sort, skip, limit }),
      ]);

      let data = rows.map(
        (row: Record<string, unknown>) => omitPasswordHash(row) as Record<string, unknown>,
      );
      try {
        data = await enrichUsersWithWorkspaceMemberships(app, data, membershipWorkspaceScope);
      } catch (err) {
        request.log.error(
          { err, traceId: (request as { id?: string }).id },
          'enrichUsersWithWorkspaceMemberships failed',
        );
        data = data.map((row) => ({
          ...row,
          workspaces: [] as Array<{ workspaceId: string; workspaceName: string; role: string }>,
        }));
      }
      data = data.map((row) => serializeRecordForJsonApi(row));
      return reply.send({ data, paginationInfo: buildPaginationInfo(totalDocs, paginationParams) });
    },
  );

  app.post(
    '/v1/users',
    {
      config: { rateLimit: usersCreateRateLimit(app.config) },
      preHandler: [app.authenticate],
      schema: {
        ...createdObjectSchema('inviteUser', 'Users', 'Invita utente'),
        body: {
          type: 'object',
          required: ['email', 'fullName'],
          properties: {
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string', minLength: 2 },
            role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
            workspaceId: {
              type: 'string',
              description: 'Workspace in cui si invita (richiede ruolo owner/admin).',
            },
            createNewIdentity: {
              type: 'boolean',
              description:
                'Solo Tecma: crea una nuova identità scoped al workspace anche se la stessa email esiste altrove.',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const payload = createUserSchema.parse(request.body);
      const actor = request.user as {
        sub?: string;
        email?: string;
        permissions?: string[];
        systemRole?: string;
        system_role?: string;
      };
      const isTecma = isTecmaPlatformAdmin(normalizeSystemRole(actor));
      const permissions = actor.permissions ?? [];
      if (payload.workspaceId != null) {
        if (!isTecma) {
          const identities = await resolveUserIdentityCandidates(app, [
            actor.sub ?? '',
            actor.email,
          ]);
          const membership = await membershipsRepo.findOne({
            ...buildUserWorkspaceMembershipFilter(payload.workspaceId, identities),
            ...activeMembershipStatusFilter(),
          } as any);
          if (
            membership == null ||
            !['owner', 'admin'].includes(String((membership as { role?: string }).role ?? ''))
          ) {
            return reply.status(403).send({
              error: {
                code: 'Forbidden',
                message: 'Workspace owner or admin required to invite into this workspace',
                status: 403,
              },
            });
          }
        }
      } else if (!isTecma && !hasPermission(permissions, PERMISSIONS.USERS_INVITE)) {
        return reply.status(403).send({
          error: { code: 'Forbidden', message: 'Missing required permission', status: 403 },
        });
      }
      if (payload.workspaceId == null) {
        return reply.status(400).send({
          error: {
            code: 'WorkspaceRequired',
            message: 'Workspace is required for non-Tecma user identities',
            status: 400,
          },
        });
      }
      if (payload.createNewIdentity === true && !isTecma) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Only Tecma can force a new user identity',
            status: 403,
          },
        });
      }
      const now = new Date().toISOString();
      const emailLower = normalizeUserEmail(payload.email);
      let resolvedUser: { doc: UserDocument; created: boolean };
      try {
        resolvedUser = await resolveUserForWorkspaceInvite({
          email: emailLower,
          fullName: payload.fullName,
          role: payload.role,
          workspaceId: payload.workspaceId,
          now,
          forceCreateNewIdentity: payload.createNewIdentity === true,
        });
      } catch (error) {
        if (error instanceof Error && error.message === AMBIGUOUS_USER_IDENTITY_CODE) {
          await app.auditService.authEvent({
            eventType: 'user.identity.ambiguous_invite_blocked',
            userId: actor.sub ?? 'system',
            details: { email: emailLower, workspaceId: payload.workspaceId },
          });
          return reply.status(409).send({
            error: {
              code: 'AmbiguousUserIdentity',
              message:
                'Questa email esiste in più workspace. Contatta Tecma per scegliere l’identità corretta.',
              status: 409,
            },
          });
        }
        if (error instanceof Error && error.message === 'DuplicateWorkspaceEmail') {
          return reply.status(409).send({
            error: {
              code: 'DuplicateWorkspaceEmail',
              message: 'Esiste già un utente con questa email in questo workspace',
              status: 409,
            },
          });
        }
        if (error instanceof Error && error.message === 'TecmaIdentityCannotBeInvited') {
          return reply.status(409).send({
            error: {
              code: 'TecmaIdentityCannotBeInvited',
              message: 'Gli utenti Tecma sono identità globali e non vanno invitati nei workspace.',
              status: 409,
            },
          });
        }
        throw error;
      }
      const createdUser = resolvedUser.created;
      const doc = resolvedUser.doc;
      if (!createdUser && isTecmaUserRecord(doc)) {
        return reply.status(409).send({
          error: {
            code: 'DuplicateEmail',
            message: 'Esiste già un utente con questa email',
            status: 409,
          },
        });
      }

      if (createdUser) {
        try {
          await usersRepo.create(doc);
        } catch (error) {
          if (error instanceof MongoServerError && error.code === 11000) {
            return reply.status(409).send({
              error: {
                code: 'DuplicateWorkspaceEmail',
                message: 'Esiste già un utente con questa email in questo workspace',
                status: 409,
              },
            });
          }
          throw error;
        }
      }
      let membershipId: string | null = null;
      let createdMembership = false;
      const inviteToken = crypto.randomBytes(48).toString('base64url');
      try {
        if (payload.workspaceId != null) {
          const userId = doc._id.toString();
          const existingMembership = await membershipsRepo.findOne({
            workspaceId: payload.workspaceId,
            userId,
            status: { $nin: ['deleted', 'deactivated', 'suspended'] },
          } as any);
          if (existingMembership == null) {
            membershipId = crypto.randomUUID();
            createdMembership = true;
            await membershipsRepo.create({
              _id: membershipId,
              workspaceId: payload.workspaceId,
              userId,
              role: payload.role,
              access_scope: 'workspace',
              status: 'invited',
              createdAt: now,
              updatedAt: now,
            } as any);
          } else {
            membershipId = String((existingMembership as { _id?: unknown })._id ?? '');
            if (String((existingMembership as { status?: unknown }).status) === 'invited') {
              await membershipsRepo.updateOne(
                { _id: (existingMembership as { _id?: unknown })._id } as any,
                { $set: { role: payload.role, updatedAt: now } } as any,
              );
            }
          }
        }
        await inviteTokensRepo.create({
          _id: crypto.randomUUID(),
          tokenHash: hashOpaqueToken(inviteToken),
          userId: doc._id.toString(),
          workspaceId: payload.workspaceId,
          role: payload.role,
          projectIds: [],
          status: 'active',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          createdAt: now,
          createdBy: actor.sub ?? 'system',
        } as any);
        await app.mail.sendTemplate({
          to: doc.email,
          flowKey: 'workspace_invite',
          vars: {
            workspaceId: payload.workspaceId ?? '',
            inviteUrl: buildInviteAcceptUrl(inviteToken),
          },
        });
      } catch (error) {
        if (membershipId != null && createdMembership) {
          await membershipsRepo.updateOne(
            { _id: membershipId } as any,
            {
              $set: {
                status: 'deleted',
                deletedAt: now,
                deletedBy: actor.sub ?? 'system',
                updatedAt: now,
              },
            } as any,
          );
        }
        if (createdUser) {
          await usersRepo.updateOne(
            { _id: doc._id } as any,
            {
              $set: {
                status: 'deleted',
                deletedAt: now,
                deletedBy: actor.sub ?? 'system',
                updatedAt: now,
              },
            } as any,
          );
        }
        throw error;
      }

      await app.auditService.authEvent({
        eventType: 'users.invite',
        userId: (request.user as { sub?: string })?.sub ?? 'system',
        details: { invitedEmail: doc.email },
      });

      return reply.status(201).send({ data: omitPasswordHash(doc as Record<string, unknown>) });
    },
  );

  const bulkInviteItemSchema = z.object({
    email: z.string().email(),
    fullName: z.string().min(2),
    role: z.enum(['owner', 'admin', 'collaborator', 'viewer']).default('viewer'),
  });
  const bulkInviteSchema = z.object({
    workspaceId: z.string().min(1),
    users: z.array(bulkInviteItemSchema).min(1).max(50),
  });

  app.post(
    '/v1/users/bulk-invite',
    {
      config: { rateLimit: usersBulkInviteRateLimit(app.config) },
      preHandler: [app.authenticate],
      schema: {
        tags: ['Users'],
        operationId: 'bulkInviteUsers',
        summary: 'Invita utenti in batch',
        description:
          'Invita fino a 50 utenti in un workspace. Risposta con successes/failures per gestione parziale.',
        security: [{ ApiKeyAuth: [], BearerAuth: [] }],
        body: {
          type: 'object',
          required: ['workspaceId', 'users'],
          properties: {
            workspaceId: { type: 'string' },
            users: {
              type: 'array',
              items: {
                type: 'object',
                required: ['email', 'fullName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  fullName: { type: 'string', minLength: 2 },
                  role: { type: 'string', enum: ['owner', 'admin', 'collaborator', 'viewer'] },
                },
              },
              minItems: 1,
              maxItems: 50,
            },
          },
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
                required: ['successes', 'failures'],
                properties: {
                  successes: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['email', 'userId'],
                      properties: {
                        email: { type: 'string', format: 'email' },
                        userId: { type: 'string' },
                      },
                    },
                  },
                  failures: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['email', 'reason'],
                      properties: {
                        email: { type: 'string', format: 'email' },
                        reason: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { $ref: 'ErrorResponse#' },
          403: { $ref: 'ErrorResponse#' },
          500: { $ref: 'ErrorResponse#' },
        },
      },
    },
    async (request, reply) => {
      const payload = bulkInviteSchema.parse(request.body);
      const actor = request.user as {
        sub?: string;
        email?: string;
        permissions?: string[];
        systemRole?: string;
        system_role?: string;
      };
      const isTecma = isTecmaPlatformAdmin(normalizeSystemRole(actor));

      if (!isTecma) {
        const identities = await resolveUserIdentityCandidates(app, [actor.sub ?? '', actor.email]);
        const membership = await membershipsRepo.findOne({
          ...buildUserWorkspaceMembershipFilter(payload.workspaceId, identities),
          ...activeMembershipStatusFilter(),
        } as any);
        if (
          membership == null ||
          !['owner', 'admin'].includes(String((membership as { role?: string }).role ?? ''))
        ) {
          return reply.status(403).send({
            error: {
              code: 'Forbidden',
              message: 'Workspace owner or admin required to bulk-invite',
              status: 403,
            },
          });
        }
      }

      const now = new Date().toISOString();
      const successes: Array<{ email: string; userId: string; invited: boolean }> = [];
      const failures: Array<{ email: string; reason: string }> = [];

      for (const item of payload.users) {
        try {
          const normalizedEmail = normalizeUserEmail(item.email);
          const resolved = await resolveUserForWorkspaceInvite({
            email: normalizedEmail,
            fullName: item.fullName,
            role: item.role,
            workspaceId: payload.workspaceId,
            now,
          });
          if (resolved.created) await usersRepo.create(resolved.doc);
          const userId = userIdFromRecord(resolved.doc);

          // Upsert membership.
          const existingMembership = await membershipsRepo.findOne({
            workspaceId: payload.workspaceId,
            userId,
            status: { $ne: 'deleted' },
          } as any);
          if (existingMembership == null) {
            await membershipsRepo.create({
              _id: crypto.randomUUID(),
              workspaceId: payload.workspaceId,
              userId,
              role: item.role,
              access_scope: 'workspace',
              status: 'invited',
              createdAt: now,
              updatedAt: now,
            } as any);
          }

          // Create invite token.
          const inviteToken = crypto.randomBytes(48).toString('base64url');
          await inviteTokensRepo.create({
            _id: crypto.randomUUID(),
            tokenHash: hashOpaqueToken(inviteToken),
            userId,
            workspaceId: payload.workspaceId,
            role: item.role,
            status: 'active',
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            createdAt: now,
            createdBy: actor.sub ?? 'system',
          } as any);

          // Send invite email (non-blocking failure: log, don't abort batch).
          try {
            await app.mail.sendTemplate({
              to: normalizedEmail,
              flowKey: 'workspace_invite',
              vars: {
                workspaceId: payload.workspaceId,
                inviteUrl: buildInviteAcceptUrl(inviteToken),
              },
            });
          } catch {
            // Email failure is logged but does not fail the individual invite.
          }

          successes.push({ email: normalizedEmail, userId, invited: true });
        } catch (err) {
          const reason = err instanceof Error ? err.message : 'Unknown error';
          failures.push({ email: item.email, reason });
        }
      }

      await app.auditService.authEvent({
        eventType: 'users.bulk_invite',
        userId: actor.sub ?? 'system',
        details: {
          workspaceId: payload.workspaceId,
          requested: payload.users.length,
          succeeded: successes.length,
          failed: failures.length,
        },
      });

      return reply.send({ data: { successes, failures } });
    },
  );

  app.get(
    '/v1/me',
    {
      preHandler: [app.authenticate],
      schema: {
        ...singleObjectSchema('getCurrentUserProfile', 'Users', 'Profilo utente corrente'),
      },
    },
    async (request, reply) => {
      const actor = request.user as { sub?: string; email?: string };
      const identities = await resolveUserIdentityCandidates(app, [actor.sub, actor.email]);
      const user = await usersRepo.findOne({
        _id: { $in: expandForStringOrObjectIdIn(identities) },
        ...nonDeletedUserFilter,
      } as any);
      if (user == null) {
        return reply
          .status(404)
          .send({ error: { code: 'UserNotFound', message: 'User not found', status: 404 } });
      }
      return reply.send({ data: omitPasswordHash(user as Record<string, unknown>) });
    },
  );

  app.delete(
    '/v1/me',
    {
      preHandler: [app.authenticate],
      schema: {
        ...okDeletedSchema('selfDeleteCurrentUser', 'Users', 'Cancella il proprio account'),
      },
    },
    async (request, reply) => {
      const actor = request.user as {
        sub?: string;
        email?: string;
        systemRole?: string;
        system_role?: string;
      };
      const identities = await resolveUserIdentityCandidates(app, [actor.sub, actor.email]);
      const currentUser = await usersRepo.findOne({
        _id: { $in: expandForStringOrObjectIdIn(identities) },
        ...nonDeletedUserFilter,
      } as any);
      if (currentUser == null) {
        return reply
          .status(404)
          .send({ error: { code: 'UserNotFound', message: 'User not found', status: 404 } });
      }

      const userIdStr = normalizeToStringId((currentUser as { _id?: unknown })._id);
      if (userIdStr == null) {
        return reply.status(500).send({
          error: { code: 'InvalidUserRecord', message: 'Invalid user record', status: 500 },
        });
      }
      const objectId = parseUserObjectId(userIdStr);
      if (
        objectId != null &&
        isTecmaPlatformAdmin(normalizeSystemRole(currentUser as any)) &&
        (await isLastActiveTecmaAdmin(objectId))
      ) {
        return reply.status(409).send({
          error: {
            code: 'LastTecmaAdmin',
            message: 'Cannot delete the last active Tecma SuperAdmin',
            status: 409,
          },
        });
      }

      const allIdentities = [
        ...new Set([...identities, userIdStr, String(currentUser.email ?? '')]),
      ];
      const blockingWorkspaceIds = await lastPrivilegedWorkspaceIdsForUser(allIdentities);
      if (blockingWorkspaceIds.length > 0) {
        return reply.status(409).send({
          error: {
            code: 'LastWorkspaceAdmin',
            message: 'Transfer workspace ownership before deleting your account',
            status: 409,
            details: { workspaceIds: blockingWorkspaceIds },
          },
        });
      }

      const now = new Date().toISOString();
      const actorId = actor.sub ?? userIdStr;
      const softDeleteFields = buildSoftDeleteFields({
        actorId,
        now,
        reason: 'user_self_delete',
      });
      await usersRepo.updateOne(
        { _id: { $in: expandForStringOrObjectIdIn([userIdStr]) } } as any,
        { $set: softDeleteFields } as any,
      );
      const sessionsResult = await authSessionsRepo.deleteMany({ userId: userIdStr } as any);
      await usersRepo.updateMany(
        { _id: { $in: expandForStringOrObjectIdIn([userIdStr]) } } as any,
        { $inc: { authTokenVersion: 1 }, $set: { updatedAt: now } } as any,
      );
      const membershipsResult = await membershipsRepo.updateMany(
        {
          userId: { $in: expandForStringOrObjectIdIn(allIdentities) },
          status: { $ne: 'deleted' },
        } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            deletedReason: 'user_self_delete',
            deleteReason: 'user_self_delete',
            purgeEligibleAt: softDeleteFields.purgeEligibleAt,
            updatedAt: now,
          },
        } as any,
      );
      const projectGrantsResult = await workspaceUserProjectsRepo.updateMany(
        {
          userId: { $in: expandForStringOrObjectIdIn(allIdentities) },
          status: { $ne: 'revoked' },
        } as any,
        {
          $set: {
            status: 'revoked',
            revokedAt: now,
            revokedBy: actorId,
            revokedReason: 'user_self_delete',
            updatedAt: now,
          },
        } as any,
      );
      await inviteTokensRepo.updateMany(
        { userId: { $in: expandForStringOrObjectIdIn([userIdStr]) }, status: 'active' } as any,
        { $set: { status: 'revoked', revokedAt: now, revokedBy: actorId, updatedAt: now } } as any,
      );
      await app.auditService.authEvent({
        eventType: 'users.self_delete',
        userId: actorId,
        details: {
          targetUserId: userIdStr,
          purgeEligibleAt: softDeleteFields.purgeEligibleAt,
          cascadeSessionsRevoked: sessionsResult.deletedCount,
          cascadeMembershipsDeleted: membershipsResult.modifiedCount,
          cascadeProjectGrantsRevoked: projectGrantsResult.modifiedCount,
        },
      });
      await enqueueLifecycleNotice(app, {
        entityType: 'user',
        entityId: userIdStr,
        eventType: 'user.self_deleted',
        actorId,
        reason: 'user_self_delete',
        purgeEligibleAt: String(softDeleteFields.purgeEligibleAt),
        recipients: [
          { kind: 'tecma' },
          { kind: 'user', userId: userIdStr, email: String(currentUser.email ?? '') },
        ],
      });

      return reply.send({
        data: {
          deleted: true,
          cascadeSessionsRevoked: sessionsResult.deletedCount,
          cascadeMembershipsDeleted: membershipsResult.modifiedCount,
          cascadeProjectGrantsRevoked: projectGrantsResult.modifiedCount,
        },
      });
    },
  );

  app.delete(
    '/v1/me/workspaces/:workspaceId',
    {
      preHandler: [app.authenticate],
      schema: {
        ...okDeletedSchema('leaveCurrentUserWorkspace', 'Users', 'Esci da workspace'),
        params: {
          type: 'object',
          required: ['workspaceId'],
          properties: { workspaceId: { type: 'string' } },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { workspaceId: string };
      const actor = request.user as { sub?: string; email?: string };
      const identities = await resolveUserIdentityCandidates(app, [actor.sub, actor.email]);
      const currentUser = await usersRepo.findOne({
        _id: { $in: expandForStringOrObjectIdIn(identities) },
        ...nonDeletedUserFilter,
      } as any);
      if (
        currentUser != null &&
        String((currentUser as { homeWorkspaceId?: unknown }).homeWorkspaceId ?? '') ===
          params.workspaceId
      ) {
        return reply.status(409).send({
          error: {
            code: 'HomeWorkspaceIdentityDeleteRequired',
            message:
              'Questo è il workspace home dell’identità: usa la cancellazione account per rimuoverla ovunque.',
            status: 409,
          },
        });
      }
      const membership = await membershipsRepo.findOne({
        ...buildUserWorkspaceMembershipFilter(params.workspaceId, identities),
        ...activeMembershipStatusFilter(),
      } as any);
      if (membership == null) {
        return reply.status(404).send({
          error: {
            code: 'MembershipNotFound',
            message: 'Workspace membership not found',
            status: 404,
          },
        });
      }
      const role = String((membership as { role?: unknown }).role ?? '');
      if (['owner', 'admin'].includes(role)) {
        const activeAdmins = await membershipsRepo.count({
          workspaceId: params.workspaceId,
          role: { $in: ['owner', 'admin'] },
          ...activeMembershipStatusFilter(),
        } as any);
        if (activeAdmins <= 1) {
          return reply.status(409).send({
            error: {
              code: 'LastWorkspaceAdmin',
              message: 'Transfer workspace ownership before leaving this workspace',
              status: 409,
            },
          });
        }
      }

      const now = new Date().toISOString();
      const actorId = actor.sub ?? String((membership as { userId?: unknown }).userId ?? 'system');
      const update = await membershipsRepo.updateOne(
        {
          ...buildUserWorkspaceMembershipFilter(params.workspaceId, identities),
          ...activeMembershipStatusFilter(),
        } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actorId,
            deletedReason: 'user_left_workspace',
            deleteReason: 'user_left_workspace',
            purgeEligibleAt: buildSoftDeleteFields({
              actorId,
              now,
              reason: 'user_left_workspace',
            }).purgeEligibleAt,
            updatedAt: now,
          },
        } as any,
      );
      await workspaceUserProjectsRepo.updateMany(
        {
          workspaceId: params.workspaceId,
          userId: { $in: expandForStringOrObjectIdIn(identities) },
          status: { $ne: 'revoked' },
        } as any,
        {
          $set: {
            status: 'revoked',
            revokedAt: now,
            revokedBy: actorId,
            revokedReason: 'user_left_workspace',
            updatedAt: now,
          },
        } as any,
      );
      await app.auditService.authEvent({
        eventType: 'users.workspace_leave',
        userId: actorId,
        details: { workspaceId: params.workspaceId, modifiedCount: update.modifiedCount },
      });
      await enqueueLifecycleNotice(app, {
        entityType: 'workspace_membership',
        entityId: `${params.workspaceId}:${actorId}`,
        eventType: 'workspace.membership_left',
        actorId,
        reason: 'user_left_workspace',
        recipients: [{ kind: 'tecma' }, { kind: 'user', userId: actorId, email: actor.email }],
        metadata: { workspaceId: params.workspaceId },
      });

      return reply.send({ data: { deleted: true } });
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
          properties: {
            userId: {
              type: 'string',
              description:
                'Identificativo utente (ObjectId hex o stringa legacy presente in tz_users._id)',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const params = request.params as { userId: string };
      const user = await findUserDocumentByParamId(params.userId);
      if (user == null) {
        return reply
          .status(404)
          .send({ error: { code: 'UserNotFound', message: 'User not found', status: 404 } });
      }
      const actor = request.user as {
        sub?: string;
        email?: string;
        systemRole?: string;
        system_role?: string;
      };
      const context = await actorContext(actor);
      const targetStr = normalizeToStringId(user._id);
      if (targetStr == null || targetStr === '') {
        return reply.status(500).send({
          error: { code: 'InternalError', message: 'Invalid user record', status: 500 },
        });
      }

      let allowed = context.isTecma;
      if (!allowed) {
        const identities = await resolveUserIdentityCandidates(app, [actor.sub, actor.email]);
        allowed = identityMatchesUserDocument(identities, user);
      }
      if (!allowed) {
        allowed = await targetHasMembershipIn(targetStr, context.workspaceIds);
      }
      if (!allowed) {
        return reply.status(403).send({
          error: { code: 'Forbidden', message: 'User is outside your workspaces', status: 403 },
        });
      }

      /** Allineato a GET /v1/users: Tecma → tutte le membership; altri → solo workspace visibili. */
      const membershipWorkspaceScope: string[] | null = context.isTecma
        ? null
        : context.workspaceIds;

      let data: Record<string, unknown>[] = [omitPasswordHash(user)];
      try {
        data = await enrichUsersWithWorkspaceMemberships(app, data, membershipWorkspaceScope);
      } catch (err) {
        request.log.error(
          { err, traceId: (request as { id?: string }).id },
          'enrichUsersWithWorkspaceMemberships failed',
        );
        data = data.map((row) => ({
          ...row,
          workspaces: [] as Array<{ workspaceId: string; workspaceName: string; role: string }>,
        }));
      }
      data = data.map((row) => serializeRecordForJsonApi(row));
      const payload = data[0];
      if (payload == null) {
        return reply
          .status(404)
          .send({ error: { code: 'UserNotFound', message: 'User not found', status: 404 } });
      }
      return reply.send({ data: payload });
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
            systemRole: { type: 'string', enum: ['user', 'tecma_admin'] },
            permissionsOverride: {
              type: 'array',
              items: { type: 'string', minLength: 1 },
              description:
                'Lista permessi extra (catalogo RBAC). La wildcard "*" e ammessa solo per platform admin.',
            },
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
      const actor = request.user as { sub?: string; systemRole?: string; system_role?: string };
      const actorIsTecmaAdmin = isTecmaPlatformAdmin(normalizeSystemRole(actor));
      const before = await usersRepo.findOne({ _id: userObjectId, ...nonDeletedUserFilter });
      if (before == null) {
        return reply
          .status(404)
          .send({ error: { code: 'UserNotFound', message: 'User not found', status: 404 } });
      }

      const roleChangeRequested = payload.systemRole != null;
      if (roleChangeRequested && !actorIsTecmaAdmin) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Only Tecma SuperAdmin can change systemRole',
            status: 403,
          },
        });
      }
      if (
        !actorIsTecmaAdmin &&
        payload.permissionsOverride?.includes(PERMISSION_WILDCARD) === true
      ) {
        return reply.status(403).send({
          error: {
            code: 'WildcardPermissionRequiresAdmin',
            message: 'Only Tecma admin can grant wildcard permission',
            status: 403,
          },
        });
      }
      if (!actorIsTecmaAdmin && payload.permissionsOverride != null) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Only Tecma SuperAdmin can change permission overrides',
            status: 403,
          },
        });
      }
      if (!actorIsTecmaAdmin && actor.sub !== userObjectId.toString()) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Workspace admins must use workspace membership endpoints',
            status: 403,
          },
        });
      }

      if (payload.permissionsOverride != null) {
        for (const id of payload.permissionsOverride) {
          if (id === PERMISSION_WILDCARD) {
            if (!actorIsTecmaAdmin) {
              return reply.status(403).send({
                error: {
                  code: 'WildcardPermissionRequiresAdmin',
                  message: 'Only Tecma admin can grant wildcard permission',
                  status: 403,
                },
              });
            }
            continue;
          }
          if (!ALL_PERMISSION_IDS.includes(id)) {
            return reply.status(400).send({
              error: {
                code: 'UnknownPermissionId',
                message: `Unknown permission id "${id}"`,
                status: 400,
              },
            });
          }
        }
      }

      const beforeIsTecmaAdmin = isTecmaPlatformAdmin(normalizeSystemRole(before));
      if (
        roleChangeRequested &&
        payload.systemRole !== 'tecma_admin' &&
        beforeIsTecmaAdmin &&
        actor.sub === userObjectId.toString() &&
        (await isLastActiveTecmaAdmin(userObjectId))
      ) {
        return reply.status(409).send({
          error: {
            code: 'LastTecmaAdmin',
            message: 'Cannot remove the last active Tecma SuperAdmin',
            status: 409,
          },
        });
      }

      const update: Record<string, unknown> = {
        $set: { updatedAt: new Date().toISOString() },
      };
      if (payload.fullName != null) {
        (update.$set as Record<string, unknown>).fullName = payload.fullName;
      }
      if (payload.systemRole === 'tecma_admin') {
        (update.$set as Record<string, unknown>).systemRole = 'tecma_admin';
        (update.$set as Record<string, unknown>).system_role = 'tecma_admin';
        (update.$set as Record<string, unknown>).isTecmaAdmin = true;
      } else if (payload.systemRole === 'user') {
        (update.$set as Record<string, unknown>).systemRole = 'user';
        update.$unset = { system_role: '', isTecmaAdmin: '' };
      }

      if (payload.permissionsOverride != null) {
        const dedup = Array.from(new Set(payload.permissionsOverride));
        (update.$set as Record<string, unknown>).permissionsOverride = dedup;
        update.$unset = { ...(update.$unset as object | undefined), permissions_override: '' };
      }

      await usersRepo.updateOne({ _id: userObjectId }, update as any);
      const user = await usersRepo.findOne({ _id: userObjectId });
      if (roleChangeRequested) {
        await app.auditService.authEvent({
          eventType: 'users.systemRole.update',
          userId: actor.sub ?? 'system',
          details: {
            targetUserId: userObjectId.toString(),
            before: normalizeSystemRole(before) ?? 'user',
            after: payload.systemRole,
          },
        });
      }
      if (payload.permissionsOverride != null) {
        await app.auditService.authEvent({
          eventType: 'users.permissionsOverride.update',
          userId: actor.sub ?? 'system',
          details: {
            targetUserId: userObjectId.toString(),
            permissions: payload.permissionsOverride,
          },
        });
      }
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
      const actor = request.user as { sub?: string; systemRole?: string; system_role?: string };
      if (!isTecmaPlatformAdmin(normalizeSystemRole(actor))) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Only Tecma SuperAdmin can delete global users',
            status: 403,
          },
        });
      }
      const before = await usersRepo.findOne({ _id: userObjectId });
      if (before == null || String((before as { status?: unknown }).status ?? '') === 'deleted') {
        return reply
          .status(404)
          .send({ error: { code: 'UserNotFound', message: 'User not found', status: 404 } });
      }

      const beforeIsTecmaAdmin = isTecmaPlatformAdmin(normalizeSystemRole(before as any));
      if (beforeIsTecmaAdmin && (await isLastActiveTecmaAdmin(userObjectId))) {
        return reply.status(409).send({
          error: {
            code: 'LastTecmaAdmin',
            message: 'Cannot delete the last active Tecma SuperAdmin',
            status: 409,
          },
        });
      }

      const now = new Date().toISOString();
      const userIdStr = userObjectId.toString();
      const softDeleteFields = buildSoftDeleteFields({
        actorId: actor.sub ?? 'system',
        now,
        reason: 'user_deleted_by_tecma',
      });
      await usersRepo.updateOne({ _id: userObjectId }, { $set: softDeleteFields } as any);

      // CASCADE — quando un utente viene cancellato globalmente:
      // 1. Tutte le sessioni attive vengono invalidate (logout forzato).
      // 2. Tutte le membership workspace vengono marcate deleted.
      // 3. Tutti i grant diretti sui progetti vengono revocati.
      // Questo previene accesso residuo via JWT ancora valido + cleanup tenant isolation.
      const sessionsResult = await authSessionsRepo.deleteMany({ userId: userIdStr } as any);
      await usersRepo.updateMany(
        { _id: { $in: expandForStringOrObjectIdIn([userIdStr]) } } as any,
        { $inc: { authTokenVersion: 1 }, $set: { updatedAt: now } } as any,
      );

      const membershipsResult = await membershipsRepo.updateMany(
        { userId: userIdStr, status: { $nin: ['deleted'] } } as any,
        {
          $set: {
            status: 'deleted',
            deletedAt: now,
            deletedBy: actor.sub ?? 'system',
            deletedReason: 'user_deleted_by_tecma',
            deleteReason: 'user_deleted_by_tecma',
            purgeEligibleAt: softDeleteFields.purgeEligibleAt,
            updatedAt: now,
          },
        } as any,
      );

      const projectGrantsResult = await workspaceUserProjectsRepo.updateMany(
        { userId: userIdStr, status: { $ne: 'revoked' } } as any,
        {
          $set: {
            status: 'revoked',
            revokedAt: now,
            revokedBy: actor.sub ?? 'system',
            revokedReason: 'user_deleted',
            updatedAt: now,
          },
        } as any,
      );

      await app.auditService.authEvent({
        eventType: 'users.delete',
        userId: actor.sub ?? 'system',
        details: {
          targetUserId: userIdStr,
          mode: 'soft-delete',
          purgeEligibleAt: softDeleteFields.purgeEligibleAt,
          cascadeSessionsRevoked: sessionsResult.deletedCount,
          cascadeMembershipsDeleted: membershipsResult.modifiedCount,
          cascadeProjectGrantsRevoked: projectGrantsResult.modifiedCount,
        },
      });
      await enqueueLifecycleNotice(app, {
        entityType: 'user',
        entityId: userIdStr,
        eventType: 'user.soft_deleted',
        actorId: actor.sub ?? 'system',
        reason: 'user_deleted_by_tecma',
        purgeEligibleAt: String(softDeleteFields.purgeEligibleAt),
        recipients: [
          { kind: 'tecma' },
          {
            kind: 'user',
            userId: userIdStr,
            email: String((before as { email?: unknown }).email ?? ''),
          },
        ],
      });

      return reply.send({
        data: {
          deleted: true,
          cascadeSessionsRevoked: sessionsResult.deletedCount,
          cascadeMembershipsDeleted: membershipsResult.modifiedCount,
          cascadeProjectGrantsRevoked: projectGrantsResult.modifiedCount,
        },
      });
    },
  );

  app.post(
    '/v1/users/:userId/deactivate',
    {
      config: { rateLimit: usersStateChangeRateLimit(app.config) },
      preHandler: [app.authenticate, app.requirePermission('users.write')],
      schema: {
        ...singleObjectSchema('deactivateUser', 'Users', 'Disattiva utente'),
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
      const actor = request.user as { sub?: string; systemRole?: string; system_role?: string };
      if (!isTecmaPlatformAdmin(normalizeSystemRole(actor))) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Only Tecma SuperAdmin can deactivate users',
            status: 403,
          },
        });
      }
      const before = await usersRepo.findOne({ _id: userObjectId, ...nonDeletedUserFilter });
      if (before == null) {
        return reply
          .status(404)
          .send({ error: { code: 'UserNotFound', message: 'User not found', status: 404 } });
      }
      if (String((before as { status?: unknown }).status ?? '') === 'deactivated') {
        return reply.status(409).send({
          error: {
            code: 'AlreadyDeactivated',
            message: 'User is already deactivated',
            status: 409,
          },
        });
      }

      const beforeIsTecmaAdmin = isTecmaPlatformAdmin(normalizeSystemRole(before as any));
      if (beforeIsTecmaAdmin && (await isLastActiveTecmaAdmin(userObjectId))) {
        return reply.status(409).send({
          error: {
            code: 'LastTecmaAdmin',
            message: 'Cannot deactivate the last active Tecma SuperAdmin',
            status: 409,
          },
        });
      }

      const now = new Date().toISOString();
      const userIdStr = userObjectId.toString();
      await usersRepo.updateOne({ _id: userObjectId }, {
        $set: {
          status: 'deactivated',
          deactivatedAt: now,
          deactivatedBy: actor.sub ?? 'system',
          updatedAt: now,
        },
      } as any);
      // Revoke all active sessions immediately.
      const sessionsRevoked = await authSessionsRepo.deleteMany({ userId: userIdStr } as any);
      await usersRepo.updateMany(
        { _id: { $in: expandForStringOrObjectIdIn([userIdStr]) } } as any,
        { $inc: { authTokenVersion: 1 }, $set: { updatedAt: now } } as any,
      );

      await app.auditService.authEvent({
        eventType: 'users.deactivate',
        userId: actor.sub ?? 'system',
        details: { targetUserId: userIdStr, sessionsRevoked: sessionsRevoked.deletedCount },
      });

      return reply.send({
        data: { deactivated: true, sessionsRevoked: sessionsRevoked.deletedCount },
      });
    },
  );

  app.post(
    '/v1/users/:userId/reactivate',
    {
      config: { rateLimit: usersStateChangeRateLimit(app.config) },
      preHandler: [app.authenticate, app.requirePermission('users.write')],
      schema: {
        ...singleObjectSchema('reactivateUser', 'Users', 'Riattiva utente'),
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
      const actor = request.user as { sub?: string; systemRole?: string; system_role?: string };
      if (!isTecmaPlatformAdmin(normalizeSystemRole(actor))) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Only Tecma SuperAdmin can reactivate users',
            status: 403,
          },
        });
      }
      const user = await usersRepo.findOne({ _id: userObjectId });
      if (user == null || String((user as { status?: unknown }).status ?? '') === 'deleted') {
        return reply
          .status(404)
          .send({ error: { code: 'UserNotFound', message: 'User not found', status: 404 } });
      }
      if (String((user as { status?: unknown }).status ?? '') !== 'deactivated') {
        return reply.status(409).send({
          error: { code: 'NotDeactivated', message: 'User is not deactivated', status: 409 },
        });
      }

      const now = new Date().toISOString();
      const userIdStr = userObjectId.toString();
      await usersRepo.updateOne({ _id: userObjectId }, {
        $set: {
          status: 'active',
          reactivatedAt: now,
          reactivatedBy: actor.sub ?? 'system',
          updatedAt: now,
        },
        $unset: { deactivatedAt: '', deactivatedBy: '' },
      } as any);

      await app.auditService.authEvent({
        eventType: 'users.reactivate',
        userId: actor.sub ?? 'system',
        details: { targetUserId: userIdStr },
      });

      return reply.send({ data: { reactivated: true } });
    },
  );

  app.get(
    '/v1/users/:userId/audit',
    {
      preHandler: [app.authenticate],
      schema: {
        ...listSchema('listUserAuditEvents', 'Users', 'Audit eventi utente'),
        params: {
          type: 'object',
          required: ['userId'],
          properties: { userId: { type: 'string' } },
        },
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            page: { type: 'integer', minimum: 1, default: 1 },
            perPage: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
            sortField: { type: 'string', enum: [...userAuditAllowedSortFields] },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
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
      const actor = request.user as {
        sub?: string;
        email?: string;
        systemRole?: string;
        system_role?: string;
      };
      const actorIsTecma = isTecmaPlatformAdmin(normalizeSystemRole(actor));
      const userIdStr = userObjectId.toString();
      // Non-tecma actors may only read their own audit trail or users in shared workspaces.
      if (!actorIsTecma) {
        const isSelf = actor.sub === userIdStr;
        if (!isSelf) {
          const context = await actorContext(actor);
          const hasAccess = await targetHasMembershipIn(userIdStr, context.adminWorkspaceIds);
          if (!hasAccess) {
            return reply.status(403).send({
              error: {
                code: 'Forbidden',
                message: 'Not authorized to view this audit log',
                status: 403,
              },
            });
          }
        }
      }
      const paginationParams = parsePaginationQuery(request.query, userAuditAllowedSortFields);
      const { data: events, totalDocs } = await app.auditService.listAuthEventsPaginated(
        { userId: userIdStr },
        paginationParams,
      );
      return reply.send({
        data: events,
        paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
      });
    },
  );

  app.post(
    '/v1/users/:userId/password-reset',
    {
      config: { rateLimit: usersPasswordResetRateLimit(app.config) },
      preHandler: [app.authenticate, app.requirePermission('users.invite')],
      schema: {
        ...singleObjectSchema(
          'requestUserPasswordReset',
          'Users',
          'Richiesta reset password utente',
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
      const userObjectId = parseUserObjectId(params.userId);
      if (userObjectId == null) {
        return reply
          .status(400)
          .send({ error: { code: 'InvalidUserId', message: 'Invalid user id', status: 400 } });
      }
      const actor = request.user as {
        sub?: string;
        email?: string;
        systemRole?: string;
        system_role?: string;
      };
      const context = await actorContext(actor);
      if (
        !context.isTecma &&
        !(await targetHasMembershipIn(userObjectId.toString(), context.adminWorkspaceIds))
      ) {
        return reply.status(403).send({
          error: {
            code: 'Forbidden',
            message: 'Workspace owner or admin required for this password reset',
            status: 403,
          },
        });
      }
      const requested = await authService.requestPasswordResetForUserId({
        userId: userObjectId.toString(),
        ip: request.ip,
        actorUserId: actor.sub,
      });
      await app.auditService.authEvent({
        eventType: 'users.password-reset',
        userId: actor.sub ?? 'system',
        details: { targetUserId: params.userId, requested },
      });
      return reply.send({ data: { requested } });
    },
  );
};
