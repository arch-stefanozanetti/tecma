import { describe, expect, it } from "vitest";
import writeXlsxFile from "write-excel-file";
import { matrixToExcelUnitRows, parseExcelBuffer } from "./units-import.service.js";

async function minimalXlsxBuffer(): Promise<Buffer> {
  const data = [
    [
      { value: "unit_code", fontWeight: "bold" },
      { value: "name", fontWeight: "bold" },
      { value: "floor", fontWeight: "bold" },
      { value: "price", fontWeight: "bold" },
    ],
    [
      { type: String, value: "X9" },
      { type: String, value: "Da file" },
      { type: Number, value: 4 },
      { type: Number, value: 199000 },
    ],
  ];
  const writeToBuffer = writeXlsxFile as unknown as (
    rows: typeof data,
    opts: { buffer: true }
  ) => Promise<Buffer | Uint8Array | Blob>;
  const raw = await writeToBuffer(data, { buffer: true });
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof Uint8Array) return Buffer.from(raw);
  if (typeof Blob !== "undefined" && raw instanceof Blob) {
    return Buffer.from(await raw.arrayBuffer());
  }
  return Buffer.from(raw as unknown as ArrayBuffer);
}

describe("matrixToExcelUnitRows", () => {
  it("mappa intestazioni e righe come import Excel", () => {
    const matrix = [
      ["unit_code", "name", "floor", "size_m2", "price", "status"],
      ["A1", "Unità uno", 2, 75.5, 350000, "available"],
    ];
    const rows = matrixToExcelUnitRows(matrix);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      unit_code: "A1",
      name: "Unità uno",
      floor: 2,
      size_m2: 75.5,
      price: 350000,
      status: "available",
    });
  });

  it("salta righe senza unit_code e accetta alias unitcode", () => {
    const matrix = [
      ["Unit Code", "name"],
      ["", "x"],
      ["B2", "ok"],
    ];
    const rows = matrixToExcelUnitRows(matrix);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.unit_code).toBe("B2");
  });

  it("matrix vuota o senza righe dati → []", () => {
    expect(matrixToExcelUnitRows([])).toEqual([]);
    expect(matrixToExcelUnitRows([["unit_code"]])).toEqual([]);
  });
});

describe("parseExcelBuffer", () => {
  it("parsa un .xlsx binario (round-trip write → read)", async () => {
    const buf = await minimalXlsxBuffer();
    const rows = await parseExcelBuffer(buf);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      unit_code: "X9",
      name: "Da file",
      floor: 4,
      price: 199000,
    });
  });
});
