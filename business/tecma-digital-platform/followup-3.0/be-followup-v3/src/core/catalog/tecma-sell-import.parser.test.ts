import { describe, expect, it } from "vitest";
import { parseTecmaSellWorkbook } from "./tecma-sell-import.parser.js";
import type { Matrix } from "./tecma-excel.util.js";

describe("parseTecmaSellWorkbook", () => {
  it("parses Lista Appartamenti rows", () => {
    const lista: Matrix = [
      ["APPARTAMENTO"],
      ["apartment_name", "apartment_code#string", "apartment_price", "apartment_floor", "typology_rooms#string", "typology_name", "plan_name", "plan_code#string", "building_floors", "building_address", "building_name#string"],
      [],
      ["Nome", "ID", "Valore", "Piano", "N° Stanze", "Tipologia", "Soluzione", "Codice", "Piani", "Indirizzo", "Edificio"],
      ["Unit A", "code-a", 100000, 2, "3", "Trilocale", "p1", "pc1", 5, "Via Roma 1", "Palazzo X"],
    ];
    const sheets: Record<string, Matrix> = {
      Metadata: [["Signature Version:", "signature_v1.1"]],
      "Lista Appartamenti": lista,
    };
    const r = parseTecmaSellWorkbook(sheets);
    expect(r.source).toBe("tecma_sell");
    expect(r.units).toHaveLength(1);
    expect(r.units[0]!.apartmentCode).toBe("code-a");
    expect(r.units[0]!.apartmentName).toBe("Unit A");
    expect(r.buildings.length).toBeGreaterThanOrEqual(1);
  });
});
