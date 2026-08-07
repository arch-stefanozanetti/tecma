import { ObjectId, type Document } from 'mongodb';
import { z } from 'zod';

import {
  buildMongoSkip,
  buildPaginationInfo,
  type PaginationParams,
} from '../../lib/pagination.js';
import {
  activeMembershipStatusFilter,
  activeResourceStatusFilter,
  buildUserWorkspaceMembershipFilter,
  expandForStringOrObjectIdIn,
  workspaceIdFieldFilter,
} from '../../lib/mongoIdentity.js';
import { resolveUserIdentityCandidates } from '../../lib/userIdentity.js';
import { isTecmaPlatformAdmin, normalizeSystemRole } from '@followup/shared-rbac';

const TZ_ENTITY_ASSIGNMENTS = 'tz_workspace_entity_assignments';

const apartmentsQuerySchema = z
  .object({
    workspaceId: z.string().min(1),
    projectIds: z.array(z.string().min(1)).min(1),
    page: z.coerce.number().int().min(1).default(1),
    perPage: z.coerce.number().int().min(1).max(100).default(25),
    searchText: z.string().optional(),
    sort: z
      .object({
        field: z.string().optional(),
        direction: z
          .union([z.literal(1), z.literal(-1), z.literal('asc'), z.literal('desc')])
          .optional(),
      })
      .optional(),
    filters: z
      .object({
        status: z.array(z.enum(['AVAILABLE', 'RESERVED', 'SOLD', 'RENTED'])).optional(),
        mode: z.array(z.enum(['RENT', 'SELL'])).optional(),
        priceMin: z.coerce.number().min(0).optional(),
        priceMax: z.coerce.number().min(0).optional(),
        surfaceMin: z.coerce.number().min(0).optional(),
        surfaceMax: z.coerce.number().min(0).optional(),
        floorMin: z.coerce.number().optional(),
        floorMax: z.coerce.number().optional(),
        tags: z.array(z.string().min(1)).optional(),
        hasPlanimetry: z.boolean().optional(),
        hasGallery: z.boolean().optional(),
        hasAdvancedData: z.boolean().optional(),
        buildingName: z.string().optional(),
        typology: z.string().optional(),
        roomsMin: z.coerce.number().min(0).optional(),
        roomsMax: z.coerce.number().min(0).optional(),
      })
      .optional(),
  })
  .strict();

export type ApartmentsQueryInput = z.infer<typeof apartmentsQuerySchema>;

const SORTABLE: Record<string, 1> = {
  code: 1,
  name: 1,
  status: 1,
  mode: 1,
  surfaceMq: 1,
  updatedAt: 1,
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const numberRange = (
  min: number | undefined,
  max: number | undefined,
): Record<string, number> | undefined => {
  const range: Record<string, number> = {};
  if (min != null) range.$gte = min;
  if (max != null) range.$lte = max;
  return Object.keys(range).length > 0 ? range : undefined;
};

const pushAnd = (match: Record<string, unknown>, condition: Record<string, unknown>): void => {
  const current = Array.isArray(match.$and) ? match.$and : [];
  match.$and = [...current, condition];
};

export type ApartmentListRow = {
  _id: string;
  workspaceId: string;
  projectId: string;
  code: string;
  name: string;
  status?: string;
  mode?: string;
  price?: number;
  deposit?: number;
  surfaceMq?: number;
  floor?: number;
  planimetryUrl?: string;
  planimetryAssetId?: string;
  tags?: string[];
  plan?: unknown;
  building?: unknown;
  sides?: unknown;
  extraInfo?: unknown;
  updatedAt?: string;
  createdAt?: string;
};

export const mapApartmentRow = (doc: Record<string, unknown>): ApartmentListRow => ({
  _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? ''),
  workspaceId: String(doc.workspaceId ?? ''),
  projectId: String(doc.projectId ?? ''),
  code: String(doc.code ?? ''),
  name: String(doc.name ?? ''),
  status: doc.status != null ? String(doc.status) : undefined,
  mode: doc.mode != null ? String(doc.mode) : undefined,
  price:
    typeof doc.price === 'number'
      ? doc.price
      : typeof (doc.rawPrice as { amount?: unknown } | undefined)?.amount === 'number'
        ? (doc.rawPrice as { amount: number }).amount
        : undefined,
  deposit: typeof doc.deposit === 'number' ? doc.deposit : undefined,
  surfaceMq: typeof doc.surfaceMq === 'number' ? doc.surfaceMq : undefined,
  floor: typeof doc.floor === 'number' ? doc.floor : undefined,
  planimetryUrl: doc.planimetryUrl != null ? String(doc.planimetryUrl) : undefined,
  planimetryAssetId: doc.planimetryAssetId != null ? String(doc.planimetryAssetId) : undefined,
  tags: Array.isArray(doc.tags) ? doc.tags.map(String) : undefined,
  plan: doc.plan,
  building: doc.building,
  sides: doc.sides,
  extraInfo: doc.extraInfo,
  updatedAt: doc.updatedAt != null ? String(doc.updatedAt) : undefined,
  createdAt: doc.createdAt != null ? String(doc.createdAt) : undefined,
});

const resolveSort = (input: ApartmentsQueryInput): { field: string; direction: 1 | -1 } => {
  const field =
    input.sort?.field != null && SORTABLE[input.sort.field] != null
      ? input.sort.field
      : 'updatedAt';
  const rawDir = input.sort?.direction;
  const direction: 1 | -1 =
    rawDir === 1 || rawDir === 'asc' ? 1 : rawDir === -1 || rawDir === 'desc' ? -1 : -1;
  return { field, direction };
};

const buildMatch = (input: ApartmentsQueryInput): Record<string, unknown> => {
  const match: Record<string, unknown> = {
    ...workspaceIdFieldFilter(input.workspaceId),
    projectId: { $in: expandForStringOrObjectIdIn(input.projectIds) },
    ...activeResourceStatusFilter(),
  };
  const status = input.filters?.status;
  if (Array.isArray(status) && status.length > 0) {
    match.status = { $in: status };
  }
  const mode = input.filters?.mode;
  if (Array.isArray(mode) && mode.length > 0) {
    match.mode = { $in: mode };
  }
  const priceRange = numberRange(input.filters?.priceMin, input.filters?.priceMax);
  if (priceRange != null) {
    pushAnd(match, {
      $or: [{ price: priceRange }, { 'rawPrice.amount': priceRange }],
    });
  }
  const surfaceRange = numberRange(input.filters?.surfaceMin, input.filters?.surfaceMax);
  if (surfaceRange != null) match.surfaceMq = surfaceRange;
  const floorRange = numberRange(input.filters?.floorMin, input.filters?.floorMax);
  if (floorRange != null) match.floor = floorRange;
  const tags = input.filters?.tags?.map((tag) => tag.trim()).filter(Boolean);
  if (tags != null && tags.length > 0) match.tags = { $in: tags };
  if (input.filters?.hasPlanimetry === true) {
    pushAnd(match, {
      $or: [
        { planimetryAssetId: { $exists: true, $ne: '' } },
        { planimetryUrl: { $exists: true, $ne: '' } },
      ],
    });
  } else if (input.filters?.hasPlanimetry === false) {
    pushAnd(match, {
      $and: [
        { $or: [{ planimetryAssetId: { $exists: false } }, { planimetryAssetId: '' }] },
        { $or: [{ planimetryUrl: { $exists: false } }, { planimetryUrl: '' }] },
      ],
    });
  }
  if (input.filters?.hasGallery === true) {
    pushAnd(match, {
      $or: [
        { 'extraInfo.galleryUrls.0': { $exists: true } },
        { 'galleryUrls.0': { $exists: true } },
      ],
    });
  } else if (input.filters?.hasGallery === false) {
    pushAnd(match, {
      $and: [
        { 'extraInfo.galleryUrls.0': { $exists: false } },
        { 'galleryUrls.0': { $exists: false } },
      ],
    });
  }
  if (input.filters?.hasAdvancedData === true) {
    pushAnd(match, {
      $or: [
        { plan: { $exists: true, $ne: null } },
        { building: { $exists: true, $ne: null } },
        { sides: { $exists: true, $ne: null } },
        { extraInfo: { $exists: true, $ne: null } },
      ],
    });
  }
  const buildingName = input.filters?.buildingName?.trim();
  if (buildingName != null && buildingName !== '') {
    const lit = escapeRegex(buildingName);
    pushAnd(match, {
      $or: [
        { 'building.name': { $regex: lit, $options: 'i' } },
        { 'building.label': { $regex: lit, $options: 'i' } },
      ],
    });
  }
  const typology = input.filters?.typology?.trim();
  if (typology != null && typology !== '') {
    const lit = escapeRegex(typology);
    pushAnd(match, {
      $or: [
        { 'plan.typology': { $regex: lit, $options: 'i' } },
        { 'plan.typology.name': { $regex: lit, $options: 'i' } },
        { 'extraInfo.typology': { $regex: lit, $options: 'i' } },
      ],
    });
  }
  const roomsRange = numberRange(input.filters?.roomsMin, input.filters?.roomsMax);
  if (roomsRange != null) {
    pushAnd(match, {
      $or: [{ 'plan.rooms': roomsRange }, { 'plan.bedrooms': roomsRange }],
    });
  }
  const search = input.searchText?.trim();
  if (search != null && search !== '') {
    const lit = escapeRegex(search);
    pushAnd(match, {
      $or: [{ name: { $regex: lit, $options: 'i' } }, { code: { $regex: lit, $options: 'i' } }],
    });
  }
  return match;
};

export type ApartmentsQueryDeps = {
  collection: {
    find: (filter: Record<string, unknown>) => {
      sort: (sort: Record<string, 1 | -1>) => {
        skip: (n: number) => {
          limit: (n: number) => { toArray: () => Promise<Record<string, unknown>[]> };
        };
      };
    };
    aggregate: (pipeline: Document[]) => { toArray: () => Promise<Record<string, unknown>[]> };
    countDocuments: (filter: Record<string, unknown>) => Promise<number>;
  };
  assignmentsCollection?: {
    find: (filter: Record<string, unknown>) => {
      toArray: () => Promise<Record<string, unknown>[]>;
    };
  };
  viewer?: { sub: string; email?: string; systemRole?: string };
  applyEntityAssignmentFilter?: boolean;
};

export const parseApartmentsQueryInput = (raw: unknown): ApartmentsQueryInput =>
  apartmentsQuerySchema.parse(raw);

export const queryApartments = async (
  deps: ApartmentsQueryDeps,
  rawInput: unknown,
): Promise<{
  data: ApartmentListRow[];
  paginationInfo: ReturnType<typeof buildPaginationInfo>;
}> => {
  const input = parseApartmentsQueryInput(rawInput);
  const match = buildMatch(input);
  const { field: sortField, direction: sortDirection } = resolveSort(input);
  const paginationParams: PaginationParams = {
    page: input.page,
    perPage: input.perPage,
    sortField,
    sortOrder: sortDirection === 1 ? 'asc' : 'desc',
  };
  const skip = buildMongoSkip(paginationParams);

  const shouldFilterAssignments =
    deps.applyEntityAssignmentFilter === true &&
    deps.viewer?.sub != null &&
    deps.assignmentsCollection != null &&
    !isTecmaPlatformAdmin(normalizeSystemRole(deps.viewer.systemRole ?? ''));

  if (shouldFilterAssignments && deps.assignmentsCollection != null && deps.viewer?.sub != null) {
    const viewerId = deps.viewer.sub;
    const pipeline: Document[] = [
      { $match: match },
      {
        $lookup: {
          from: TZ_ENTITY_ASSIGNMENTS,
          let: { aid: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                workspaceId: input.workspaceId,
                entityType: 'apartment',
                $expr: { $eq: ['$entityId', '$$aid'] },
              },
            },
          ],
          as: '__ea',
        },
      },
      {
        $match: {
          $or: [{ __ea: { $size: 0 } }, { '__ea.0.userId': viewerId }],
        },
      },
      { $sort: { [sortField]: sortDirection, _id: sortDirection } },
      { $skip: skip },
      { $limit: input.perPage },
      { $project: { __ea: 0 } },
    ];
    const countPipeline: Document[] = [
      { $match: match },
      {
        $lookup: {
          from: TZ_ENTITY_ASSIGNMENTS,
          let: { aid: { $toString: '$_id' } },
          pipeline: [
            {
              $match: {
                workspaceId: input.workspaceId,
                entityType: 'apartment',
                $expr: { $eq: ['$entityId', '$$aid'] },
              },
            },
          ],
          as: '__ea',
        },
      },
      {
        $match: {
          $or: [{ __ea: { $size: 0 } }, { '__ea.0.userId': viewerId }],
        },
      },
      { $count: 'total' },
    ];
    const [rawRows, countArr] = await Promise.all([
      deps.collection.aggregate(pipeline).toArray(),
      deps.collection.aggregate(countPipeline).toArray(),
    ]);
    const totalDocs = typeof countArr[0]?.total === 'number' ? (countArr[0].total as number) : 0;
    return {
      data: rawRows.map((row) => mapApartmentRow(row as Record<string, unknown>)),
      paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
    };
  }

  const [rawRows, totalDocs] = await Promise.all([
    deps.collection
      .find(match)
      .sort({ [sortField]: sortDirection, _id: sortDirection })
      .skip(skip)
      .limit(input.perPage)
      .toArray(),
    deps.collection.countDocuments(match),
  ]);

  return {
    data: rawRows.map((row) => mapApartmentRow(row as Record<string, unknown>)),
    paginationInfo: buildPaginationInfo(totalDocs, paginationParams),
  };
};

export const assertWorkspaceMembership = async (
  app: {
    mongoDb: { collection: (name: string) => { findOne: (filter: unknown) => Promise<unknown> } };
  },
  workspaceId: string,
  viewer: { sub: string; email?: string; systemRole?: string },
): Promise<boolean> => {
  if (isTecmaPlatformAdmin(normalizeSystemRole(viewer.systemRole ?? ''))) return true;
  const identityCandidates = await resolveUserIdentityCandidates(
    app as Parameters<typeof resolveUserIdentityCandidates>[0],
    [viewer.sub, viewer.email],
  );
  const membership = await app.mongoDb.collection('tz_user_workspaces').findOne({
    ...buildUserWorkspaceMembershipFilter(workspaceId, identityCandidates),
    ...activeMembershipStatusFilter(),
  });
  return membership != null;
};
