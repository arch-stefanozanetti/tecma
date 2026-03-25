import { ObjectId } from "mongodb";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import type { TecmaParseResult } from "./catalog.types.js";
import {
  upsertCatalogBuilding,
  upsertCatalogFloorPlan,
  upsertCatalogUnitProfile,
} from "./catalog.service.js";
import { loadWorkbookSheets, type Matrix } from "./tecma-excel.util.js";
import { parseTecmaRentWorkbook } from "./tecma-rent-import.parser.js";
import { parseTecmaSellWorkbook } from "./tecma-sell-import.parser.js";
import { escapeForMongoRegexSubstring } from "../shared/searchTextRegex.js";

function detectWorkbookKind(sheets: Record<string, Matrix>): "rent" | "sell" {
  if (sheets["Lista Appartamenti"]?.length) return "sell";
  if (sheets.Apartments?.length) return "rent";
  throw new HttpError("Formato Excel non riconosciuto: servono fogli Apartments (rent) o Lista Appartamenti (sell)", 400);
}

export async function parseTecmaCatalogWorkbook(buffer: Buffer): Promise<TecmaParseResult> {
  const sheets = await loadWorkbookSheets(buffer);
  const kind = detectWorkbookKind(sheets);
  return kind === "sell" ? parseTecmaSellWorkbook(sheets) : parseTecmaRentWorkbook(sheets);
}

export type CatalogImportPreviewRow = {
  apartmentCode: string;
  matched: boolean;
  apartmentId?: string;
};

export async function previewTecmaCatalogImport(
  buffer: Buffer,
  workspaceId: string,
  projectId: string
): Promise<{
  source: TecmaParseResult["source"];
  signature: string;
  warnings: string[];
  buildingsCount: number;
  floorPlansCount: number;
  unitsCount: number;
  rows: CatalogImportPreviewRow[];
}> {
  const parsed = await parseTecmaCatalogWorkbook(buffer);
  const db = getDb();
  const apts = db.collection("tz_apartments");
  const rows: CatalogImportPreviewRow[] = [];

  for (const u of parsed.units) {
    const code = u.apartmentCode.trim();
    const lit = escapeForMongoRegexSubstring(code);
    const apt = await apts.findOne({
      workspaceId,
      projectId,
      code: { $regex: `^${lit}$`, $options: "i" },
    });
    rows.push({
      apartmentCode: code,
      matched: Boolean(apt),
      apartmentId: apt?._id instanceof ObjectId ? apt._id.toHexString() : undefined,
    });
  }

  return {
    source: parsed.source,
    signature: parsed.signature,
    warnings: parsed.warnings,
    buildingsCount: parsed.buildings.length,
    floorPlansCount: parsed.floorPlans.length,
    unitsCount: parsed.units.length,
    rows,
  };
}

export type TecmaCatalogExecuteResult = {
  updated: number;
  skippedNoApartment: number;
  buildingsUpserted: number;
  floorPlansUpserted: number;
  warnings: string[];
};

function resolveFloorPlanForUnit(parsed: TecmaParseResult, u: TecmaParseResult["units"][0]): import("./catalog.types.js").ParsedFloorPlan {
  const key = (u.planName ?? u.apartmentCode).trim();
  const found = parsed.floorPlans.find((p) => p.planKey === key || p.name === key);
  if (found) return found;
  return {
    planKey: key,
    name: u.planName ?? key,
    typologyName: u.dimensionName,
    mainFeatures: {
      rooms: u.rooms?.length,
    },
    surfaceArea: {},
  };
}

export async function executeTecmaCatalogImport(
  buffer: Buffer,
  workspaceId: string,
  projectId: string
): Promise<TecmaCatalogExecuteResult> {
  const parsed = await parseTecmaCatalogWorkbook(buffer);
  const db = getDb();
  const apts = db.collection("tz_apartments");
  const importedAt = new Date().toISOString();
  const importMeta = {
    source: parsed.source,
    signature: parsed.signature,
    importedAt,
  } as const;

  let buildingsUpserted = 0;
  const buildingIdByCode = new Map<string, ObjectId>();
  for (const b of parsed.buildings) {
    const id = await upsertCatalogBuilding(workspaceId, projectId, b);
    buildingIdByCode.set(b.code, id);
    buildingsUpserted++;
  }

  let floorPlansUpserted = 0;
  const planIdByKey = new Map<string, ObjectId>();
  for (const p of parsed.floorPlans) {
    const id = await upsertCatalogFloorPlan(workspaceId, projectId, p);
    planIdByKey.set(p.planKey, id);
    floorPlansUpserted++;
  }

  let updated = 0;
  let skippedNoApartment = 0;

  for (const u of parsed.units) {
    const code = u.apartmentCode.trim();
    const lit = escapeForMongoRegexSubstring(code);
    const apt = await apts.findOne({
      workspaceId,
      projectId,
      code: { $regex: `^${lit}$`, $options: "i" },
    });
    if (!apt || !(apt._id instanceof ObjectId)) {
      skippedNoApartment++;
      continue;
    }

    const unitId = apt._id.toHexString();
    const bCode = u.buildingCode ?? "";
    let buildingId: ObjectId | undefined = bCode ? buildingIdByCode.get(bCode) : undefined;
    if (bCode && !buildingId) {
      buildingId = await upsertCatalogBuilding(workspaceId, projectId, {
        code: bCode,
        name: bCode,
      });
      buildingIdByCode.set(bCode, buildingId);
    }

    const fp = resolveFloorPlanForUnit(parsed, u);
    let floorPlanId = planIdByKey.get(fp.planKey);
    if (!floorPlanId) {
      floorPlanId = await upsertCatalogFloorPlan(workspaceId, projectId, fp);
      planIdByKey.set(fp.planKey, floorPlanId);
    }

    await upsertCatalogUnitProfile({
      unitId,
      workspaceId,
      projectId,
      apartmentCode: code,
      buildingId,
      floorPlanId,
      parsed: u,
      importMeta,
    });
    updated++;
  }

  return {
    updated,
    skippedNoApartment,
    buildingsUpserted,
    floorPlansUpserted,
    warnings: parsed.warnings,
  };
}
