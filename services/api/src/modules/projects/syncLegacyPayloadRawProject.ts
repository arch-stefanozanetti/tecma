import type { MongoRepository } from '@followup/db';

import { assertJsonSize, deepMergeRawProject } from './legacyRawProjectMerge.js';
import { buildRawProjectPatchFromTzUpdate } from './projectCanonicalSync.js';

export type ProjectDocForLegacySync = Record<string, unknown> & { legacyPayload?: unknown };

/**
 * Merge profondo su `legacyPayload.rawProject` con patch top-level arbitraria (oggetti annidati deep-merge).
 * Usato da PATCH canonico e da PUT sezione dettaglio (mirror sotto una chiave dedicata).
 */
export async function syncLegacyPayloadRawProjectMergePatch(args: {
  projectsRepo: MongoRepository<ProjectDocForLegacySync>;
  projectId: string;
  activeFilter: Record<string, unknown>;
  rawNestedPatch: Record<string, unknown>;
  updatedAt?: string;
}): Promise<void> {
  const { projectsRepo, projectId, activeFilter, rawNestedPatch } = args;
  if (Object.keys(rawNestedPatch).length === 0) return;

  const projDoc = await projectsRepo.findOne({ _id: projectId, ...activeFilter } as never);
  if (projDoc == null) return;

  const legacyPayload =
    typeof projDoc.legacyPayload === 'object' && projDoc.legacyPayload !== null
      ? (projDoc.legacyPayload as Record<string, unknown>)
      : {};
  const existingRaw =
    typeof legacyPayload.rawProject === 'object' && legacyPayload.rawProject !== null
      ? (legacyPayload.rawProject as Record<string, unknown>)
      : {};
  const mergedRaw = deepMergeRawProject(existingRaw, rawNestedPatch);
  assertJsonSize(mergedRaw);
  const nextLegacyPayload = { ...legacyPayload, rawProject: mergedRaw };
  assertJsonSize(nextLegacyPayload);

  const updatedAt = args.updatedAt ?? new Date().toISOString();

  await projectsRepo.updateOne({ _id: projectId, ...activeFilter } as never, {
    $set: {
      legacyPayload: nextLegacyPayload,
      updatedAt,
    },
  });
}

/**
 * Dopo un $set su campi canonici di tz_projects, aggiorna legacyPayload.rawProject (merge profondo)
 * come nel POC, così il mirror legacy resta coerente per migrazione da DB read-only.
 */
export async function syncLegacyPayloadRawProjectAfterTzUpdate(args: {
  projectsRepo: MongoRepository<ProjectDocForLegacySync>;
  projectId: string;
  activeFilter: Record<string, unknown>;
  updateDoc: Record<string, unknown>;
}): Promise<void> {
  const rawPatch = buildRawProjectPatchFromTzUpdate(args.updateDoc);
  if (Object.keys(rawPatch).length === 0) return;

  const updatedAt =
    typeof args.updateDoc.updatedAt === 'string'
      ? args.updateDoc.updatedAt
      : new Date().toISOString();

  await syncLegacyPayloadRawProjectMergePatch({
    projectsRepo: args.projectsRepo,
    projectId: args.projectId,
    activeFilter: args.activeFilter,
    rawNestedPatch: rawPatch,
    updatedAt,
  });
}
