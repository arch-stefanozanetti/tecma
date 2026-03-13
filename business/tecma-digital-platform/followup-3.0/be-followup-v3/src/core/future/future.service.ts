import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { ListQuerySchema, buildPagination } from "../shared/list-query.js";
import { emitDomainEvent } from "../events/event-log.service.js";

const HCMasterEntitySchema = z.enum(["section", "mood", "finish", "specification", "optional"]);

const ObjectIdLikeSchema = z.string().min(1);

const ApartmentCreateSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
  price: z.number().nonnegative(),
  floor: z.number().int(),
  mode: z.enum(["RENT", "SELL"]).default("SELL"),
  status: z.enum(["AVAILABLE", "RESERVED", "SOLD", "RENTED"]).default("AVAILABLE"),
  surfaceMq: z.number().nonnegative().default(0),
  planimetryUrl: z.string().min(1)
});

const ApartmentUpdateSchema = ApartmentCreateSchema.partial().extend({
  apartmentId: ObjectIdLikeSchema
});

const HCApartmentUpsertSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  apartmentId: z.string().min(1),
  selectedSectionCodes: z.array(z.string()).default([]),
  selectedSectionIds: z.array(z.string()).default([]),
  formValues: z.record(z.number()).default({}),
  finishesPrices: z
    .array(
      z.object({
        id: z.string(),
        price: z.number(),
        code: z.string().optional()
      })
    )
    .default([]),
  legacyIncomplete: z.boolean().default(false)
});

const AssociationCreateSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  apartmentId: z.string().min(1),
  clientId: z.string().min(1),
  status: z.enum(["proposta", "compromesso", "rogito"]).default("proposta"),
  forceDowngrade: z.boolean().optional().default(false)
});

const CompleteFlowPreviewSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  apartment: ApartmentCreateSchema.omit({ workspaceId: true, projectId: true }),
  hc: HCApartmentUpsertSchema.omit({ workspaceId: true, projectId: true }),
  association: AssociationCreateSchema.omit({ workspaceId: true, projectId: true })
});

const HCMasterUpsertSchema = z.object({
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  relatedIds: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({})
});

const TemplateSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        fields: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            type: z.enum(["number", "text", "select", "multiselect"]).default("number"),
            required: z.boolean().optional().default(false)
          })
        )
      })
    )
    .default([])
});

type RawApartment = {
  _id: ObjectId;
  workspaceId: string;
  projectId: string;
  code: string;
  name: string;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "RENTED";
  mode: "RENT" | "SELL";
  surfaceMq: number;
  rawPrice: { mode: "RENT" | "SELL"; amount: number };
  planimetryUrl: string;
  updatedAt: string;
  createdAt: string;
};

const getAssociationsCollection = () => getDb().collection("tz_apartment_client_associations");
const getHCApartmentsCollection = () => getDb().collection("tz_hc_apartments");
const getTemplatesCollection = () => getDb().collection("tz_configuration_templates");
const getWorkflowsCollection = () => getDb().collection("tz_complete_flow_runs");

const getHCMasterCollection = (entity: z.infer<typeof HCMasterEntitySchema>) =>
  getDb().collection(`tz_hc_master_${entity}s`);

const toObjectId = (value: string): ObjectId => {
  if (!ObjectId.isValid(value)) {
    throw new Error(`Invalid ObjectId: ${value}`);
  }
  return new ObjectId(value);
};

const mapApartment = (apartment: RawApartment) => ({
  _id: apartment._id.toHexString(),
  workspaceId: apartment.workspaceId,
  projectId: apartment.projectId,
  code: apartment.code,
  name: apartment.name,
  status: apartment.status,
  mode: apartment.mode,
  surfaceMq: apartment.surfaceMq,
  rawPrice: apartment.rawPrice,
  planimetryUrl: apartment.planimetryUrl,
  updatedAt: apartment.updatedAt,
  createdAt: apartment.createdAt
});

type LegacyPlanTypology = { _id?: ObjectId; name?: string };
type LegacyPlanModel = { _id?: ObjectId; name?: string };
type LegacyPlanDimension = { _id?: ObjectId; name?: string };
type LegacyPlanMainFeatures = { rooms?: number; bathroom?: number; bedroom?: number; openPlanKitchen?: boolean };
type LegacyPlanSurfaceArea = {
  total?: number;
  commercial?: number;
  apartment?: number;
  balcony?: number;
  garden?: number;
  loggia?: number;
  terrace?: number;
  penthouse?: number;
};
type LegacyBuilding = {
  _id?: ObjectId;
  name?: string;
  address?: string | null;
  floors?: number;
  code?: string;
  zone?: string | null;
  complex?: string;
  geo?: { lat?: number; lon?: number };
};
type LegacySide = { _id?: ObjectId; name?: string };

type LegacyApartmentDoc = {
  _id?: ObjectId | unknown;
  project_id?: ObjectId | string;
  code?: string;
  name?: string;
  status?: string;
  availability?: { value?: string; interestCount?: number; relatedClientId?: ObjectId | null; relatedMovementId?: ObjectId | null };
  price?: number;
  floor?: number;
  updatedOn?: Date | string;
  createdOn?: Date | string;
  plan?: {
    _id?: ObjectId;
    name?: string;
    typology?: LegacyPlanTypology;
    model?: LegacyPlanModel;
    dimension?: LegacyPlanDimension;
    surfaceArea?: LegacyPlanSurfaceArea;
    mainFeatures?: LegacyPlanMainFeatures;
  };
  building?: LegacyBuilding;
  sides?: LegacySide[];
  extraInfo?: Record<string, unknown>;
};

const LEGACY_DB_ASSET = "asset";
const LEGACY_APARTMENTS_VIEW = "apartments_view";

const toIsoDateLegacy = (value: unknown): string => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
};

const normalizeLegacyStatus = (status?: string, availability?: { value?: string }): RawApartment["status"] => {
  const normalized = String(status || "").toLowerCase();
  const availabilityValue = String(availability?.value || "").toUpperCase();
  if (normalized === "rogitato") return "SOLD";
  if (normalized === "locato") return "RENTED";
  if (availabilityValue === "AVAILABLE" || normalized === "libero") return "AVAILABLE";
  return "RESERVED";
};

const resolveSurface = (doc: LegacyApartmentDoc): number => {
  const sa = doc.plan?.surfaceArea;
  if (!sa) return 0;
  const total = sa.total;
  const commercial = sa.commercial;
  const apartment = sa.apartment;
  if (typeof total === "number" && total > 0) return total;
  if (typeof commercial === "number" && commercial > 0) return commercial;
  if (typeof apartment === "number" && apartment > 0) return apartment;
  return 0;
};

const inferListingMode = (doc: LegacyApartmentDoc): RawApartment["mode"] => {
  const status = String(doc.status || "").toLowerCase();
  if (status.includes("loca") || status.includes("affit")) return "RENT";
  return "SELL";
};

const mapLegacyApartmentToDetail = (doc: LegacyApartmentDoc): ReturnType<typeof mapApartment> & {
  plan?: LegacyApartmentDoc["plan"];
  building?: LegacyBuilding;
  sides?: LegacySide[];
  floor?: number;
  extraInfo?: Record<string, unknown>;
} => {
  const mode = inferListingMode(doc);
  const amount = typeof doc.price === "number" ? doc.price : 0;
  const projectId =
    doc.project_id instanceof ObjectId ? doc.project_id.toHexString() : typeof doc.project_id === "string" ? doc.project_id : "";
  const updatedAt = toIsoDateLegacy(doc.updatedOn ?? doc.createdOn);
  const base = {
    _id: doc._id instanceof ObjectId ? doc._id.toHexString() : String(doc._id ?? ""),
    workspaceId: "legacy",
    projectId,
    code: typeof doc.code === "string" && doc.code.trim() ? doc.code : "-",
    name: typeof doc.name === "string" && doc.name.trim() ? doc.name : "-",
    status: normalizeLegacyStatus(doc.status, doc.availability),
    mode,
    surfaceMq: resolveSurface(doc),
    rawPrice: { mode, amount },
    planimetryUrl: "",
    updatedAt,
    createdAt: toIsoDateLegacy(doc.createdOn)
  };
  const enriched = { ...base };
  if (doc.plan && typeof doc.plan === "object") (enriched as Record<string, unknown>).plan = doc.plan;
  if (doc.building && typeof doc.building === "object") (enriched as Record<string, unknown>).building = doc.building;
  if (Array.isArray(doc.sides)) (enriched as Record<string, unknown>).sides = doc.sides;
  if (typeof doc.floor === "number") (enriched as Record<string, unknown>).floor = doc.floor;
  if (doc.extraInfo && typeof doc.extraInfo === "object") (enriched as Record<string, unknown>).extraInfo = doc.extraInfo;
  return enriched;
};

export const createApartment = async (rawInput: unknown) => {
  const input = ApartmentCreateSchema.parse(rawInput);
  const db = getDb();
  const collection = db.collection<RawApartment>(TZ_APARTMENTS_COLLECTION);

  const duplicate = await collection.findOne({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    name: { $regex: `^${input.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" }
  });
  if (duplicate) {
    const error = new Error("Apartment name already exists for project");
    (error as Error & { statusCode?: number }).statusCode = 409;
    throw error;
  }

  const now = new Date().toISOString();
  const doc: Omit<RawApartment, "_id"> = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    code: input.code,
    name: input.name,
    status: input.status,
    mode: input.mode,
    surfaceMq: input.surfaceMq,
    rawPrice: { mode: input.mode, amount: input.price },
    planimetryUrl: input.planimetryUrl,
    updatedAt: now,
    createdAt: now
  };
  const insertedId = new ObjectId();
  await collection.insertOne({ _id: insertedId, ...doc });
  const apartmentId = insertedId.toHexString();
  await emitDomainEvent({
    type: "apartment.created",
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    entityId: apartmentId,
    payload: { code: input.code, name: input.name, mode: input.mode, status: input.status }
  });
  return { apartmentId: insertedId.toHexString(), apartment: mapApartment({ _id: insertedId, ...doc }) };
};

export const updateApartment = async (rawInput: unknown) => {
  const input = ApartmentUpdateSchema.parse(rawInput);
  const collection = getDb().collection<RawApartment>(TZ_APARTMENTS_COLLECTION);
  const apartmentId = toObjectId(input.apartmentId);

  const updateDoc: Record<string, unknown> = {
    updatedAt: new Date().toISOString()
  };
  if (input.name !== undefined) updateDoc.name = input.name;
  if (input.code !== undefined) updateDoc.code = input.code;
  if (input.status !== undefined) updateDoc.status = input.status;
  if (input.mode !== undefined) updateDoc.mode = input.mode;
  if (input.surfaceMq !== undefined) updateDoc.surfaceMq = input.surfaceMq;
  if (input.planimetryUrl !== undefined) updateDoc.planimetryUrl = input.planimetryUrl;
  if (input.price !== undefined || input.mode !== undefined) {
    const existing = await collection.findOne({ _id: apartmentId });
    if (!existing) {
      const notFoundError = new Error("Apartment not found");
      (notFoundError as Error & { statusCode?: number }).statusCode = 404;
      throw notFoundError;
    }
    updateDoc.rawPrice = {
      mode: input.mode ?? existing.mode,
      amount: input.price ?? existing.rawPrice.amount
    };
  }

  const current = await collection.findOne({ _id: apartmentId });
  if (!current) {
    const notFoundError = new Error("Apartment not found");
    (notFoundError as Error & { statusCode?: number }).statusCode = 404;
    throw notFoundError;
  }

  const next = {
    ...current,
    ...(updateDoc as Partial<RawApartment>)
  };

  await collection.updateOne({ _id: apartmentId }, { $set: updateDoc });
  const updated = await collection.findOne({ _id: apartmentId });
  if (!updated) {
    const notFoundError = new Error("Apartment not found");
    (notFoundError as Error & { statusCode?: number }).statusCode = 404;
    throw notFoundError;
  }

  return { apartment: mapApartment(updated) };
};

const TZ_APARTMENTS_COLLECTION = "tz_apartments";

export const getApartmentById = async (rawApartmentId: unknown) => {
  const apartmentId = toObjectId(z.string().parse(rawApartmentId));
  const db = getDb();
  const tzDoc = await db.collection(TZ_APARTMENTS_COLLECTION).findOne({ _id: apartmentId });
  if (tzDoc) {
    const d = tzDoc as Record<string, unknown>;
    const rawPrice = (d.rawPrice as { mode?: string; amount?: number }) ?? {};
    const apartment = mapApartment({
      _id: apartmentId,
      workspaceId: String(d.workspaceId ?? ""),
      projectId: String(d.projectId ?? ""),
      code: String(d.code ?? ""),
      name: String(d.name ?? ""),
      status: (d.status as RawApartment["status"]) ?? "AVAILABLE",
      mode: (d.mode as RawApartment["mode"]) ?? "SELL",
      surfaceMq: Number(d.surfaceMq) || 0,
      rawPrice: { mode: (rawPrice.mode as "RENT" | "SELL") ?? "SELL", amount: Number(rawPrice.amount) || 0 },
      planimetryUrl: String(d.planimetryUrl ?? ""),
      updatedAt: String(d.updatedAt ?? ""),
      createdAt: String(d.createdAt ?? d.updatedAt ?? "")
    });
    return { apartment };
  }
  const primary = await db.collection<RawApartment>("apartments").findOne({ _id: apartmentId });
  if (primary) return { apartment: mapApartment(primary) };
  const legacyDoc = await db.collection<LegacyApartmentDoc>(LEGACY_APARTMENTS_VIEW).findOne({ _id: apartmentId });
  if (!legacyDoc) {
    const notFoundError = new Error("Apartment not found");
    (notFoundError as Error & { statusCode?: number }).statusCode = 404;
    throw notFoundError;
  }
  return { apartment: mapLegacyApartmentToDetail(legacyDoc) };
};

export const upsertHCApartment = async (rawInput: unknown) => {
  const input = HCApartmentUpsertSchema.parse(rawInput);
  const collection = getHCApartmentsCollection();
  const now = new Date().toISOString();
  const existing = await collection.findOne({ workspaceId: input.workspaceId, projectId: input.projectId, apartmentId: input.apartmentId });
  const createdAt = typeof existing?.createdAt === "string" ? existing.createdAt : now;
  await collection.updateOne(
    { workspaceId: input.workspaceId, projectId: input.projectId, apartmentId: input.apartmentId },
    {
      $set: { ...input, updatedAt: now },
      $setOnInsert: { createdAt: now }
    },
    { upsert: true }
  );
  const result = await collection.findOne({ workspaceId: input.workspaceId, projectId: input.projectId, apartmentId: input.apartmentId });
  await emitDomainEvent({
    type: "hc.apartment.upserted",
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    entityId: input.apartmentId,
    payload: {
      selectedSectionCodes: input.selectedSectionCodes,
      selectedSectionIds: input.selectedSectionIds,
      fieldsCount: Object.keys(input.formValues).length
    }
  });
  return { config: result };
};

export const getHCApartment = async (rawApartmentId: unknown) => {
  const apartmentId = z.string().parse(rawApartmentId);
  const config = await getHCApartmentsCollection().findOne({ apartmentId });
  if (!config) {
    const notFoundError = new Error("HC apartment config not found");
    (notFoundError as Error & { statusCode?: number }).statusCode = 404;
    throw notFoundError;
  }
  return { config };
};

export const queryHCApartments = async (rawInput: unknown) => {
  const input = ListQuerySchema.parse(rawInput);
  const collection = getHCApartmentsCollection();
  const { skip, limit } = buildPagination(input.page, input.perPage);

  const match: Record<string, unknown> = {
    workspaceId: input.workspaceId,
    projectId: { $in: input.projectIds }
  };
  if (input.searchText?.trim()) {
    match.apartmentId = { $regex: input.searchText.trim(), $options: "i" };
  }

  const [data, total] = await Promise.all([
    collection.find(match).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(match)
  ]);
  return { data, pagination: { page: input.page, perPage: input.perPage, total, totalPages: Math.ceil(total / input.perPage) } };
};

const statusRank: Record<string, number> = {
  proposta: 1,
  compromesso: 2,
  rogito: 3
};

export const createAssociation = async (rawInput: unknown) => {
  const input = AssociationCreateSchema.parse(rawInput);
  const collection = getAssociationsCollection();

  const existingOtherClient = await collection.findOne({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apartmentId: input.apartmentId,
    clientId: { $ne: input.clientId },
    active: true
  });
  if (existingOtherClient) {
    const conflictError = new Error("Apartment already associated to a different client");
    (conflictError as Error & { statusCode?: number }).statusCode = 409;
    throw conflictError;
  }

  const sameAssociation = await collection.findOne({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apartmentId: input.apartmentId,
    clientId: input.clientId,
    active: true
  });

  if (sameAssociation) {
    const previousStatus = String(sameAssociation.status || "proposta");
    if (statusRank[input.status] < statusRank[previousStatus] && !input.forceDowngrade) {
      const downgradeError = new Error(`Status downgrade detected: ${previousStatus} -> ${input.status}`);
      (downgradeError as Error & { statusCode?: number }).statusCode = 409;
      throw downgradeError;
    }
    const now = new Date().toISOString();
    await collection.updateOne(
      { _id: sameAssociation._id },
      { $set: { status: input.status, updatedAt: now } }
    );
    const updated = await collection.findOne({ _id: sameAssociation._id });
    await emitDomainEvent({
      type: "association.updated",
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      entityId: String(sameAssociation._id),
      payload: {
        apartmentId: input.apartmentId,
        clientId: input.clientId,
        status: input.status
      }
    });
    return { association: updated, created: false };
  }

  const now = new Date().toISOString();
  const doc = {
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apartmentId: input.apartmentId,
    clientId: input.clientId,
    status: input.status,
    active: true,
    createdAt: now,
    updatedAt: now
  };
  const insertedId = new ObjectId();
  await collection.insertOne({ _id: insertedId, ...doc });
  await emitDomainEvent({
    type: "association.created",
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    entityId: insertedId.toHexString(),
    payload: {
      apartmentId: input.apartmentId,
      clientId: input.clientId,
      status: input.status
    }
  });
  return { association: { ...doc, _id: insertedId }, created: true };
};

export const queryAssociations = async (rawInput: unknown) => {
  const input = ListQuerySchema.parse(rawInput);
  const collection = getAssociationsCollection();
  const { skip, limit } = buildPagination(input.page, input.perPage);
  const match: Record<string, unknown> = { workspaceId: input.workspaceId, projectId: { $in: input.projectIds }, active: true };
  const [data, total] = await Promise.all([
    collection.find(match).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(match)
  ]);
  return {
    data: data.map((row) => ({
      ...row,
      _id: row._id instanceof ObjectId ? row._id.toHexString() : String(row._id ?? "")
    })),
    pagination: { page: input.page, perPage: input.perPage, total, totalPages: Math.ceil(total / input.perPage) }
  };
};

export const deleteAssociation = async (rawAssociationId: unknown) => {
  const id = toObjectId(z.string().parse(rawAssociationId));
  const collection = getAssociationsCollection();
  const existing = await collection.findOne({ _id: id });
  if (!existing) {
    const notFoundError = new Error("Association not found");
    (notFoundError as Error & { statusCode?: number }).statusCode = 404;
    throw notFoundError;
  }
  const now = new Date().toISOString();
  await collection.updateOne({ _id: id }, { $set: { active: false, updatedAt: now } });
  const updated = await collection.findOne({ _id: id });
  if (!updated) {
    const notFoundError = new Error("Association not found");
    (notFoundError as Error & { statusCode?: number }).statusCode = 404;
    throw notFoundError;
  }
  await emitDomainEvent({
    type: "association.deleted",
    entityId: id.toHexString(),
    payload: { associationId: id.toHexString() }
  });
  return {
    deleted: true,
    workspaceId: String(existing.workspaceId ?? ""),
    projectId: String(existing.projectId ?? ""),
  };
};

export const previewCompleteFlow = async (rawInput: unknown) => {
  const input = CompleteFlowPreviewSchema.parse(rawInput);
  return {
    valid: true,
    steps: [
      "create_or_update_apartment",
      "create_or_update_hc_config",
      "create_or_update_association"
    ],
    warnings: input.association.status === "proposta" ? [] : ["Status selected is not proposta"],
    summary: {
      apartmentName: input.apartment.name,
      apartmentCode: input.apartment.code,
      sectionCount: input.hc.selectedSectionCodes.length
    }
  };
};

export const executeCompleteFlow = async (rawInput: unknown) => {
  const input = CompleteFlowPreviewSchema.parse(rawInput);
  const apartmentResult = await createApartment({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    ...input.apartment
  });
  const apartmentId = apartmentResult.apartmentId;

  await upsertHCApartment({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apartmentId,
    selectedSectionCodes: input.hc.selectedSectionCodes,
    selectedSectionIds: input.hc.selectedSectionIds,
    formValues: input.hc.formValues,
    finishesPrices: input.hc.finishesPrices
  });

  await createAssociation({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apartmentId,
    clientId: input.association.clientId,
    status: input.association.status,
    forceDowngrade: true
  });

  await getWorkflowsCollection().insertOne({
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apartmentId,
    createdAt: new Date().toISOString(),
    payload: input
  });
  await emitDomainEvent({
    type: "workflow.complete_flow.executed",
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    entityId: apartmentId,
    payload: {
      apartmentId,
      sectionCount: input.hc.selectedSectionCodes.length,
      associationStatus: input.association.status
    }
  });

  return { done: true, apartmentId };
};

export const queryHCMaster = async (rawEntity: unknown, rawInput: unknown) => {
  const entity = HCMasterEntitySchema.parse(rawEntity);
  const input = ListQuerySchema.parse(rawInput);
  const collection = getHCMasterCollection(entity);
  const { skip, limit } = buildPagination(input.page, input.perPage);
  const match: Record<string, unknown> = { workspaceId: input.workspaceId, projectId: { $in: input.projectIds } };
  if (input.searchText?.trim()) {
    match.$or = [{ code: { $regex: input.searchText.trim(), $options: "i" } }, { name: { $regex: input.searchText.trim(), $options: "i" } }];
  }
  const [data, total] = await Promise.all([
    collection.find(match).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray(),
    collection.countDocuments(match)
  ]);
  return { data, pagination: { page: input.page, perPage: input.perPage, total, totalPages: Math.ceil(total / input.perPage) } };
};

export const createHCMaster = async (rawEntity: unknown, rawInput: unknown) => {
  const entity = HCMasterEntitySchema.parse(rawEntity);
  const input = HCMasterUpsertSchema.parse(rawInput);
  const collection = getHCMasterCollection(entity);
  const now = new Date().toISOString();
  const insert = await collection.insertOne({ ...input, createdAt: now, updatedAt: now });
  await emitDomainEvent({
    type: "hc_master.created",
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    entityId: insert.insertedId.toHexString(),
    payload: { entity, code: input.code, name: input.name }
  });
  return { id: insert.insertedId.toHexString() };
};

export const updateHCMaster = async (rawEntity: unknown, rawId: unknown, rawInput: unknown) => {
  const entity = HCMasterEntitySchema.parse(rawEntity);
  const id = toObjectId(z.string().parse(rawId));
  const input = HCMasterUpsertSchema.partial().parse(rawInput);
  const collection = getHCMasterCollection(entity);
  const updated = await collection.findOneAndUpdate(
    { _id: id },
    { $set: { ...input, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  if (!updated) {
    const notFoundError = new Error("HC master entity not found");
    (notFoundError as Error & { statusCode?: number }).statusCode = 404;
    throw notFoundError;
  }
  await emitDomainEvent({
    type: "hc_master.updated",
    entityId: id.toHexString(),
    payload: { entity, id: id.toHexString(), patch: input as Record<string, unknown> }
  });
  return { entity: updated };
};

export const deleteHCMaster = async (rawEntity: unknown, rawId: unknown) => {
  const entity = HCMasterEntitySchema.parse(rawEntity);
  const id = toObjectId(z.string().parse(rawId));
  const collection = getHCMasterCollection(entity);
  const deletion = await collection.deleteOne({ _id: id });
  if (deletion.deletedCount === 0) {
    const notFoundError = new Error("HC master entity not found");
    (notFoundError as Error & { statusCode?: number }).statusCode = 404;
    throw notFoundError;
  }
  await emitDomainEvent({
    type: "hc_master.deleted",
    entityId: id.toHexString(),
    payload: { entity, id: id.toHexString() }
  });
  return { deleted: true };
};

export const getTemplateConfiguration = async (rawProjectId: unknown) => {
  const projectId = z.string().parse(rawProjectId);
  const template = await getTemplatesCollection().findOne({ projectId });
  if (!template) {
    return { projectId, template: { sections: [] } };
  }
  return { projectId, template: template.template ?? { sections: [] } };
};

export const validateTemplateConfiguration = async (rawInput: unknown) => {
  const parsed = z.object({ template: TemplateSchema }).parse(rawInput);
  const errors: string[] = [];
  const keys = new Set<string>();
  for (const section of parsed.template.sections) {
    for (const field of section.fields) {
      if (keys.has(field.key)) {
        errors.push(`Duplicate field key: ${field.key}`);
      }
      keys.add(field.key);
    }
  }
  return { valid: errors.length === 0, errors };
};

export const saveTemplateConfiguration = async (rawProjectId: unknown, rawInput: unknown) => {
  const projectId = z.string().parse(rawProjectId);
  const parsed = z.object({ workspaceId: z.string().min(1), template: TemplateSchema }).parse(rawInput);
  const now = new Date().toISOString();
  await getTemplatesCollection().updateOne(
    { projectId },
    { $set: { workspaceId: parsed.workspaceId, projectId, template: parsed.template, updatedAt: now }, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );
  await emitDomainEvent({
    type: "template.saved",
    workspaceId: parsed.workspaceId,
    projectId,
    entityId: projectId,
    payload: { sections: parsed.template.sections.length }
  });
  return { saved: true };
};

export const queryClientsLite = async (workspaceId: string, projectIds: string[]) => {
  const db = getDb();
  const clients = await db
    .collection("tz_clients")
    .find({ projectId: { $in: projectIds } })
    .project({ _id: 1, fullName: 1, email: 1, projectId: 1 })
    .limit(3000)
    .toArray();
  type ClientDoc = { _id?: unknown; fullName?: string; email?: string; projectId?: string };
  return (clients as ClientDoc[]).map((item) => ({
    _id: String(item._id),
    workspaceId,
    projectId: typeof item.projectId === "string" ? item.projectId : "",
    fullName: typeof item.fullName === "string" && item.fullName.trim() ? item.fullName.trim() : "-",
    email: typeof item.email === "string" ? item.email : ""
  }));
};
