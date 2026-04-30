import { describe, expect, it } from "vitest";
import {
  aggregateIssues,
  dedupeIssues,
  evaluateGate,
  sortIssues,
} from "./index.js";
import type { NormalizedIssue } from "./schema.js";

describe("aggregateIssues", () => {
  it("normalizza e ordina per severità", () => {
    const { issues, summary } = aggregateIssues({
      outDir: "/tmp",
      semgrepReport: undefined,
      osvReport: undefined,
      trivyReport: undefined,
      postProcessors: [
        () =>
          [
            {
              type: "SAST",
              severity: "low",
              file: "a.ts",
              message: "low",
              tool: "semgrep",
              dedupeKey: "1",
            },
            {
              type: "SCA",
              severity: "critical",
              file: "b.json",
              message: "crit",
              tool: "osv",
              dedupeKey: "2",
            },
          ] as NormalizedIssue[],
      ],
    });
    expect(summary.total).toBe(2);
    expect(issues[0].severity).toBe("critical");
    expect(issues[1].severity).toBe("low");
  });
});

describe("dedupeIssues", () => {
  it("rimuove stessa dedupeKey", () => {
    const a: NormalizedIssue = {
      type: "SAST",
      severity: "high",
      file: "x",
      message: "m",
      tool: "semgrep",
      dedupeKey: "same",
    };
    const b = { ...a, message: "other" };
    const out = dedupeIssues([a, b]);
    expect(out).toHaveLength(1);
  });
});

describe("evaluateGate", () => {
  it("fallisce se critical oltre soglia", () => {
    const g = evaluateGate(
      {
        total: 1,
        critical: 1,
        high: 0,
        bySeverity: { low: 0, medium: 0, high: 0, critical: 1 },
        byType: { SAST: 1, SCA: 0, CONTAINER: 0, IAC: 0 },
      },
      0,
      0,
    );
    expect(g.pass).toBe(false);
  });
});

describe("sortIssues", () => {
  it("ordina critical prima di low", () => {
    const issues: NormalizedIssue[] = [
      {
        type: "SAST",
        severity: "low",
        file: "z.ts",
        message: "",
        tool: "semgrep",
        dedupeKey: "a",
      },
      {
        type: "SAST",
        severity: "critical",
        file: "a.ts",
        message: "",
        tool: "semgrep",
        dedupeKey: "b",
      },
    ];
    const s = sortIssues(issues);
    expect(s[0].severity).toBe("critical");
  });
});
