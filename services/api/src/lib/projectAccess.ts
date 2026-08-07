import type { FastifyInstance } from 'fastify';

import { isTecmaPlatformAdmin, normalizeSystemRole } from '@followup/shared-rbac';

import {
  activeAccessStatusFilter,
  activeMembershipStatusFilter,
  activeResourceStatusFilter,
  buildUserWorkspaceMembershipFilter,
  expandForStringOrObjectIdIn,
  mongoPrimaryKeyFilter,
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

type WorkspaceMembership = {
  role: string;
  accessScope: 'all' | 'assigned' | null;
};

const isTecma = (user: JwtUser | undefined): boolean =>
  user != null && isTecmaPlatformAdmin(normalizeSystemRole(user));

const workspaceRolesAllowingWrite = new Set(['owner', 'admin', 'collaborator']);

function normalizeMembershipAccessScope(row: Record<string, unknown>): 'all' | 'assigned' | null {
  const explicit = String(row.accessScope ?? '').toLowerCase();
  if (explicit === 'all' || explicit === 'assigned') return explicit;

  const legacy = String(row.access_scope ?? '').toLowerCase();
  if (legacy === 'workspace' || legacy === 'all') return 'all';
  if (legacy === 'assigned') return 'assigned';

  return null;
}

async function loadProject(
  app: FastifyInstance,
  projectId: string,
): Promise<{ _id: string; workspaceId?: string } | null> {
  const doc = await app.mongoDb
    .collection('tz_projects')
    .findOne({ _id: projectId, ...activeResourceStatusFilter() } as any);
  if (doc == null) return null;
  const wid = normalizeToStringId((doc as { workspaceId?: unknown }).workspaceId);
  if (wid != null) {
    const workspace = await app.mongoDb
      .collection('tz_workspaces')
      .findOne({ ...mongoPrimaryKeyFilter(wid), ...activeResourceStatusFilter() } as any);
    if (workspace == null) return null;
  }
  return {
    _id: String((doc as { _id?: unknown })._id ?? projectId),
    workspaceId: wid ?? undefined,
  };
}

async function isWorkspaceActive(app: FastifyInstance, workspaceId: string): Promise<boolean> {
  const workspace = await app.mongoDb
    .collection('tz_workspaces')
    .findOne({ ...mongoPrimaryKeyFilter(workspaceId), ...activeResourceStatusFilter() } as any);
  return workspace != null;
}

async function membershipForWorkspace(
  app: FastifyInstance,
  workspaceId: string,
  identityCandidates: string[],
): Promise<WorkspaceMembership | null> {
  if (!(await isWorkspaceActive(app, workspaceId))) return null;
  const row = await app.mongoDb.collection('tz_user_workspaces').findOne({
    ...buildUserWorkspaceMembershipFilter(workspaceId, identityCandidates),
    ...activeMembershipStatusFilter(),
  } as any);
  if (row == null) return null;
  return {
    role: String((row as { role?: unknown }).role ?? ''),
    accessScope: normalizeMembershipAccessScope(row as Record<string, unknown>),
  };
}

async function hasActiveAssignmentsInWorkspace(
  app: FastifyInstance,
  workspaceId: string,
  userIdIn: unknown[],
): Promise<boolean> {
  const row = await app.mongoDb.collection('tz_workspace_user_projects').findOne({
    workspaceId,
    userId: { $in: userIdIn },
    ...activeAccessStatusFilter(),
  } as any);
  return row != null;
}

function shouldRestrictToAssignments(
  membership: WorkspaceMembership,
  hasWorkspaceAssignments: boolean,
): boolean {
  if (membership.accessScope === 'all') return false;
  if (membership.accessScope === 'assigned') return true;
  return hasWorkspaceAssignments;
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
    ...activeAccessStatusFilter(),
  } as any);
  if (directAssignment != null) {
    const wsId = normalizeToStringId((directAssignment as { workspaceId?: unknown }).workspaceId);
    const membership =
      wsId != null ? await membershipForWorkspace(app, wsId, identityCandidates) : null;
    if (membership == null) return capability === 'read';
    return allowsCapabilityForWorkspaceMember(membership.role, capability);
  }

  const homeWs = project.workspaceId;
  if (homeWs != null) {
    const homeMembership = await membershipForWorkspace(app, homeWs, identityCandidates);
    if (homeMembership != null) {
      const scopedByAssignments = shouldRestrictToAssignments(
        homeMembership,
        await hasActiveAssignmentsInWorkspace(app, homeWs, userIdIn),
      );
      if (scopedByAssignments) return false;

      const link = await app.mongoDb.collection('tz_workspace_projects').findOne({
        workspaceId: homeWs,
        projectId,
        ...activeAccessStatusFilter(),
      } as any);
      if (link != null) return allowsCapabilityForWorkspaceMember(homeMembership.role, capability);
    }
  }

  const grants = await app.mongoDb
    .collection('tz_project_access')
    .find({ project_id: projectId, ...activeAccessStatusFilter() } as any)
    .toArray();
  for (const g of grants) {
    const grantedWs = normalizeToStringId((g as { workspace_id?: unknown }).workspace_id);
    if (grantedWs == null) continue;
    const membership = await membershipForWorkspace(app, grantedWs, identityCandidates);
    if (membership == null) continue;
    const scopedByAssignments = shouldRestrictToAssignments(
      membership,
      await hasActiveAssignmentsInWorkspace(app, grantedWs, userIdIn),
    );
    if (scopedByAssignments) continue;

    const memberRole = membership.role;
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
  const assignmentIdsByWorkspace = new Map<string, Set<string>>();

  const assignments = await app.mongoDb
    .collection('tz_workspace_user_projects')
    .find({ userId: { $in: userIdIn }, ...activeAccessStatusFilter() } as any)
    .toArray();
  for (const a of assignments) {
    const pid = normalizeToStringId((a as { projectId?: unknown }).projectId);
    if (pid != null) ids.add(pid);
    const wsId = normalizeToStringId((a as { workspaceId?: unknown }).workspaceId);
    if (pid != null && wsId != null) {
      const current = assignmentIdsByWorkspace.get(wsId) ?? new Set<string>();
      current.add(pid);
      assignmentIdsByWorkspace.set(wsId, current);
    }
  }

  const memberships = await app.mongoDb
    .collection('tz_user_workspaces')
    .find({ userId: { $in: userIdIn }, ...activeMembershipStatusFilter() } as any)
    .toArray();
  for (const m of memberships) {
    const wsId = normalizeToStringId((m as { workspaceId?: unknown }).workspaceId);
    if (wsId == null) continue;
    const assignedHere = assignmentIdsByWorkspace.get(wsId);
    const membership = {
      role: String((m as { role?: unknown }).role ?? ''),
      accessScope: normalizeMembershipAccessScope(m as Record<string, unknown>),
    };
    if (shouldRestrictToAssignments(membership, (assignedHere?.size ?? 0) > 0)) {
      continue;
    }

    const links = await app.mongoDb
      .collection('tz_workspace_projects')
      .find({ workspaceId: wsId, ...activeAccessStatusFilter() } as any)
      .toArray();
    for (const l of links) {
      const pid = normalizeToStringId((l as { projectId?: unknown }).projectId);
      if (pid != null) ids.add(pid);
    }
    const grantsHere = await app.mongoDb
      .collection('tz_project_access')
      .find({ workspace_id: wsId, ...activeAccessStatusFilter() } as any)
      .toArray();
    for (const g of grantsHere) {
      const pid = normalizeToStringId((g as { project_id?: unknown }).project_id);
      if (pid != null) ids.add(pid);
    }
  }

  if (ids.size === 0) return [];
  const projects = await app.mongoDb
    .collection('tz_projects')
    .find({
      _id: { $in: expandForStringOrObjectIdIn([...ids]) },
      ...activeResourceStatusFilter(),
    } as any)
    .toArray();
  const workspaceIds = [
    ...new Set(
      projects
        .map((project) => normalizeToStringId((project as { workspaceId?: unknown }).workspaceId))
        .filter((workspaceId): workspaceId is string => workspaceId != null),
    ),
  ];
  const activeWorkspaces = new Set(
    (
      await app.mongoDb
        .collection('tz_workspaces')
        .find({
          _id: { $in: expandForStringOrObjectIdIn(workspaceIds) },
          ...activeResourceStatusFilter(),
        } as any)
        .project({ _id: 1 })
        .toArray()
    ).map((workspace) => normalizeToStringId((workspace as { _id?: unknown })._id)),
  );

  return projects
    .filter((project) => {
      const workspaceId = normalizeToStringId((project as { workspaceId?: unknown }).workspaceId);
      return workspaceId == null || activeWorkspaces.has(workspaceId);
    })
    .map((project) => normalizeToStringId((project as { _id?: unknown })._id))
    .filter((projectId): projectId is string => projectId != null);
}
