import type { ParsedBuilding, ParsedFloorPlan, ParsedUnitRow, TecmaParseResult } from "./catalog.types.js";
import { cellNum, cellStr, colIndexByToken, findHeaderRow, rowGet, type Matrix } from "./tecma-excel.util.js";

const SIGNATURE = "signature_v1.1";

function parseMetadata(sheets: Record<string, Matrix>): string {
  const m = sheets.Metadata ?? sheets.metadata;
  if (!m?.length) return SIGNATURE;
  const flat = m.map((r) => r.map((c) => cellStr(c))).flat();
  const sig = flat.find((x) => x.includes("signature"));
  return sig || SIGNATURE;
}

/** Legge blocchi capitolato: colonne consecutive con header `formula*array` e sub-row label/shortDescription/... */
function parseFormulaSpecLines(row: unknown[], header: unknown[], sub: unknown[] | undefined): ParsedUnitRow["specLines"] {
  const lines: ParsedUnitRow["specLines"] = [];
  const blockWidth = 7;
  for (let c = 0; c + blockWidth <= header.length; c++) {
    const h1 = cellStr(header[c]).toLowerCase();
    if (!h1.includes("formula") || !h1.includes("array")) continue;
    const pick = (key: string): string | undefined => {
      for (let j = 0; j < blockWidth; j++) {
        if (cellStr(sub?.[c + j]).toLowerCase() === key) {
          const v = cellStr(rowGet(row, c + j));
          return v || undefined;
        }
      }
      return undefined;
    };
    const label = pick("label");
    const sd = pick("shortdescription");
    const ld = pick("longdescription");
    const en = pick("extranotes");
    const price = (() => {
      for (let j = 0; j < blockWidth; j++) {
        if (cellStr(sub?.[c + j]).toLowerCase() === "price") return cellNum(rowGet(row, c + j));
      }
      return undefined;
    })();
    const rate = (() => {
      for (let j = 0; j < blockWidth; j++) {
        if (cellStr(sub?.[c + j]).toLowerCase() === "rate") return cellNum(rowGet(row, c + j));
      }
      return undefined;
    })();
    if (!label && !sd && !ld && !en) {
      continue;
    }
    lines.push({
      label,
      shortDescription: sd,
      longDescription: ld,
      extraNotes: en,
      price,
      rate,
    });
    c += blockWidth - 1;
  }
  return lines;
}

function parsePromoRows(row: unknown[], header: unknown[], sub: unknown[] | undefined): Record<string, unknown>[] {
  const promos: Record<string, unknown>[] = [];
  const width = 9;
  for (let c = 0; c < header.length; c++) {
    const h1 = cellStr(header[c]).toLowerCase();
    if (!h1.includes("promos") || !h1.includes("array")) continue;
    const obj: Record<string, unknown> = {};
    for (let j = 0; j < width && c + j < header.length; j++) {
      const key = cellStr(sub?.[c + j]).toLowerCase().replace("#date", "");
      const val = rowGet(row, c + j);
      if (val != null && val !== "") obj[key || `f${j}`] = val;
    }
    if (Object.keys(obj).length > 0) promos.push(obj);
    c += width - 1;
  }
  return promos;
}

function parseArrayStripe(
  row: unknown[],
  header: unknown[],
  sub: unknown[] | undefined,
  includes: string
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (let c = 0; c < header.length; c++) {
    const h1 = cellStr(header[c]).toLowerCase();
    if (!h1.includes(includes) || !h1.includes("array")) continue;
    let end = c + 1;
    while (end < header.length) {
      const h2 = cellStr(header[end]).toLowerCase();
      if (h2 && !h2.includes(includes)) break;
      if (h2.includes(includes) && h2.includes("array") && end > c) break;
      end++;
    }
    const obj: Record<string, unknown> = {};
    for (let j = c; j < end; j++) {
      const key = cellStr(sub?.[j]).toLowerCase();
      const val = rowGet(row, j);
      if (key && val != null && val !== "") obj[key] = val;
    }
    if (Object.keys(obj).length > 0) out.push(obj);
    c = end - 1;
  }
  return out;
}

function surfaceFromHeader(header: unknown[], row: unknown[], token: string): number | undefined {
  const t = token.toLowerCase();
  for (let i = 0; i < header.length; i++) {
    if (cellStr(header[i]).toLowerCase().includes(t)) return cellNum(rowGet(row, i));
  }
  return undefined;
}

export function parseTecmaSellWorkbook(sheets: Record<string, Matrix>): TecmaParseResult {
  const warnings: string[] = [];
  const signature = parseMetadata(sheets);
  const matrix = sheets["Lista Appartamenti"] ?? [];

  const h = findHeaderRow(matrix, (row) => row.some((c) => cellStr(c).toLowerCase().includes("apartment_code")));
  if (h < 0) {
    return { signature, source: "tecma_sell", buildings: [], floorPlans: [], units: [], warnings: ["Lista Appartamenti mancante o senza apartment_code"] };
  }

  const header = matrix[h] as unknown[];
  const sub = matrix[h + 1] as unknown[] | undefined;
  const dataStart = h + 3;

  const iName = colIndexByToken(header, "apartment_name");
  const iCode = colIndexByToken(header, "apartment_code");
  const iPrice = colIndexByToken(header, "apartment_price");
  const iFloor = colIndexByToken(header, "apartment_floor");
  const iTypRooms = colIndexByToken(header, "typology_rooms");
  const iTypName = colIndexByToken(header, "typology_name");
  const iPlanName = colIndexByToken(header, "plan_name");
  const iPlanCode = colIndexByToken(header, "plan_code");
  const iBuildingFloors = colIndexByToken(header, "building_floors");
  const iBuildingAddr = colIndexByToken(header, "building_address");
  const iBuildingName = colIndexByToken(header, "building_name");
  const iSide = colIndexByToken(header, "side_name");
  const iModel = colIndexByToken(header, "model_name");
  const iDim = colIndexByToken(header, "dimension_name");
  let iBed = -1;
  let iBath = -1;
  for (let i = 0; i < header.length; i++) {
    const x = cellStr(header[i]).toLowerCase();
    if (x === "plan_bedroom") iBed = i;
    if (x === "plan_bathroom") iBath = i;
  }

  const buildingByCode = new Map<string, ParsedBuilding>();
  const units: ParsedUnitRow[] = [];
  const planAgg = new Map<string, ParsedFloorPlan>();

  for (let r = dataStart; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const apartmentCode = cellStr(rowGet(row, iCode));
    if (!apartmentCode || apartmentCode.toLowerCase() === "id") continue;

    const buildingName = cellStr(rowGet(row, iBuildingName));
    const buildingCode =
      cellStr(rowGet(row, iBuildingAddr)).replace(/\s+/g, "-").slice(0, 80) || buildingName || `bld-${apartmentCode}`;

    if (!buildingByCode.has(buildingCode)) {
      buildingByCode.set(buildingCode, {
        code: buildingCode,
        name: buildingName || buildingCode,
        floors: cellNum(rowGet(row, iBuildingFloors)),
        address: cellStr(rowGet(row, iBuildingAddr)) || undefined,
      });
    }

    const planName = cellStr(rowGet(row, iPlanName));
    const planKey = planName || cellStr(rowGet(row, iPlanCode)) || apartmentCode;
    const typRooms = cellNum(rowGet(row, iTypRooms));
    const typName = cellStr(rowGet(row, iTypName));
    const surf = {
      apartment: surfaceFromHeader(header, row, "superficieappartamento"),
      garden: surfaceFromHeader(header, row, "superficiegiardino"),
      balcony: surfaceFromHeader(header, row, "superficiebalcone"),
      loggia: surfaceFromHeader(header, row, "superficieloggia"),
      terrace: surfaceFromHeader(header, row, "superficieterrazzo"),
      total: surfaceFromHeader(header, row, "superficietotale"),
    };

    if (!planAgg.has(planKey)) {
      planAgg.set(planKey, {
        planKey,
        name: planName || planKey,
        typologyName: typName || undefined,
        mainFeatures: {
          rooms: typRooms,
          bathroom: iBath >= 0 ? cellNum(rowGet(row, iBath)) : undefined,
          bedroom: iBed >= 0 ? cellNum(rowGet(row, iBed)) : undefined,
        },
        surfaceArea: surf,
      });
    }

    const specLines = parseFormulaSpecLines(row, header, sub);
    const promos = parsePromoRows(row, header, sub);
    const expenses = parseArrayStripe(row, header, sub, "expenses");
    const payments = parseArrayStripe(row, header, sub, "payments");

    const cadastral: ParsedUnitRow["cadastral"] = [];
    for (let c = 0; c < header.length; c++) {
      const h1 = cellStr(header[c]).toLowerCase();
      if (!h1.includes("apartment_extrainfo")) continue;
      const v = cellStr(rowGet(row, c));
      if (v) cadastral.push({ key: `apartment_extra_${c}`, value: v });
    }
    for (let c = 0; c < header.length; c++) {
      const h1 = cellStr(header[c]).toLowerCase();
      if (!h1.includes("plan_extrainfo")) continue;
      const v = cellStr(rowGet(row, c));
      if (v) cadastral.push({ key: `plan_extra_${c}`, value: v });
    }

    const visibility: Record<string, unknown> = {};
    for (let c = 0; c < header.length; c++) {
      const hk = cellStr(header[c]).toLowerCase();
      if (!hk.includes("visibility") && !hk.includes("visibilit") && !hk.includes("enabled")) continue;
      const v = rowGet(row, c);
      if (v != null && v !== "") visibility[cellStr(header[c])] = v;
    }

    units.push({
      apartmentCode,
      apartmentName: cellStr(rowGet(row, iName)) || apartmentCode,
      buildingCode,
      floor: cellNum(rowGet(row, iFloor)),
      planName: planName || undefined,
      planCode: cellStr(rowGet(row, iPlanCode)) || undefined,
      sideName: cellStr(rowGet(row, iSide)) || undefined,
      modelName: cellStr(rowGet(row, iModel)) || undefined,
      dimensionName: cellStr(rowGet(row, iDim)) || undefined,
      specLines,
      rooms: [],
      spaceFinishes: [],
      sellCommercial: {
        promos: promos.length ? promos : undefined,
        expenses: expenses.length ? expenses : undefined,
        payments: payments.length ? payments : undefined,
      },
      rentCommercial: {
        listPrice: cellNum(rowGet(row, iPrice)),
      },
      features: [],
      extraSpaces: [],
      quadrants: [],
      cadastral,
      visibility: Object.keys(visibility).length ? visibility : undefined,
    });
  }

  if (units.length === 0) warnings.push("Lista Appartamenti: nessuna unità parsata");

  return {
    signature,
    source: "tecma_sell",
    buildings: [...buildingByCode.values()],
    floorPlans: [...planAgg.values()],
    units,
    warnings,
  };
}
