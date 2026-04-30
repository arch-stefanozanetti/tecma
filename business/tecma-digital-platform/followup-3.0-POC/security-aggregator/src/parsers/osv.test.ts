import { describe, expect, it } from "vitest";
import { osvAdapter } from "./osv.js";

describe("osvAdapter", () => {
  it("mappa pacchetti e vulnerabilità", () => {
    const raw = {
      results: [
        {
          source: { path: "be-followup-v3/package-lock.json" },
          packages: [
            {
              package: {
                name: "lodash",
                version: "4.17.20",
                ecosystem: "npm",
              },
              vulnerabilities: [
                {
                  id: "GHSA-xxxx",
                  summary: "Prototype pollution",
                  severity: [{ type: "HIGH" }],
                },
              ],
            },
          ],
        },
      ],
    };
    const issues = osvAdapter.parse(raw, "osv.json");
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("SCA");
    expect(issues[0].severity).toBe("high");
    expect(issues[0].cveId).toBe("GHSA-xxxx");
  });
});
