import { isTecmaPlatformAdmin, normalizeSystemRole } from '@followup/shared-rbac';

import type { FastifyInstance } from 'fastify';

import {
  activeMembershipStatusFilter,
  activeResourceStatusFilter,
  expandForStringOrObjectIdIn,
  normalizeToStringId,
} from '../../lib/mongoIdentity.js';
import { resolveUserIdentityCandidates } from '../../lib/userIdentity.js';

/** Utente JWT minimo per filtrare i workspace per membership. */
export type WorkspaceListUser = {
  sub: string;
  email: string;
  systemRole?: string;
  system_role?: string;
};

/**
 * Elenco workspace visibili al chiamante:
 * - amministratore piattaforma Tecma (`tecma_admin`, `tecma_superadmin`, …): tutti i documenti in `tz_workspaces`;
 * - altri: solo workspace con riga in `tz_user_workspaces` per una delle identità risolte (sub/email/ObjectId).
 */
export async function listWorkspacesForRequester(
  app: FastifyInstance,
  user: WorkspaceListUser,
): Promise<unknown[]> {
  const coll = app.mongoDb.collection('tz_workspaces');

  if (isTecmaPlatformAdmin(normalizeSystemRole(user))) {
    return coll.find(activeResourceStatusFilter()).toArray();
  }

  const identityList = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
  if (identityList.length === 0) {
    return [];
  }

  const userIdIn = expandForStringOrObjectIdIn(identityList);

  const memberships = await app.mongoDb
    .collection('tz_user_workspaces')
    .find({
      userId: { $in: userIdIn },
      ...activeMembershipStatusFilter(),
    } as Record<string, unknown>)
    .toArray();

  const workspaceIds = Array.from(
    new Set(
      memberships
        .map((m) => normalizeToStringId(m.workspaceId))
        .filter((id): id is string => id != null && id.length > 0),
    ),
  );

  if (workspaceIds.length === 0) {
    return [];
  }

  const workspaceDocIds = expandForStringOrObjectIdIn(workspaceIds);
  return coll
    .find({
      _id: { $in: workspaceDocIds },
      ...activeResourceStatusFilter(),
    } as Record<string, unknown>)
    .toArray();
}
