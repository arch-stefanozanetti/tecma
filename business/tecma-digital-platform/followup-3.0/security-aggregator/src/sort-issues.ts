import { severityRank } from "./severity.js";
import type { IssueType, NormalizedIssue, Severity } from "./schema.js";

const typeOrder: IssueType[] = ["SAST", "SCA", "CONTAINER", "IAC"];

function typeRank(t: IssueType): number {
  const i = typeOrder.indexOf(t);
  return i === -1 ? 99 : i;
}

export function sortIssues(issues: NormalizedIssue[]): NormalizedIssue[] {
  return [...issues].sort((a, b) => {
    const sr = severityRank(b.severity as Severity) - severityRank(a.severity as Severity);
    if (sr !== 0) return sr;
    const tr = typeRank(a.type) - typeRank(b.type);
    if (tr !== 0) return tr;
    const f = a.file.localeCompare(b.file);
    if (f !== 0) return f;
    const ra = a.ruleId ?? a.cveId ?? "";
    const rb = b.ruleId ?? b.cveId ?? "";
    return ra.localeCompare(rb);
  });
}
