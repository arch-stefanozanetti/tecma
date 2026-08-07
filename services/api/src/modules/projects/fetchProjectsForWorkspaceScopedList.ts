import type { MongoRepository } from '@followup/db';

import type { FastifyInstance } from 'fastify';

import {
  activeAccessStatusFilter,
  activeMembershipStatusFilter,
  activeResourceStatusFilter,
  expandForStringOrObjectIdIn,
  normalizeToStringId,
  workspaceIdFieldFilter,
} from '../../lib/mongoIdentity.js';

import { pickProjectIdsAfterFallback } from './pickProjectIdsAfterFallback.js';

export type ProjectDocument = {
  _id: string;
  workspaceId?: unknown;
  workspace_id?: unknown;
  displayName?: string;
  name?: string;
  code?: string;
  mode?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  defaultLang?: string;
  hostKey?: string;
  assetKey?: string;
  feVendorKey?: string;
  automaticQuoteEnabled?: boolean;
  accountManagerEnabled?: boolean;
  hasDAS?: boolean;
  contactEmail?: string;
  contactPhone?: string;
  projectUrl?: string;
  customDomain?: string;
  city?: string;
  payoff?: string;
  broker?: string | null;
  iban?: string;
  legacyPayload?: unknown;
};

export type WorkspaceProjectDocument = {
  _id: string;
  workspaceId?: unknown;
  workspace_id?: unknown;
  projectId?: string;
  project_id?: unknown;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
};

export type WorkspaceUserProjectDocument = {
  _id: string;
  workspaceId?: unknown;
  status?: string;
  userId?: unknown;
  projectId?: string;
  workspace_id?: unknown;
  createdAt?: string;
  updatedAt?: string;
};

type WorkspaceMembershipDocument = {
  role?: unknown;
  accessScope?: unknown;
  access_scope?: unknown;
};

export type WorkspaceScopedProjectsDeps = {
  app: FastifyInstance;
  workspaceUserProjectsRepo: MongoRepository<WorkspaceUserProjectDocument>;
  workspaceProjectsRepo: MongoRepository<WorkspaceProjectDocument>;
  projectsRepo: MongoRepository<ProjectDocument>;
};

function normalizeMembershipAccessScope(
  row: WorkspaceMembershipDocument | null,
): 'all' | 'assigned' | null {
  if (row == null) return null;
  const explicit = String(row.accessScope ?? '').toLowerCase();
  if (explicit === 'all' || explicit === 'assigned') return explicit;

  const legacy = String(row.access_scope ?? '').toLowerCase();
  if (legacy === 'workspace' || legacy === 'all') return 'all';
  if (legacy === 'assigned') return 'assigned';

  return null;
}

function shouldRestrictToAssignments(
  membership: WorkspaceMembershipDocument | null,
  assignmentIds: string[],
): boolean {
  const scope = normalizeMembershipAccessScope(membership);
  if (scope === 'all') return false;
  if (scope === 'assigned') return true;
  return assignmentIds.length > 0;
}

/**
 * Elenco documenti progetto per GET /v1/projects?workspaceId=… (stesso comportamento precedente alla refactor).
 */
export async function fetchProjectsForWorkspaceScopedList(
  deps: WorkspaceScopedProjectsDeps,
  args: {
    workspaceId: string;
    identityList: string[];
    isTecmaAdmin: boolean;
    projectStatusFilter?: Record<string, unknown>;
  },
): Promise<ProjectDocument[]> {
  const userIdIn = expandForStringOrObjectIdIn(args.identityList);
  const wsFilter = workspaceIdFieldFilter(args.workspaceId);
  const projectStatusFilter = args.projectStatusFilter ?? activeResourceStatusFilter();

  /**
   * Tecma platform admin: catalogo completo del workspace (link workspace↔progetto, grant,
   * progetti con `workspaceId` sul documento, più eventuali assegnazioni dirette).
   * Evita il bug per cui con assegnazioni utente non vuote si nascondevano gli altri progetti
   * dello stesso workspace (`pickProjectIdsAfterFallback` restituiva solo gli assignment).
   */
  if (args.isTecmaAdmin) {
    const wsKey = wsFilter as { workspaceId?: unknown };

    const wsProjectLinks = await deps.workspaceProjectsRepo.findMany({
      ...wsFilter,
      ...activeAccessStatusFilter(),
    } as any);
    const fromLinks = wsProjectLinks
      .map((row: { projectId?: string }) => row.projectId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const grantRows = await deps.app.mongoDb
      .collection('tz_project_access')
      .find({
        workspace_id: wsKey.workspaceId,
        ...activeAccessStatusFilter(),
      } as any)
      .project({ project_id: 1 })
      .toArray();
    const fromGrants: string[] = [];
    for (const row of grantRows) {
      const pid = normalizeToStringId((row as { project_id?: unknown }).project_id);
      if (pid != null) fromGrants.push(pid);
    }

    const assignments = await deps.workspaceUserProjectsRepo.findMany({
      ...wsFilter,
      userId: { $in: userIdIn } as any,
      ...activeAccessStatusFilter(),
    });
    const fromAssign = assignments
      .map((row: { projectId?: string }) => row.projectId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);

    const directProjects = await deps.projectsRepo.findMany({
      ...wsFilter,
      ...projectStatusFilter,
    } as any);
    const fromDirect = directProjects
      .map((row: { _id?: unknown }) => normalizeToStringId(row._id))
      .filter((id): id is string => id != null && id.length > 0);

    const idSet = new Set<string>([...fromLinks, ...fromGrants, ...fromAssign, ...fromDirect]);
    const mergedIds = [...idSet];
    if (mergedIds.length === 0) {
      return [];
    }

    return deps.projectsRepo.findMany({
      _id: { $in: mergedIds } as any,
      ...projectStatusFilter,
    });
  }

  const assignments = await deps.workspaceUserProjectsRepo.findMany({
    ...wsFilter,
    userId: { $in: userIdIn } as any,
    ...activeAccessStatusFilter(),
  });

  const assignmentIds = assignments
    .map((row: { projectId?: string }) => row.projectId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  let workspaceLinkIds: string[] = [];
  let fallbackAllowed = false;

  const membership = (await deps.app.mongoDb.collection('tz_user_workspaces').findOne({
    ...wsFilter,
    userId: { $in: userIdIn },
    ...activeMembershipStatusFilter(),
  } as any)) as WorkspaceMembershipDocument | null;
  const restrictToAssignments = shouldRestrictToAssignments(membership, assignmentIds);
  fallbackAllowed = args.isTecmaAdmin || membership != null;
  if (fallbackAllowed && !restrictToAssignments) {
    const wsProjectLinks = await deps.workspaceProjectsRepo.findMany({
      ...wsFilter,
      ...activeAccessStatusFilter(),
    } as any);
    workspaceLinkIds = wsProjectLinks
      .map((row: { projectId?: string }) => row.projectId)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
  }

  const dedupedProjectIds = pickProjectIdsAfterFallback({
    assignmentIds,
    fallbackAllowed,
    workspaceLinkIds,
  });

  const idSet = new Set(dedupedProjectIds);
  const wsKey = workspaceIdFieldFilter(args.workspaceId) as { workspaceId: unknown };
  if (!restrictToAssignments) {
    const grantRows = await deps.app.mongoDb
      .collection('tz_project_access')
      .find({
        workspace_id: wsKey.workspaceId,
        ...activeAccessStatusFilter(),
      } as any)
      .project({ project_id: 1 })
      .toArray();
    for (const row of grantRows) {
      const pid = normalizeToStringId((row as { project_id?: unknown }).project_id);
      if (pid != null) idSet.add(pid);
    }
  }

  const mergedIds = [...idSet];
  if (mergedIds.length === 0) {
    return [];
  }

  return deps.projectsRepo.findMany({
    _id: { $in: mergedIds } as any,
    ...projectStatusFilter,
  });
}
