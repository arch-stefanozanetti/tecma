import { ObjectId } from "mongodb";
import { getDb, getDbByName } from "../../config/db.js";
import { ListQuerySchema, type ListQueryInput, buildPagination } from "../shared/list-query.js";
import { normalizePrice, type RawPrice } from "../pricing/price-normalizer.js";
import { PaginatedResponse } from "../../types/http.js";

export interface ApartmentRow {
  _id: string;
  workspaceId: string;
  projectId: string;
  code: string;
  name: string;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED";
  mode: "RENT" | "SELL";
  surfaceMq: number;
  rawPrice: RawPrice;
  updatedAt: string;
}

export interface ApartmentListRow extends Omit<ApartmentRow, "rawPrice"> {
  normalizedPrice: ReturnType<typeof normalizePrice>;
}

const buildMatch = (q: ListQueryInput) => {
  const match: Record<string, unknown> = {
    workspaceId: q.workspaceId,
    projectId: { $in: q.projectIds }
  };

  const status = q.filters?.status;
  if (Array.isArray(status) && status.length > 0) {
    match.status = { $in: status };
  }

  const mode = q.filters?.mode;
  if (Array.isArray(mode) && mode.length > 0) {
    match.mode = { $in: mode };
  }

  if (q.searchText && q.searchText.trim()) {
    const safe = q.searchText.trim();
    match.$or = [
      { name: { $regex: safe, $options: "i" } },
      { code: { $regex: safe, $options: "i" } }
    ];
  }

  return match;
};

const sortable: Record<string, 1> = {
  code: 1,
  name: 1,
  status: 1,
  mode: 1,
  surfaceMq: 1,
  updatedAt: 1
};

type LegacyAvailability = {
  value?: string;
};

type LegacyApartmentDoc = {
  _id?: ObjectId | string;
  project_id?: ObjectId | string;
  code?: string;
  name?: string;
  status?: string;
  availability?: LegacyAvailability;
  available?: boolean;
  spaceType?: string;
  price?: number;
  floor?: number;
  updatedOn?: Date | string;
  createdOn?: Date | string;
  plan?: {
    surfaceArea?: {
      total?: number;
      commercial?: number;
      apartment?: number;
    };
  };
};

const parseProjectIdsForLegacy = (projectIds: string[]) => {
  const objectIds: ObjectId[] = [];
  const asStrings = new Set<string>();
  for (const projectId of projectIds) {
    asStrings.add(projectId);
    if (ObjectId.isValid(projectId)) objectIds.push(new ObjectId(projectId));
  }
  return { objectIds, asStrings: [...asStrings] };
};

const normalizeLegacyStatus = (status?: string, availability?: LegacyAvailability): ApartmentRow["status"] => {
  const normalized = String(status || "").toLowerCase();
  const availabilityValue = String(availability?.value || "").toUpperCase();

  if (normalized === "rogitato") return "SOLD";
  if (normalized === "locato") return "RENTED";
  if (availabilityValue === "AVAILABLE" || normalized === "libero") return "AVAILABLE";
  return "RESERVED";
};

const resolveSurface = (doc: LegacyApartmentDoc): number => {
  const total = doc.plan?.surfaceArea?.total;
  const commercial = doc.plan?.surfaceArea?.commercial;
  const apartment = doc.plan?.surfaceArea?.apartment;
  if (typeof total === "number" && total > 0) return total;
  if (typeof commercial === "number" && commercial > 0) return commercial;
  if (typeof apartment === "number" && apartment > 0) return apartment;
  return 0;
};

const inferListingMode = (doc: LegacyApartmentDoc): ApartmentRow["mode"] => {
  const status = String(doc.status || "").toLowerCase();
  if (status.includes("loca") || status.includes("affit")) return "RENT";
  return "SELL";
};

const toIsoDate = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

const buildLegacyMatch = (q: ListQueryInput) => {
  const { objectIds, asStrings } = parseProjectIdsForLegacy(q.projectIds);
  const projectConditionValues: Array<ObjectId | string> = [...objectIds, ...asStrings];
  const conditions: Record<string, unknown>[] = [{ project_id: { $in: projectConditionValues } }];

  const status = q.filters?.status;
  if (Array.isArray(status) && status.length > 0) {
    const requested = new Set(status.map((s) => String(s).toUpperCase()));
    const legacyStatuses: string[] = [];
    if (requested.has("AVAILABLE")) legacyStatuses.push("libero");
    if (requested.has("RESERVED")) legacyStatuses.push("proposta", "interesse", "opzionato", "compromesso");
    if (requested.has("SOLD")) legacyStatuses.push("rogitato");
    if (requested.has("RENTED")) legacyStatuses.push("locato", "affittato");
    conditions.push({ status: { $in: legacyStatuses } });
  }

  const mode = q.filters?.mode;
  if (Array.isArray(mode) && mode.length > 0) {
    const normalized = new Set(mode.map((item) => String(item).toUpperCase()));
    if (normalized.has("SELL") && !normalized.has("RENT")) {
      conditions.push({ status: { $nin: ["locato", "affittato"] } });
    }
    if (!normalized.has("SELL") && normalized.has("RENT")) {
      conditions.push({ status: { $in: ["locato", "affittato"] } });
    }
  }

  if (q.searchText && q.searchText.trim()) {
    const safe = q.searchText.trim();
    conditions.push({
      $or: [
        { name: { $regex: safe, $options: "i" } },
        { code: { $regex: safe, $options: "i" } }
      ]
    });
  }

  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
};

const legacySortFieldByInput: Record<string, string> = {
  code: "code",
  name: "name",
  status: "status",
  mode: "status",
  surfaceMq: "plan.surfaceArea.total",
  updatedAt: "updatedOn"
};

const mapLegacyToListRow = (doc: LegacyApartmentDoc): ApartmentListRow => {
  const mode = inferListingMode(doc);
  const amount = typeof doc.price === "number" ? doc.price : 0;
  const rawPrice: RawPrice = {
    mode,
    amount,
    currency: "EUR",
    cadence: mode === "RENT" ? "MONTH" : undefined
  };
  const projectId = doc.project_id instanceof ObjectId ? doc.project_id.toHexString() : typeof doc.project_id === "string" ? doc.project_id : "";

  return {
    _id: String(doc._id ?? ""),
    workspaceId: "legacy",
    projectId,
    code: typeof doc.code === "string" && doc.code.trim() ? doc.code : "-",
    name: typeof doc.name === "string" && doc.name.trim() ? doc.name : "-",
    status: normalizeLegacyStatus(doc.status, doc.availability),
    mode,
    surfaceMq: resolveSurface(doc),
    updatedAt: toIsoDate(doc.updatedOn ?? doc.createdOn),
    normalizedPrice: normalizePrice(rawPrice)
  };
};

const queryPrimaryApartments = async (input: ListQueryInput): Promise<PaginatedResponse<ApartmentListRow>> => {
  const db = getDb();
  const collection = db.collection<ApartmentRow>("apartments");

  const match = buildMatch(input);
  const { page, perPage } = input;
  const { skip, limit } = buildPagination(page, perPage);

  const sortField = input.sort?.field && sortable[input.sort.field] ? input.sort.field : "updatedAt";
  const sortDirection = input.sort?.direction ?? -1;

  const [rawData, total] = await Promise.all([
    collection
      .find(match)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit)
      .toArray(),
    collection.countDocuments(match)
  ]);

  const data: ApartmentListRow[] = rawData.map(({ rawPrice, ...rest }) => ({
    ...rest,
    normalizedPrice: normalizePrice(rawPrice)
  }));

  return {
    data,
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage)
    }
  };
};

const queryLegacyApartments = async (input: ListQueryInput): Promise<PaginatedResponse<ApartmentListRow>> => {
  const db = getDbByName("asset");
  const collection = db.collection<LegacyApartmentDoc>("apartments_view");

  const match = buildLegacyMatch(input);
  const { page, perPage } = input;
  const { skip, limit } = buildPagination(page, perPage);
  const sortField = input.sort?.field && sortable[input.sort.field] ? legacySortFieldByInput[input.sort.field] : "updatedOn";
  const sortDirection = input.sort?.direction ?? -1;

  const [rawData, total] = await Promise.all([
    collection
      .find(match)
      .sort({ [sortField]: sortDirection })
      .skip(skip)
      .limit(limit)
      .project({
        _id: 1,
        project_id: 1,
        code: 1,
        name: 1,
        status: 1,
        availability: 1,
        available: 1,
        spaceType: 1,
        price: 1,
        floor: 1,
        plan: 1,
        updatedOn: 1,
        createdOn: 1
      })
      .toArray(),
    collection.countDocuments(match)
  ]);

  return {
    data: rawData.map(mapLegacyToListRow),
    pagination: {
      page,
      perPage,
      total,
      totalPages: Math.ceil(total / perPage)
    }
  };
};

export const queryApartments = async (rawInput: unknown): Promise<PaginatedResponse<ApartmentListRow>> => {
  const input = ListQuerySchema.parse(rawInput);
  const primary = await queryPrimaryApartments(input);
  if (primary.pagination.total > 0) return primary;
  return queryLegacyApartments(input);
};
