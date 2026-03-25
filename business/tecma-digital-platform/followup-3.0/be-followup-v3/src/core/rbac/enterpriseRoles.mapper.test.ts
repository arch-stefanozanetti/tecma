import { describe, expect, it } from "vitest";
import { ENTERPRISE_ROLE_MAP, listEnterpriseRoleMappings } from "./enterpriseRoles.mapper.js";

describe("enterpriseRoles.mapper", () => {
  it("listEnterpriseRoleMappings copia la tabella costante", () => {
    const rows = listEnterpriseRoleMappings();
    expect(rows).not.toBe(ENTERPRISE_ROLE_MAP);
    expect(rows).toEqual(ENTERPRISE_ROLE_MAP);
    expect(rows.length).toBe(5);
  });
});
