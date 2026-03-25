import { computeDedupeKey } from "../dedupe.js";
import { normalizeSemgrepSeverity } from "../severity.js";
import type { NormalizedIssue } from "../schema.js";
import type { ScannerAdapter } from "../adapters/types.js";

interface SemgrepExtra {
  message?: string;
  severity?: string;
  fix?: string;
}

interface SemgrepResult {
  check_id?: string;
  path?: string;
  start?: { line?: number; col?: number };
  end?: { line?: number; col?: number };
  extra?: SemgrepExtra;
}

interface SemgrepReport {
  results?: SemgrepResult[];
}

export const semgrepAdapter: ScannerAdapter = {
  tool: "semgrep",
  parse(raw: unknown, _sourcePath: string): NormalizedIssue[] {
    const data = raw as SemgrepReport;
    const results = data.results ?? [];
    const out: NormalizedIssue[] = [];
    for (const r of results) {
      const file = r.path ?? "";
      const ruleId = r.check_id ?? "unknown";
      const startLine = r.start?.line;
      const endLine = r.end?.line ?? startLine;
      const rawSev = r.extra?.severity;
      const severity = normalizeSemgrepSeverity(rawSev);
      const message = r.extra?.message ?? ruleId;
      const fix = r.extra?.fix;
      const dedupeKey = computeDedupeKey([
        "semgrep",
        ruleId,
        file,
        String(startLine ?? ""),
        String(endLine ?? ""),
      ]);
      out.push({
        type: "SAST",
        severity,
        file,
        message,
        fix,
        tool: "semgrep",
        ruleId,
        dedupeKey,
        rawSeverity: rawSev,
        locations:
          file && (startLine != null || endLine != null)
            ? [{ file, startLine, endLine }]
            : undefined,
      });
    }
    return out;
  },
};
