import { ObjectId, type Document } from "mongodb";
import { getDb } from "../../config/db.js";
import type { CatalogUnitProfile, ParsedBuilding, ParsedFloorPlan, TextBlock } from "./catalog.types.js";

export const TZ_CATALOG_BUILDINGS = "tz_catalog_buildings";
export const TZ_CATALOG_FLOOR_PLANS = "tz_catalog_floor_plans";
export const TZ_CATALOG_UNIT_PROFILES = "tz_catalog_unit_profiles";

export type CatalogBuildingDoc = {
  _id: ObjectId;
  workspaceId: string;
  projectId: string;
  code: string;
  name: string;
  floors?: number;
  complex?: string;
  address?: string;
  zone?: string;
  geo?: { lat?: string; lon?: string };
  createdAt: string;
  updatedAt: string;
};

export type CatalogFloorPlanDoc = {
  _id: ObjectId;
  workspaceId: string;
  projectId: string;
  planKey: string;
  name: string;
  typologyName?: string;
  mainFeatures?: ParsedFloorPlan["mainFeatures"];
  surfaceArea?: ParsedFloorPlan["surfaceArea"];
  createdAt: string;
  updatedAt: string;
};

export type CatalogUnitProfileDoc = CatalogUnitProfile & {
  _id: ObjectId;
  createdAt: string;
  updatedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertCatalogBuilding(
  workspaceId: string,
  projectId: string,
  b: ParsedBuilding
): Promise<ObjectId> {
  const db = getDb();
  const coll = db.collection<CatalogBuildingDoc>(TZ_CATALOG_BUILDINGS);
  const t = nowIso();
  await coll.updateOne(
    { workspaceId, projectId, code: b.code },
    {
      $set: {
        name: b.name ?? b.code,
        floors: b.floors,
        complex: b.complex,
        address: b.address,
        zone: b.zone,
        geo: b.geo,
        updatedAt: t,
      },
      $setOnInsert: {
        workspaceId,
        projectId,
        code: b.code,
        createdAt: t,
      },
    },
    { upsert: true }
  );
  const found = await coll.findOne({ workspaceId, projectId, code: b.code });
  if (found?._id) return found._id;
  throw new Error("upsertCatalogBuilding failed");
}

export async function upsertCatalogFloorPlan(
  workspaceId: string,
  projectId: string,
  p: ParsedFloorPlan
): Promise<ObjectId> {
  const db = getDb();
  const coll = db.collection<CatalogFloorPlanDoc>(TZ_CATALOG_FLOOR_PLANS);
  const t = nowIso();
  await coll.updateOne(
    { workspaceId, projectId, planKey: p.planKey },
    {
      $set: {
        name: p.name,
        typologyName: p.typologyName,
        mainFeatures: p.mainFeatures,
        surfaceArea: p.surfaceArea,
        updatedAt: t,
      },
      $setOnInsert: {
        workspaceId,
        projectId,
        planKey: p.planKey,
        createdAt: t,
      },
    },
    { upsert: true }
  );
  const found = await coll.findOne({ workspaceId, projectId, planKey: p.planKey });
  if (!found?._id) throw new Error("upsertCatalogFloorPlan failed");
  return found._id;
}

function toTextBlockPlain(s?: string): TextBlock | undefined {
  if (!s?.trim()) return undefined;
  return { format: "plain", text: s.trim() };
}

function specLinesToProfile(spec: { label?: string; shortDescription?: string; longDescription?: string; extraNotes?: string; price?: number; rate?: number }[]) {
  return spec.map((l) => ({
    label: l.label,
    shortText: toTextBlockPlain(l.shortDescription),
    longText: toTextBlockPlain(l.longDescription),
    extraNotes: toTextBlockPlain(l.extraNotes),
    price: l.price,
    rate: l.rate,
  }));
}

export async function upsertCatalogUnitProfile(input: {
  unitId: string;
  workspaceId: string;
  projectId: string;
  apartmentCode: string;
  buildingId?: ObjectId;
  floorPlanId?: ObjectId;
  parsed: import("./catalog.types.js").ParsedUnitRow;
  importMeta: NonNullable<CatalogUnitProfile["importMeta"]>;
}): Promise<void> {
  const db = getDb();
  const coll = db.collection<CatalogUnitProfileDoc>(TZ_CATALOG_UNIT_PROFILES);
  const t = nowIso();
  const p = input.parsed;
  const sideNames = [p.sideName].filter(Boolean) as string[];

  const existing = await coll.findOne({ unitId: input.unitId });
  const _id = existing?._id ?? new ObjectId();
  const createdAt = existing?.createdAt ?? t;

  const doc: CatalogUnitProfileDoc = {
    _id,
    unitId: input.unitId,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    apartmentCode: input.apartmentCode,
    buildingId: input.buildingId?.toHexString(),
    floorPlanId: input.floorPlanId?.toHexString(),
    floor: p.floor,
    sideNames: sideNames.length ? sideNames : undefined,
    modelName: p.modelName,
    dimensionName: p.dimensionName,
    specLines: specLinesToProfile(p.specLines),
    rooms: p.rooms,
    spaceFinishes: p.spaceFinishes,
    sellCommercial: p.sellCommercial,
    rentCommercial: p.rentCommercial,
    features: p.features,
    extraSpaces: p.extraSpaces,
    quadrants: p.quadrants,
    cadastral: p.cadastral,
    visibility: p.visibility,
    importMeta: input.importMeta,
    catalogSchemaVersion: 1,
    createdAt,
    updatedAt: t,
  };

  await coll.replaceOne({ unitId: input.unitId }, doc, { upsert: true });
}

export type CatalogBundle = {
  profile: CatalogUnitProfileDoc | null;
  building: CatalogBuildingDoc | null;
  floorPlan: CatalogFloorPlanDoc | null;
};

export async function getCatalogBundleForUnit(unitId: string): Promise<CatalogBundle> {
  const db = getDb();
  const profiles = db.collection<CatalogUnitProfileDoc>(TZ_CATALOG_UNIT_PROFILES);
  const profile = await profiles.findOne({ unitId });
  if (!profile) return { profile: null, building: null, floorPlan: null };

  const buildings = db.collection<CatalogBuildingDoc>(TZ_CATALOG_BUILDINGS);
  const plans = db.collection<CatalogFloorPlanDoc>(TZ_CATALOG_FLOOR_PLANS);

  let building: CatalogBuildingDoc | null = null;
  if (profile.buildingId && ObjectId.isValid(profile.buildingId)) {
    building = await buildings.findOne({ _id: new ObjectId(profile.buildingId) });
  }

  let floorPlan: CatalogFloorPlanDoc | null = null;
  if (profile.floorPlanId && ObjectId.isValid(profile.floorPlanId)) {
    floorPlan = await plans.findOne({ _id: new ObjectId(profile.floorPlanId) });
  }

  return { profile, building, floorPlan };
}

/** Serializzazione API (string id, niente ObjectId). */
export function serializeCatalogBundle(bundle: CatalogBundle): Document {
  const { profile, building, floorPlan } = bundle;
  return {
    profile: profile
      ? {
          ...profile,
          _id: profile._id.toHexString(),
        }
      : null,
    building: building
      ? {
          ...building,
          _id: building._id.toHexString(),
        }
      : null,
    floorPlan: floorPlan
      ? {
          ...floorPlan,
          _id: floorPlan._id.toHexString(),
        }
      : null,
  };
}

export function mergeCatalogIntoApartmentPayload(
  apartment: Record<string, unknown>,
  bundle: CatalogBundle
): Record<string, unknown> {
  const { profile, building, floorPlan } = bundle;
  const catalog = serializeCatalogBundle(bundle);

  const buildingOut =
    building != null
      ? {
          _id: building._id.toHexString(),
          name: building.name,
          address: building.address ?? null,
          floors: building.floors,
          code: building.code,
          zone: building.zone ?? null,
          complex: building.complex,
          geo: (() => {
            const lat = building.geo?.lat != null ? Number.parseFloat(String(building.geo.lat)) : NaN;
            const lon = building.geo?.lon != null ? Number.parseFloat(String(building.geo.lon)) : NaN;
            if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
            return undefined;
          })(),
        }
      : undefined;

  const planOut =
    floorPlan != null
      ? {
          _id: floorPlan._id.toHexString(),
          name: floorPlan.name,
          typology: floorPlan.typologyName ? { name: floorPlan.typologyName } : undefined,
          model: profile?.modelName ? { name: profile.modelName } : undefined,
          dimension: profile?.dimensionName ? { name: profile.dimensionName } : undefined,
          surfaceArea: floorPlan.surfaceArea,
          mainFeatures: floorPlan.mainFeatures,
        }
      : profile?.modelName || profile?.dimensionName
        ? {
            model: profile!.modelName ? { name: profile.modelName } : undefined,
            dimension: profile!.dimensionName ? { name: profile.dimensionName } : undefined,
            surfaceArea: undefined,
            mainFeatures: undefined,
          }
        : undefined;

  const extraFromCadastral: Record<string, string> = {};
  if (profile?.cadastral?.length) {
    for (const e of profile.cadastral) {
      if (e.key && e.value) extraFromCadastral[e.key] = e.value;
    }
  }

  return {
    ...apartment,
    floor: profile?.floor ?? apartment.floor,
    building: buildingOut ?? apartment.building,
    plan: planOut ?? apartment.plan,
    sides: profile?.sideNames?.map((name) => ({ name })) ?? apartment.sides,
    extraInfo: Object.keys(extraFromCadastral).length ? extraFromCadastral : apartment.extraInfo,
    catalog,
  };
}
