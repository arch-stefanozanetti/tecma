import { z } from "zod";

export const TextBlockSchema = z.object({
  format: z.enum(["plain", "markdown"]),
  text: z.string(),
});

export type TextBlock = z.infer<typeof TextBlockSchema>;

export const CatalogImportSourceSchema = z.enum(["tecma_rent", "tecma_sell"]);
export type CatalogImportSource = z.infer<typeof CatalogImportSourceSchema>;

/** DTO/API + persistenza profilo unità (documento `tz_catalog_unit_profiles`). */
export const CatalogUnitProfileSchema = z.object({
  unitId: z.string().min(1),
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  apartmentCode: z.string().min(1),
  buildingId: z.string().optional(),
  floorPlanId: z.string().optional(),
  floor: z.number().optional(),
  sideNames: z.array(z.string()).optional(),
  modelName: z.string().optional(),
  dimensionName: z.string().optional(),
  marketingDescription: TextBlockSchema.optional(),
  internalNotes: TextBlockSchema.optional(),
  rooms: z
    .array(
      z.object({
        name: z.string().optional(),
        code: z.string().optional(),
        floor: z.number().optional(),
        available: z.boolean().optional(),
        price: z.number().optional(),
        condoFees: z.number().optional(),
        sideName: z.string().optional(),
        model: z.string().optional(),
        surfaceMq: z.number().optional(),
        bathroom: z.boolean().optional(),
        planRef: z.string().optional(),
      })
    )
    .optional(),
  specLines: z
    .array(
      z.object({
        label: z.string().optional(),
        shortText: TextBlockSchema.optional(),
        longText: TextBlockSchema.optional(),
        extraNotes: TextBlockSchema.optional(),
        price: z.number().optional(),
        rate: z.number().optional(),
      })
    )
    .optional(),
  spaceFinishes: z
    .array(
      z.object({
        spaceId: z.string().optional(),
        spaceName: z.string().optional(),
        items: z.array(z.object({ name: z.string(), price: z.number().optional() })),
      })
    )
    .optional(),
  sellCommercial: z
    .object({
      promos: z.array(z.record(z.unknown())).optional(),
      expenses: z.array(z.record(z.unknown())).optional(),
      payments: z.array(z.record(z.unknown())).optional(),
      quoteMeta: z.record(z.unknown()).optional(),
    })
    .optional(),
  rentCommercial: z
    .object({
      listPrice: z.number().optional(),
      condoFees: z.number().optional(),
      available: z.boolean().optional(),
    })
    .optional(),
  features: z.array(z.record(z.unknown())).optional(),
  extraSpaces: z.array(z.record(z.unknown())).optional(),
  quadrants: z.array(z.record(z.unknown())).optional(),
  cadastral: z.array(z.object({ key: z.string().optional(), value: z.string().optional() })).optional(),
  visibility: z.record(z.unknown()).optional(),
  importMeta: z
    .object({
      source: CatalogImportSourceSchema,
      signature: z.string(),
      importedAt: z.string(),
      batchId: z.string().optional(),
    })
    .optional(),
  catalogSchemaVersion: z.literal(1).default(1),
});

export type CatalogUnitProfile = z.infer<typeof CatalogUnitProfileSchema>;

export interface ParsedBuilding {
  code: string;
  name?: string;
  floors?: number;
  complex?: string;
  address?: string;
  zone?: string;
  geo?: { lat?: string; lon?: string };
}

export interface ParsedFloorPlan {
  planKey: string;
  name: string;
  typologyName?: string;
  mainFeatures?: {
    rooms?: number;
    bathroom?: number;
    bedroom?: number;
    openPlanKitchen?: boolean;
  };
  surfaceArea?: {
    apartment?: number;
    garden?: number;
    balcony?: number;
    loggia?: number;
    terrace?: number;
    total?: number;
    commercial?: number;
  };
}

export interface ParsedUnitRow {
  apartmentCode: string;
  apartmentName?: string;
  buildingCode?: string;
  floor?: number;
  planName?: string;
  planCode?: string;
  sideName?: string;
  modelName?: string;
  dimensionName?: string;
  specLines: Array<{
    label?: string;
    shortDescription?: string;
    longDescription?: string;
    extraNotes?: string;
    price?: number;
    rate?: number;
  }>;
  rooms: CatalogUnitProfile["rooms"];
  spaceFinishes: CatalogUnitProfile["spaceFinishes"];
  sellCommercial?: CatalogUnitProfile["sellCommercial"];
  rentCommercial?: CatalogUnitProfile["rentCommercial"];
  features: NonNullable<CatalogUnitProfile["features"]>;
  extraSpaces: NonNullable<CatalogUnitProfile["extraSpaces"]>;
  quadrants: NonNullable<CatalogUnitProfile["quadrants"]>;
  cadastral: NonNullable<CatalogUnitProfile["cadastral"]>;
  visibility?: CatalogUnitProfile["visibility"];
  marketingDescription?: TextBlock;
  internalNotes?: TextBlock;
}

export interface TecmaParseResult {
  signature: string;
  source: CatalogImportSource;
  buildings: ParsedBuilding[];
  floorPlans: ParsedFloorPlan[];
  units: ParsedUnitRow[];
  warnings: string[];
}
