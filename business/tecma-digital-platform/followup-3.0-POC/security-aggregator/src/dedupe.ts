import { createHash } from "node:crypto";
import type { NormalizedIssue } from "./schema.js";

export function computeDedupeKey(parts: string[]): string {
  const payload = parts.map((p) => p.replace(/\|/g, "\\|")).join("|");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/**
 * Mantiene la prima occorrenza per ogni dedupeKey (ordine già stabilito a monte).
 */
export function dedupeIssues(issues: NormalizedIssue[]): NormalizedIssue[] {
  const seen = new Set<string>();
  const out: NormalizedIssue[] = [];
  for (const issue of issues) {
    if (seen.has(issue.dedupeKey)) continue;
    seen.add(issue.dedupeKey);
    out.push(issue);
  }
  return out;
}
