import { describe, expect, it } from "vitest";
import { parseTecmaRentWorkbook } from "./tecma-rent-import.parser.js";
import type { Matrix } from "./tecma-excel.util.js";

describe("parseTecmaRentWorkbook", () => {
  it("parses Apartments sheet with formula columns", () => {
    const apartments: Matrix = [
      ["APARTMENT"],
      [
        "apartment_code#string",
        "apartment_name#string",
        "building_code",
        "apartment_floor",
        "plan_name#string",
        "formula*array",
        null,
        "apartment_price",
        "apartment_condoFees",
        "apartment_available#boolean",
      ],
      [null, null, null, null, null, "label", "shortDescription", null, null, null],
      ["ID", "Nome", "Edificio", "Piano", "Layout", "Nome Cap", "Desc", "Prezzo", "Spese", "Disp"],
      ["101", "101", "b1", 3, "L1", "Voce1", "Breve1", 1000, 500, "YES"],
    ];
    const sheets: Record<string, Matrix> = {
      Metadata: [["Signature Version:", "signature_v1.1"]],
      Apartments: apartments,
      Buildings: [],
      Layout: [],
      Rooms: [],
    };
    const r = parseTecmaRentWorkbook(sheets);
    expect(r.source).toBe("tecma_rent");
    expect(r.units).toHaveLength(1);
    expect(r.units[0]!.apartmentCode).toBe("101");
    expect(r.units[0]!.specLines).toHaveLength(1);
    expect(r.units[0]!.specLines[0]!.label).toBe("Voce1");
    expect(r.units[0]!.rentCommercial?.listPrice).toBe(1000);
  });
});
