import type { FastifyInstance } from 'fastify';

import { isTecmaPlatformAdmin, normalizeSystemRole } from '@followup/shared-rbac';

import {
  buildUserWorkspaceMembershipFilter,
  expandForStringOrObjectIdIn,
  normalizeToStringId,
} from './mongoIdentity.js';
import { resolveUserIdentityCandidates } from './userIdentity.js';

export type ProjectAccessCapability = 'read' | 'write' | 'admin';

type JwtUser = {
  sub?: string;
  email?: string;
  systemRole?: string;
  system_role?: string;
  permissions?: string[];
};

const isTecma = (user: JwtUser | undefined): boolean =>
  user != null && isTecmaPlatformAdmin(normalizeSystemRole(user));

const workspaceRolesAllowingWrite = new Set(['owner', 'admin', 'collaborator']);

async function loadProject(
  app: FastifyInstance,
  projectId: string,
): Promise<{ _id: string; workspaceId?: string } | null> {
  const doc = await app.mongoDb.collection('tz_projects').findOne({ _id: projectId } as any);
  if (doc == null) return null;
  const wid = normalizeToStringId((doc as { workspaceId?: unknown }).workspaceId);
  return {
    _id: String((doc as { _id?: unknown })._id ?? projectId),
    workspaceId: wid ?? undefined,
  };
}

async function membershipRoleForWorkspace(
  app: FastifyInstance,
  workspaceId: string,
  identityCandidates: string[],
): Promise<string | null> {
  const row = await app.mongoDb
    .collection('tz_user_workspaces')
    .findOne(buildUserWorkspaceMembershipFilter(workspaceId, identityCandidates) as any);
  if (row == null) return null;
  return String((row as { role?: unknown }).role ?? '');
}

function allowsCapabilityForWorkspaceMember(
  memberRole: string,
  capability: ProjectAccessCapability,
): boolean {
  const r = memberRole.toLowerCase();
  if (capability === 'read') return true;
  if (capability === 'write') return workspaceRolesAllowingWrite.has(r);
  if (capability === 'admin') return r === 'owner' || r === 'admin';
  return false;
}

export async function userHasProjectAccess(
  app: FastifyInstance,
  user: JwtUser | undefined,
  projectId: string,
  capability: ProjectAccessCapability,
): Promise<boolean> {
  if (user?.sub == null) return false;
  if (isTecma(user)) return true;

  const project = await loadProject(app, projectId);
  if (project == null) return false;

  const identityCandidates = await resolveUserIdentityCandidates(app, [user.sub, user.email]);
  const userIdIn = expandForStringOrObjectIdIn(identityCandidates);

  const directAssignment = await app.mongoDb.collection('tz_workspace_user_projects').findOne({
    projectId,
    userId: { $in: userIdIn },
  } as any);
  if (directAssignment != null) {
    const wsId = normalizeToStringId((directAssignment as { workspaceId?: unknown }).workspaceId);
    const role =
      wsId != null ? await membershipRoleForWorkspace(app, wsId, identityCandidates) : null;
    if (role == null) return capability === 'read';
    return allowsCapabilityForWorkspaceMember(role, capability);
  }

  const homeWs = project.workspaceId;
  if (homeWs != null) {
    const homeRole = await membershipRoleForWorkspace(app, homeWs, identityCandidates);
    if (homeRole != null) {
      const link = await app.mongoDb.collection('tz_workspace_projects').findOne({
        workspaceId: homeWs,
        projectId,
      } as any);
      if (link != null) return allowsCapabilityForWorkspaceMember(homeRole, capability);
    }
  }

  const grants = await app.mongoDb
    .collection('tz_project_access')
    .find({ project_id: projectId } as any)
    .toArray();
  for (const g of grants) {
    const grantedWs = normalizeToStringId((g as { workspace_id?: unknown }).workspace_id);
    if (grantedWs == null) continue;
    const memberRole = await membershipRoleForWorkspace(app, grantedWs, identityCandidates);
    if (memberRole == null) continue;
    const granteeRoleOnProject = String((g as { role?: unknown }).role ?? 'viewer').toLowerCase();
    if (capability === 'read') return true;
    if (capability === 'write') {
      if (!['owner', 'collaborator'].includes(granteeRoleOnProject)) continue;
      if (allowsCapabilityForWorkspaceMember(memberRole, 'write')) return true;
    }
    if (capability === 'admin') {
      if (granteeRoleOnProject !== 'owner') continue;
      if (allowsCapabilityForWorkspaceMember(memberRole, 'admin')) return true;
    }
  }

  return false;
}

/** Progetti visibili in `GET /v1/projects` senza workspaceId (non-Tecma). */
export async function listAccessibleProjectIdsForUser(
  app: FastifyInstance,
  identityCandidates: string[],
): Promise<string[]> {
  const userIdIn = expandForStringOrObjectIdIn(identityCandidates);
  const ids = new Set<string>();

  const assignments = await app.mongoDb
    .collection('tz_workspace_user_projects')
    .find({ userId: { $in: userIdIn } } as any)
    .toArray();
  for (const a of assignments) {
    const pid = normalizeToStringId((a as { projectId?: unknown }).projectId);
    if (pid != null) ids.add(pid);
  }

  const memberships = await app.mongoDb
    .collection('tz_user_workspaces')
    .find({ userId: { $in: userIdIn } } as any)
    .toArray();
  for (const m of memberships) {
    const wsId = normalizeToStringId((m as { workspaceId?: unknown }).workspaceId);
    if (wsId == null) continue;
    const links = await app.mongoDb
      .collection('tz_workspace_projects')
      .find({ workspaceId: wsId } as any)
      .toArray();
    for (const l of links) {
      const pid = normalizeToStringId((l as { projectId?: unknown }).projectId);
      if (pid != null) ids.add(pid);
    }
    const grantsHere = await app.mongoDb
      .collection('tz_project_access')
      .find({ workspace_id: wsId } as any)
      .toArray();
    for (const g of grantsHere) {
      const pid = normalizeToStringId((g as { project_id?: unknown }).project_id);
      if (pid != null) ids.add(pid);
    }
  }

  return [...ids];
}
