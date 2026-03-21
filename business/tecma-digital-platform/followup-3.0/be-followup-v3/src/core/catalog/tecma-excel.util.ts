import readXlsxFile from "read-excel-file/node";

export type Matrix = unknown[][];

export async function loadWorkbookSheets(buffer: Buffer): Promise<Record<string, Matrix>> {
  const mod = await import("read-excel-file/node");
  const readSheetNames = (mod as { readSheetNames?: (b: Buffer) => Promise<string[]> }).readSheetNames;
  if (typeof readSheetNames !== "function") {
    const rows = (await readXlsxFile(buffer)) as Matrix;
    return { Sheet1: rows };
  }
  const names = await readSheetNames(buffer);
  const out: Record<string, Matrix> = {};
  for (const name of names) {
    out[name] = (await readXlsxFile(buffer, { sheet: name })) as Matrix;
  }
  return out;
}

export function cellStr(v: unknown): string {
  if (v == null || v === "") return "";
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

export function cellBool(v: unknown): boolean | undefined {
  const s = cellStr(v).toUpperCase();
  if (s === "YES" || s === "TRUE" || s === "SI" || s === "SÌ") return true;
  if (s === "NO" || s === "FALSE") return false;
  return undefined;
}

export function cellNum(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}

export function findHeaderRow(matrix: Matrix, predicate: (row: unknown[]) => boolean): number {
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    if (Array.isArray(row) && predicate(row)) return i;
  }
  return -1;
}

export function rowGet(row: unknown[] | undefined, i: number): unknown {
  if (!row || i < 0) return undefined;
  return row[i];
}

/** Indice colonna il cui header (riga H) contiene il token (case-insensitive). */
export function colIndexByToken(headerRow: unknown[], token: string): number {
  const t = token.toLowerCase();
  for (let i = 0; i < headerRow.length; i++) {
    const h = cellStr(headerRow[i]).toLowerCase();
    if (h.includes(t)) return i;
  }
  return -1;
}

export function forwardFillHeaders(row: unknown[]): string[] {
  const out: string[] = [];
  let last = "";
  for (let i = 0; i < row.length; i++) {
    const c = cellStr(row[i]);
    if (c) last = c;
    out.push(last);
  }
  return out;
}
