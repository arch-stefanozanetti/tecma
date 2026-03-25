import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dedupeIssues } from "./dedupe.js";
import { sortIssues } from "./sort-issues.js";
import { stableStringify } from "./json-stable.js";
import { semgrepAdapter } from "./parsers/semgrep.js";
import { osvAdapter } from "./parsers/osv.js";
import { trivyAdapter } from "./parsers/trivy.js";
import type {
  IssueSummary,
  IssueType,
  NormalizedIssue,
  PostProcessFn,
  Severity,
  UnifiedReport,
} from "./schema.js";

export const defaultAdapters = [semgrepAdapter, osvAdapter, trivyAdapter] as const;

function readJson(path: string | undefined): unknown {
  if (!path) return {};
  try {
    const buf = readFileSync(path, "utf8");
    if (!buf.trim()) return {};
    return JSON.parse(buf) as unknown;
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "ENOENT") return {};
    throw e;
  }
}

function emptySummary(): IssueSummary {
  const bySeverity: Record<Severity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  const byType: Record<IssueType, number> = {
    SAST: 0,
    SCA: 0,
    CONTAINER: 0,
    IAC: 0,
  };
  return {
    total: 0,
    bySeverity,
    byType,
    critical: 0,
    high: 0,
  };
}

function buildSummary(issues: NormalizedIssue[]): IssueSummary {
  const s = emptySummary();
  for (const i of issues) {
    s.total += 1;
    s.bySeverity[i.severity] += 1;
    s.byType[i.type] += 1;
  }
  s.critical = s.bySeverity.critical;
  s.high = s.bySeverity.high;
  return s;
}

export interface AggregateOptions {
  semgrepReport?: string;
  osvReport?: string;
  trivyReport?: string;
  outDir: string;
  postProcessors?: PostProcessFn[];
}

export interface GateResult {
  pass: boolean;
  reason?: string;
}

export function evaluateGate(
  summary: IssueSummary,
  failOnCriticalGt: number,
  failOnHighGt: number,
): GateResult {
  if (summary.critical > failOnCriticalGt) {
    return {
      pass: false,
      reason: `critical count ${summary.critical} > ${failOnCriticalGt}`,
    };
  }
  if (summary.high > failOnHighGt) {
    return {
      pass: false,
      reason: `high count ${summary.high} > ${failOnHighGt}`,
    };
  }
  return { pass: true };
}

export function aggregateIssues(options: AggregateOptions): {
  issues: NormalizedIssue[];
  summary: IssueSummary;
} {
  const chunks: NormalizedIssue[] = [];
  const sem = readJson(options.semgrepReport);
  chunks.push(...semgrepAdapter.parse(sem, options.semgrepReport ?? ""));
  const osv = readJson(options.osvReport);
  chunks.push(...osvAdapter.parse(osv, options.osvReport ?? ""));
  const trivy = readJson(options.trivyReport);
  chunks.push(...trivyAdapter.parse(trivy, options.trivyReport ?? ""));

  let merged = dedupeIssues(chunks);
  for (const fn of options.postProcessors ?? []) {
    merged = fn(merged);
  }
  merged = sortIssues(merged);
  const summary = buildSummary(merged);
  return { issues: merged, summary };
}

export function writeReports(
  outDir: string,
  issues: NormalizedIssue[],
  summary: IssueSummary,
): UnifiedReport {
  mkdirSync(outDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const report: UnifiedReport = { generatedAt, summary, issues };
  const unifiedPath = `${outDir}/unified-report.json`;
  const summaryPath = `${outDir}/summary.json`;
  writeFileSync(unifiedPath, stableStringify(report), "utf8");
  writeFileSync(summaryPath, stableStringify(summary), "utf8");
  return report;
}

/** Estensione: registrare processori dopo merge (es. scoring risk-based). */
export function runAggregatePipeline(options: AggregateOptions): {
  report: UnifiedReport;
  gate: GateResult;
} {
  const { issues, summary } = aggregateIssues(options);
  const report = writeReports(options.outDir, issues, summary);
  const { failOnCriticalGt, failOnHighGt } = parseEnvGate();
  const gate = evaluateGate(summary, failOnCriticalGt, failOnHighGt);
  return { report, gate };
}

export function parseEnvGate(): { failOnCriticalGt: number; failOnHighGt: number } {
  return {
    failOnCriticalGt: Number.parseInt(process.env.FAIL_ON_CRITICAL_GT ?? "0", 10),
    failOnHighGt: Number.parseInt(process.env.FAIL_ON_HIGH_GT ?? "0", 10),
  };
}
