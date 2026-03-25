import { describe, expect, it } from "vitest";
import { renderSecurityDashboardHtml } from "./render-dashboard-html.js";
import type { UnifiedReport } from "./schema.js";

describe("renderSecurityDashboardHtml", () => {
  it("include summary e righe senza XSS", () => {
    const report: UnifiedReport = {
      generatedAt: "2025-01-01T00:00:00Z",
      summary: {
        total: 1,
        critical: 1,
        high: 0,
        bySeverity: { low: 0, medium: 0, high: 0, critical: 1 },
        byType: { SAST: 1, SCA: 0, CONTAINER: 0, IAC: 0 },
      },
      issues: [
        {
          type: "SAST",
          severity: "critical",
          file: "a.ts",
          message: '<script>alert(1)</script>',
          tool: "semgrep",
          ruleId: "x",
          dedupeKey: "k",
        },
      ],
    };
    const html = renderSecurityDashboardHtml(report);
    expect(html).toContain("Totale");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});
