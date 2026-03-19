import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../../config/db.js";
import { escapeRegex } from "../../utils/escapeRegex.js";
import { HttpError } from "../../types/http.js";
import { ListQuerySchema, buildPagination } from "../shared/list-query.js";
import { emitDomainEvent } from "../events/event-log.service.js";
import { createApartment as createApartmentFromApartments, ApartmentCreateSchema } from "../apartments/apartments.service.js";
import { namesFromDoc } from "../clients/client-name.util.js";

const HCMasterEntitySchema = z.enum(["section", "mood", "finish", "specification", "optional"]);

const ObjectIdLikeSchema = z.string().min(1);

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
  if (!ObjectId.isValid(value)) throw new Error(`Invalid ObjectId: ${value}`);
  return new ObjectId(value);
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
    throw new HttpError("HC apartment config not found", 404);
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
    match.apartmentId = { $regex: escapeRegex(input.searchText.trim()), $options: "i" };
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
    throw new HttpError("Association not found", 404);
  }
  const now = new Date().toISOString();
  await collection.updateOne({ _id: id }, { $set: { active: false, updatedAt: now } });
  const updated = await collection.findOne({ _id: id });
  if (!updated) {
    throw new HttpError("Association not found", 404);
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
  const apartmentResult = await createApartmentFromApartments({
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
    const safe = escapeRegex(input.searchText.trim());
    match.$or = [{ code: { $regex: safe, $options: "i" } }, { name: { $regex: safe, $options: "i" } }];
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
    throw new HttpError("HC master entity not found", 404);
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
    throw new HttpError("HC master entity not found", 404);
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
    .project({ _id: 1, fullName: 1, firstName: 1, lastName: 1, email: 1, projectId: 1 })
    .limit(3000)
    .toArray();
  return (clients as Record<string, unknown>[]).map((item) => {
    const n = namesFromDoc(item);
    return {
    _id: String(item._id),
    workspaceId,
    projectId: typeof item.projectId === "string" ? item.projectId : "",
    fullName: n.fullName,
    email: typeof item.email === "string" ? item.email : ""
  };
  });
};
