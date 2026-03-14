/**
 * Import massivo unit da Excel. Pipeline: parse → validate → preview → execute.
 * Schema Excel: unit_code, name, floor, size_m2, rooms, bathrooms, type, price, status.
 */
import * as XLSX from "xlsx";
import { getDb } from "../../config/db.js";
import { HttpError } from "../../types/http.js";
import { createApartment } from "../future/future.service.js";

export interface ExcelUnitRow {
  unit_code: string;
  name?: string;
  floor?: number;
  size_m2?: number;
  rooms?: number;
  bathrooms?: number;
  type?: string;
  price?: number;
  status?: string;
}

export interface ValidationError {
  rowIndex: number;
  row: Record<string, unknown>;
  message: string;
}

export interface ImportPreviewResult {
  validRows: ExcelUnitRow[];
  errors: ValidationError[];
  duplicates: { rowIndex: number; unit_code: string }[];
}

const DEFAULT_PLANIMETRY = "https://placeholder.local/planimetria.pdf";

function normalizeHeader(h: string): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

export const parseExcelBuffer = (buffer: Buffer): ExcelUnitRow[] => {
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) return [];
  const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: "" });
  if (!Array.isArray(data) || data.length === 0) return [];

  const rows: ExcelUnitRow[] = [];
  for (const raw of data) {
    const keys = Object.keys(raw);
    const map: Record<string, string> = {};
    keys.forEach((k) => {
      map[normalizeHeader(k)] = String(raw[k] ?? "").trim();
    });
    const unit_code = map.unit_code || map.unitcode || "";
    if (!unit_code) continue;

    const floor = map.floor !== "" ? parseInt(map.floor, 10) : 0;
    const size_m2 = map.size_m2 !== "" ? parseFloat(map.size_m2) : 0;
    const rooms = map.rooms !== "" ? parseInt(map.rooms, 10) : undefined;
    const bathrooms = map.bathrooms !== "" ? parseInt(map.bathrooms, 10) : undefined;
    const price = map.price !== "" ? parseFloat(map.price) : 0;
    rows.push({
      unit_code,
      name: map.name || unit_code,
      floor: Number.isNaN(floor) ? 0 : floor,
      size_m2: Number.isNaN(size_m2) ? 0 : size_m2,
      rooms: rooms !== undefined && !Number.isNaN(rooms) ? rooms : undefined,
      bathrooms: bathrooms !== undefined && !Number.isNaN(bathrooms) ? bathrooms : undefined,
      type: map.type || undefined,
      price: Number.isNaN(price) ? 0 : price,
      status: map.status || "available",
    });
  }
  return rows;
};

export const validateRows = async (
  rows: ExcelUnitRow[],
  workspaceId: string,
  projectId: string
): Promise<ImportPreviewResult> => {
  const errors: ValidationError[] = [];
  const duplicates: { rowIndex: number; unit_code: string }[] = [];
  const validRows: ExcelUnitRow[] = [];

  const db = getDb();
  const existing = await db
    .collection("tz_apartments")
    .find({ workspaceId, projectId })
    .project({ code: 1 })
    .toArray();
  const existingCodes = new Set((existing as { code?: string }[]).map((d) => String(d.code ?? "").trim().toLowerCase()));

  rows.forEach((row, index) => {
    const rowIndex = index + 2;
    if (!row.unit_code || String(row.unit_code).trim() === "") {
      errors.push({ rowIndex, row: row as unknown as Record<string, unknown>, message: "unit_code obbligatorio" });
      return;
    }
    const code = String(row.unit_code).trim();
    if (existingCodes.has(code.toLowerCase())) {
      duplicates.push({ rowIndex, unit_code: code });
    }
    if (row.size_m2 != null && (typeof row.size_m2 !== "number" || row.size_m2 < 0)) {
      errors.push({ rowIndex, row: row as unknown as Record<string, unknown>, message: "size_m2 non valido" });
      return;
    }
    if (row.price != null && (typeof row.price !== "number" || row.price < 0)) {
      errors.push({ rowIndex, row: row as unknown as Record<string, unknown>, message: "price non valido" });
      return;
    }
    validRows.push(row);
  });

  return { validRows, errors, duplicates };
};

export type OnDuplicate = "skip" | "overwrite" | "fail";

export interface ExecuteImportResult {
  created: number;
  skipped: number;
  errors: Array<{ rowIndex: number; unit_code: string; message: string }>;
}

export const executeImport = async (
  workspaceId: string,
  projectId: string,
  validRows: ExcelUnitRow[],
  onDuplicate: OnDuplicate
): Promise<ExecuteImportResult> => {
  if (!workspaceId?.trim() || !projectId?.trim()) {
    throw new HttpError("workspaceId e projectId obbligatori", 400);
  }

  const result: ExecuteImportResult = { created: 0, skipped: 0, errors: [] };
  const db = getDb();
  const apartments = db.collection("tz_apartments");

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];
    const rowIndex = i + 2;
    const code = String(row.unit_code).trim();
    const name = (row.name ?? code).trim() || code;
    const status = String(row.status ?? "available").toUpperCase();
    const aptStatus =
      status === "RESERVED" ? "RESERVED" : status === "SOLD" ? "SOLD" : status === "RENTED" ? "RENTED" : "AVAILABLE";
    const mode = aptStatus === "RENTED" ? "RENT" : "SELL";

    try {
      const existing = await apartments.findOne({
        workspaceId,
        projectId,
        code: { $regex: `^${code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      });

      if (existing) {
        if (onDuplicate === "fail") {
          result.errors.push({ rowIndex, unit_code: code, message: "Duplicato: unit_code già presente" });
          continue;
        }
        if (onDuplicate === "skip") {
          result.skipped++;
          continue;
        }
        if (onDuplicate === "overwrite") {
          await apartments.updateOne(
            { _id: existing._id },
            {
              $set: {
                name,
                status: aptStatus,
                mode,
                surfaceMq: row.size_m2 ?? 0,
                rawPrice: { mode, amount: row.price ?? 0 },
                updatedAt: new Date().toISOString(),
              },
            }
          );
          const { setInventoryStatus } = await import("../inventory/inventory.service.js");
          const { upsertCommercialModel } = await import("../commercial-models/commercial-models.service.js");
          const existingId = (existing as { _id?: { toHexString?: () => string } })._id;
          const unitId = existingId != null ? (typeof existingId.toHexString === "function" ? existingId.toHexString() : String(existingId)) : "";
          if (unitId) {
            const invStatus = aptStatus === "RESERVED" ? "reserved" : aptStatus === "SOLD" ? "sold" : aptStatus === "RENTED" ? "reserved" : "available";
            await setInventoryStatus(unitId, workspaceId, invStatus);
            await upsertCommercialModel(unitId, workspaceId, mode === "RENT" ? "rent_long" : "sell");
          }
          result.created++;
          continue;
        }
      }

      await createApartment({
        workspaceId,
        projectId,
        code,
        name,
        price: row.price ?? 0,
        floor: row.floor ?? 0,
        surfaceMq: row.size_m2 ?? 0,
        planimetryUrl: DEFAULT_PLANIMETRY,
        mode,
        status: aptStatus,
      });
      result.created++;
    } catch (err) {
      result.errors.push({
        rowIndex,
        unit_code: code,
        message: err instanceof Error ? err.message : "Errore creazione unità",
      });
    }
  }

  return result;
};
