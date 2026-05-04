import type { MongoRepository } from '@followup/db';

import type { FastifyInstance } from 'fastify';

import {
  expandForStringOrObjectIdIn,
  workspaceIdFieldFilter,
} from '../../lib/mongoIdentity.js';

import { pickProjectIdsAfterFallback } from './pickProjectIdsAfterFallback.js';

export type WorkspaceScopedProjectsDeps = {
  app: FastifyInstance;
  workspaceUserProjectsRepo: MongoRepository<any>;
  workspaceProjectsRepo: MongoRepository<any>;
  projectsRepo: MongoRepository<any>;
};

/**
 * Elenco documenti progetto per GET /v1/projects?workspaceId=… (stesso comportamento precedente alla refactor).
 */
export async function fetchProjectsForWorkspaceScopedList(
  deps: WorkspaceScopedProjectsDeps,
  args: {
    workspaceId: string;
    identityList: string[];
    isTecmaAdmin: boolean;
  },
): Promise<unknown[]> {
  const userIdIn = expandForStringOrObjectIdIn(args.identityList);
  const wsFilter = workspaceIdFieldFilter(args.workspaceId);

  const assignments = await deps.workspaceUserProjectsRepo.findMany({
    ...wsFilter,
    userId: { $in: userIdIn } as any,
  });

  const assignmentIds = assignments
    .map((row: { projectId?: string }) => row.projectId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);

  let workspaceLinkIds: string[] = [];
  let fallbackAllowed = false;

  if (assignmentIds.length === 0) {
    const membership = await deps.app.mongoDb
      .collection('tz_user_workspaces')
      .findOne({
        ...wsFilter,
        userId: { $in: userIdIn },
      } as any);
    fallbackAllowed = args.isTecmaAdmin || membership != null;
    if (fallbackAllowed) {
      const wsProjectLinks = await deps.workspaceProjectsRepo.findMany({
        ...wsFilter,
      } as any);
      workspaceLinkIds = wsProjectLinks
        .map((row: { projectId?: string }) => row.projectId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);
    }
  }

  const dedupedProjectIds = pickProjectIdsAfterFallback({
    assignmentIds,
    fallbackAllowed,
    workspaceLinkIds,
  });

  if (dedupedProjectIds.length === 0) {
    return [];
  }

  return deps.projectsRepo.findMany({ _id: { $in: dedupedProjectIds } as any });
}
