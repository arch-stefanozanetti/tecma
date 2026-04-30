import type { ParsedBuilding, ParsedFloorPlan, ParsedUnitRow, TecmaParseResult } from "./catalog.types.js";
import {
  cellBool,
  cellNum,
  cellStr,
  colIndexByToken,
  findHeaderRow,
  rowGet,
  type Matrix,
} from "./tecma-excel.util.js";

const SIGNATURE = "signature_v1.1";

function parseMetadata(sheets: Record<string, Matrix>): string {
  const m = sheets.Metadata ?? sheets.metadata;
  if (!m?.length) return SIGNATURE;
  const flat = m.map((r) => r.map((c) => cellStr(c))).flat();
  const sig = flat.find((x) => x.includes("signature"));
  return sig || SIGNATURE;
}

function parseBuildings(matrix: Matrix): ParsedBuilding[] {
  const h = findHeaderRow(matrix, (row) =>
    row.some((c) => cellStr(c).toLowerCase().includes("building_code"))
  );
  if (h < 0) return [];
  const header = matrix[h] as unknown[];
  const ic = colIndexByToken(header, "building_code");
  const iname = colIndexByToken(header, "building_name");
  const ifloors = colIndexByToken(header, "building_floors");
  const icomplex = colIndexByToken(header, "building_complex");
  const iaddr = colIndexByToken(header, "building_address");
  const izone = colIndexByToken(header, "building_zone");
  const ilat = colIndexByToken(header, "geo_lat");
  const ilon = colIndexByToken(header, "geo_lon");
  const out: ParsedBuilding[] = [];
  for (let r = h + 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const code = cellStr(rowGet(row, ic));
    if (!code || code.toLowerCase() === "building id") continue;
    out.push({
      code,
      name: cellStr(rowGet(row, iname)) || code,
      floors: cellNum(rowGet(row, ifloors)),
      complex: cellStr(rowGet(row, icomplex)) || undefined,
      address: cellStr(rowGet(row, iaddr)) || undefined,
      zone: cellStr(rowGet(row, izone)) || undefined,
      geo: {
        lat: cellStr(rowGet(row, ilat)) || undefined,
        lon: cellStr(rowGet(row, ilon)) || undefined,
      },
    });
  }
  return out;
}

function parseLayout(matrix: Matrix): ParsedFloorPlan[] {
  const h = findHeaderRow(matrix, (row) => row.some((c) => cellStr(c).toLowerCase().includes("plan_name")));
  if (h < 0) return [];
  const header = matrix[h] as unknown[];
  const ip = colIndexByToken(header, "plan_name");
  const it = colIndexByToken(header, "mainfeatures_typology");
  const ir = colIndexByToken(header, "mainfeatures_rooms");
  const ib = colIndexByToken(header, "mainfeatures_bathroom");
  const ibed = colIndexByToken(header, "mainfeatures_bedroom");
  const iopen = colIndexByToken(header, "openplankitchen");
  const iapt = colIndexByToken(header, "surfacearea_apartment");
  const ig = colIndexByToken(header, "surfacearea_garden");
  const ibal = colIndexByToken(header, "surfacearea_balcony");
  const ilog = colIndexByToken(header, "surfacearea_loggia");
  const iter = colIndexByToken(header, "surfacearea_terrace");
  const itot = colIndexByToken(header, "surfacearea_total");
  const out: ParsedFloorPlan[] = [];
  for (let r = h + 1; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const name = cellStr(rowGet(row, ip));
    if (!name || name.toLowerCase() === "layout id") continue;
    const openRaw = cellStr(rowGet(row, iopen)).toUpperCase();
    out.push({
      planKey: name,
      name,
      typologyName: cellStr(rowGet(row, it)) || undefined,
      mainFeatures: {
        rooms: cellNum(rowGet(row, ir)),
        bathroom: cellNum(rowGet(row, ib)),
        bedroom: cellNum(rowGet(row, ibed)),
        openPlanKitchen: openRaw === "YES" || openRaw === "SI" || openRaw === "SÌ",
      },
      surfaceArea: {
        apartment: cellNum(rowGet(row, iapt)),
        garden: cellNum(rowGet(row, ig)),
        balcony: cellNum(rowGet(row, ibal)),
        loggia: cellNum(rowGet(row, ilog)),
        terrace: cellNum(rowGet(row, iter)),
        total: cellNum(rowGet(row, itot)),
      },
    });
  }
  return out;
}

function parseApartmentsSheet(matrix: Matrix): ParsedUnitRow[] {
  const h = findHeaderRow(matrix, (row) =>
    row.some((c) => cellStr(c).toLowerCase().includes("apartment_code"))
  );
  if (h < 0) return [];
  const header = matrix[h] as unknown[];
  const iCode = colIndexByToken(header, "apartment_code");
  const iName = colIndexByToken(header, "apartment_name");
  const iBuilding = colIndexByToken(header, "building_code");
  const iFloor = colIndexByToken(header, "apartment_floor");
  const iPlan = colIndexByToken(header, "plan_name");
  const iPrice = colIndexByToken(header, "apartment_price");
  const iCondo = colIndexByToken(header, "apartment_condofees");
  const iAvail = colIndexByToken(header, "apartment_available");
  const iSide = colIndexByToken(header, "side_name");
  const iModel = colIndexByToken(header, "model_name");

  const formulaStarts: number[] = [];
  for (let c = 0; c < header.length; c++) {
    const hc = cellStr(header[c]).toLowerCase();
    if (hc.includes("formula") && hc.includes("array")) formulaStarts.push(c);
  }

  const out: ParsedUnitRow[] = [];
  for (let r = h + 3; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const apartmentCode = cellStr(rowGet(row, iCode));
    if (!apartmentCode || apartmentCode.toLowerCase() === "apartment id") continue;

    const lines: ParsedUnitRow["specLines"] = [];
    for (const start of formulaStarts) {
      const lab = cellStr(rowGet(row, start));
      const sd = cellStr(rowGet(row, start + 1));
      if (lab || sd) {
        lines.push({
          label: lab || undefined,
          shortDescription: sd || undefined,
        });
      }
    }

    const cadastral: ParsedUnitRow["cadastral"] = [];
    for (let c = 0; c < header.length; c++) {
      const hc = cellStr(header[c]).toLowerCase();
      if (!hc.includes("apartment_extrainfo")) continue;
      const v = cellStr(rowGet(row, c));
      if (v) cadastral.push({ key: `extra_${c}`, value: v });
    }

    out.push({
      apartmentCode,
      apartmentName: cellStr(rowGet(row, iName)) || apartmentCode,
      buildingCode: cellStr(rowGet(row, iBuilding)) || undefined,
      floor: cellNum(rowGet(row, iFloor)),
      planName: cellStr(rowGet(row, iPlan)) || undefined,
      sideName: cellStr(rowGet(row, iSide)) || undefined,
      modelName: cellStr(rowGet(row, iModel)) || undefined,
      specLines: lines,
      rooms: [],
      spaceFinishes: [],
      rentCommercial: {
        listPrice: cellNum(rowGet(row, iPrice)),
        condoFees: cellNum(rowGet(row, iCondo)),
        available: cellBool(rowGet(row, iAvail)),
      },
      features: [],
      extraSpaces: [],
      quadrants: [],
      cadastral,
    });
  }
  return out;
}

function parseRooms(matrix: Matrix): Map<string, ParsedUnitRow["rooms"]> {
  const map = new Map<string, NonNullable<ParsedUnitRow["rooms"]>>();
  const h = findHeaderRow(matrix, (row) => row.some((c) => cellStr(c).toLowerCase().includes("apartment_code")));
  if (h < 0) return map;
  const header = matrix[h] as unknown[];
  const iApt = colIndexByToken(header, "apartment_code");
  const iName = colIndexByToken(header, "room_name");
  const iCode = colIndexByToken(header, "room_code");
  const iFloor = colIndexByToken(header, "room_floor");
  const iAvail = colIndexByToken(header, "room_available");
  const iPrice = colIndexByToken(header, "room_price");
  const iCondo = colIndexByToken(header, "room_condofees");
  const iSide = colIndexByToken(header, "side_name");
  const iModel = colIndexByToken(header, "room_model");
  const iSurf = colIndexByToken(header, "room_surface");
  const iBath = colIndexByToken(header, "room_bathroom");
  const iPlan = colIndexByToken(header, "room_plan");
  for (let r = h + 3; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const apt = cellStr(rowGet(row, iApt));
    const name = cellStr(rowGet(row, iName));
    if (!apt || (!name && !cellStr(rowGet(row, iCode)))) continue;
    const bRaw = cellStr(rowGet(row, iBath)).toUpperCase();
    const entry = {
      name: name || undefined,
      code: cellStr(rowGet(row, iCode)) || undefined,
      floor: cellNum(rowGet(row, iFloor)),
      available: cellBool(rowGet(row, iAvail)),
      price: cellNum(rowGet(row, iPrice)),
      condoFees: cellNum(rowGet(row, iCondo)),
      sideName: cellStr(rowGet(row, iSide)) || undefined,
      model: cellStr(rowGet(row, iModel)) || undefined,
      surfaceMq: cellNum(rowGet(row, iSurf)),
      bathroom: bRaw === "YES" || bRaw === "SI",
      planRef: cellStr(rowGet(row, iPlan)) || undefined,
    };
    const list = map.get(apt) ?? [];
    list.push(entry);
    map.set(apt, list);
  }
  return map;
}

/** Nel foglio Mood&Pack `space_id` è l'ID appartamento (stesso codice di Apartments). */
function parseMoodPack(matrix: Matrix): Map<string, NonNullable<ParsedUnitRow["spaceFinishes"]>> {
  const map = new Map<string, NonNullable<ParsedUnitRow["spaceFinishes"]>>();
  const h = findHeaderRow(matrix, (row) => row.some((c) => cellStr(c).toLowerCase().includes("space_id")));
  if (h < 0) return map;
  const header = matrix[h] as unknown[];
  const sub = matrix[h + 1] as unknown[] | undefined;
  const iSid = colIndexByToken(header, "space_id");
  const iSname = colIndexByToken(header, "space_name");
  const moodCols: { name: number; price: number }[] = [];
  for (let c = 0; c < header.length; c++) {
    const hc = cellStr(header[c]).toLowerCase();
    if (!hc.includes("mood") || !hc.includes("array")) continue;
    const n1 = cellStr(sub?.[c]).toLowerCase();
    const n2 = cellStr(sub?.[c + 1]).toLowerCase();
    if (n1 === "name" && n2.includes("price")) moodCols.push({ name: c, price: c + 1 });
  }
  for (let r = h + 3; r < matrix.length; r++) {
    const row = matrix[r] as unknown[];
    const aptCode = cellStr(rowGet(row, iSid));
    const sname = cellStr(rowGet(row, iSname));
    if (!aptCode || aptCode.toLowerCase() === "apartment id") continue;
    const items: Array<{ name: string; price?: number }> = [];
    for (const { name: ic, price: ip } of moodCols) {
      const nm = cellStr(rowGet(row, ic));
      if (!nm) continue;
      items.push({ name: nm, price: cellNum(rowGet(row, ip)) });
    }
    if (items.length === 0) continue;
    const cur = map.get(aptCode) ?? [];
    cur.push({ spaceId: aptCode, spaceName: sname || undefined, items });
    map.set(aptCode, cur);
  }
  return map;
}

export function parseTecmaRentWorkbook(sheets: Record<string, Matrix>): TecmaParseResult {
  const warnings: string[] = [];
  const signature = parseMetadata(sheets);
  const buildings = parseBuildings(sheets.Buildings ?? []);
  const floorPlans = parseLayout(sheets.Layout ?? []);
  const unitsBase = parseApartmentsSheet(sheets.Apartments ?? []);
  if (unitsBase.length === 0) warnings.push("Foglio Apartments: nessuna unità parsata");
  const roomsByApt = parseRooms(sheets.Rooms ?? []);
  const moodByApt = parseMoodPack(sheets["Mood&Pack"] ?? sheets["MoodPack"] ?? []);

  const units: ParsedUnitRow[] = unitsBase.map((u) => {
    const rooms = roomsByApt.get(u.apartmentCode) ?? [];
    const finishes = moodByApt.get(u.apartmentCode) ?? [];
    return { ...u, rooms, spaceFinishes: finishes.length ? finishes : u.spaceFinishes };
  });

  return {
    signature,
    source: "tecma_rent",
    buildings,
    floorPlans,
    units,
    warnings,
  };
}
