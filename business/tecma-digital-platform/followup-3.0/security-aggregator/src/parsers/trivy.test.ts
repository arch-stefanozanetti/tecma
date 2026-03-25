import { describe, expect, it } from "vitest";
import { trivyAdapter } from "./trivy.js";

describe("trivyAdapter", () => {
  it("mappa vulnerabilità e misconfig", () => {
    const raw = {
      Results: [
        {
          Target: "package-lock.json",
          Class: "lang-pkgs",
          Type: "npm",
          Vulnerabilities: [
            {
              VulnerabilityID: "CVE-2024-1",
              PkgName: "foo",
              InstalledVersion: "1.0.0",
              Severity: "HIGH",
              Title: "Bad",
            },
          ],
        },
        {
          Target: "Dockerfile",
          Class: "config",
          Misconfigurations: [
            {
              ID: "DS002",
              Title: "root user",
              Severity: "MEDIUM",
            },
          ],
        },
      ],
    };
    const issues = trivyAdapter.parse(raw, "t.json");
    expect(issues.length).toBeGreaterThanOrEqual(2);
    const vuln = issues.find((i) => i.cveId === "CVE-2024-1");
    expect(vuln?.type).toBe("SCA");
    const mis = issues.find((i) => i.ruleId === "DS002");
    expect(mis?.type).toBe("IAC");
  });
});
