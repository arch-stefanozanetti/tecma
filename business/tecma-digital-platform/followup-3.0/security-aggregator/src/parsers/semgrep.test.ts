import { describe, expect, it } from "vitest";
import { semgrepAdapter } from "./semgrep.js";

describe("semgrepAdapter", () => {
  it("mappa results in issue SAST", () => {
    const raw = {
      results: [
        {
          check_id: "js.sql",
          path: "src/x.ts",
          start: { line: 10 },
          end: { line: 11 },
          extra: { message: "SQL risk", severity: "ERROR", fix: "use param" },
        },
      ],
    };
    const issues = semgrepAdapter.parse(raw, "f.json");
    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe("SAST");
    expect(issues[0].severity).toBe("high");
    expect(issues[0].ruleId).toBe("js.sql");
    expect(issues[0].dedupeKey).toHaveLength(64);
  });
});
