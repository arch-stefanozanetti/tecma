import type { MongoRepository } from '@followup/db';

import {
  syncLegacyPayloadRawProjectMergePatch,
  type ProjectDocForLegacySync,
} from './syncLegacyPayloadRawProject.js';

/** Stesso filtro liste template in `detailRoutes` (soft-delete). */
const TEMPLATE_ACTIVE_FILTER = { status: { $ne: 'deleted' } } as const;

type AnyDocRepo = MongoRepository<Record<string, unknown>>;

const readString = (row: Record<string, unknown>, key: string): unknown => row[key];

/**
 * Sostituisce in `legacyPayload.rawProject['email-templates']` lo snapshot ordinato
 * di tutti i template email attivi del progetto (allineato alla lista API).
 */
export async function mirrorProjectEmailTemplatesInLegacyRaw(args: {
  projectsRepo: MongoRepository<ProjectDocForLegacySync>;
  emailTemplatesRepo: AnyDocRepo;
  projectId: string;
  activeFilter: Record<string, unknown>;
  updatedAt?: string;
}): Promise<void> {
  const docs = await args.emailTemplatesRepo.findMany({
    projectId: args.projectId,
    ...TEMPLATE_ACTIVE_FILTER,
  } as never);
  const sorted = [...docs].sort((a, b) =>
    String(readString(a, 'name') ?? '').localeCompare(String(readString(b, 'name') ?? '')),
  );
  const snapshot = sorted.map((row) => ({
    _id: row._id,
    name: row.name,
    subject: row.subject,
    htmlBody: row.htmlBody,
    textBody: row.textBody,
    placeholders: row.placeholders,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
  await syncLegacyPayloadRawProjectMergePatch({
    projectsRepo: args.projectsRepo,
    projectId: args.projectId,
    activeFilter: args.activeFilter,
    rawNestedPatch: { 'email-templates': snapshot },
    updatedAt: args.updatedAt,
  });
}

/**
 * Sostituisce in `legacyPayload.rawProject['pdf-templates']` lo snapshot ordinato
 * di tutti i template PDF attivi del progetto.
 */
export async function mirrorProjectPdfTemplatesInLegacyRaw(args: {
  projectsRepo: MongoRepository<ProjectDocForLegacySync>;
  pdfTemplatesRepo: AnyDocRepo;
  projectId: string;
  activeFilter: Record<string, unknown>;
  updatedAt?: string;
}): Promise<void> {
  const docs = await args.pdfTemplatesRepo.findMany({
    projectId: args.projectId,
    ...TEMPLATE_ACTIVE_FILTER,
  } as never);
  const sorted = [...docs].sort((a, b) =>
    String(readString(a, 'templateKey') ?? '').localeCompare(
      String(readString(b, 'templateKey') ?? ''),
    ),
  );
  const snapshot = sorted.map((row) => ({
    _id: row._id,
    templateKey: row.templateKey,
    name: row.name,
    htmlBody: row.htmlBody,
    pageOrientation: row.pageOrientation,
    pageSize: row.pageSize,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
  await syncLegacyPayloadRawProjectMergePatch({
    projectsRepo: args.projectsRepo,
    projectId: args.projectId,
    activeFilter: args.activeFilter,
    rawNestedPatch: { 'pdf-templates': snapshot },
    updatedAt: args.updatedAt,
  });
}
