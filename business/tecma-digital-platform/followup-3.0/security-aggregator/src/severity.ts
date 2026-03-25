import type { Severity } from "./schema.js";

const ORDER: Severity[] = ["low", "medium", "high", "critical"];

export function severityRank(s: Severity): number {
  const i = ORDER.indexOf(s);
  return i === -1 ? 0 : i + 1;
}

export function normalizeSemgrepSeverity(raw: string | undefined): Severity {
  const u = (raw ?? "").toUpperCase();
  if (u === "ERROR" || u === "HIGH") return "high";
  if (u === "WARNING" || u === "MEDIUM") return "medium";
  if (u === "INFO" || u === "LOW") return "low";
  return "medium";
}

export function normalizeOsvSeverity(raw: string | undefined): Severity {
  const u = (raw ?? "").toUpperCase();
  if (u === "CRITICAL") return "critical";
  if (u === "HIGH") return "high";
  if (u === "MODERATE" || u === "MEDIUM") return "medium";
  if (u === "LOW") return "low";
  return "medium";
}

export function normalizeTrivySeverity(raw: string | undefined): Severity {
  const u = (raw ?? "").toUpperCase();
  if (u === "CRITICAL") return "critical";
  if (u === "HIGH") return "high";
  if (u === "MEDIUM") return "medium";
  if (u === "LOW" || u === "UNKNOWN") return "low";
  return "medium";
}
