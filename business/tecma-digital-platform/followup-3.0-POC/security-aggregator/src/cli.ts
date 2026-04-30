#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import {
  evaluateGate,
  parseEnvGate,
  runAggregatePipeline,
} from "./aggregate.js";
import { formatPrComment } from "./pr-markdown.js";
import { renderSecurityDashboardHtml } from "./render-dashboard-html.js";
import type { IssueSummary, UnifiedReport } from "./schema.js";

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

function loadUnifiedReport(path: string): UnifiedReport {
  const raw = JSON.parse(readFileSync(path, "utf8")) as UnifiedReport;
  return raw;
}

function main(): void {
  const [, , cmd, ...rest] = process.argv;
  const args = parseArgs(rest);

  if (cmd === "aggregate") {
    const outDir = (args["out-dir"] as string) || "security-reports";
    const softFail =
      args["soft-fail"] === true || args["soft-fail"] === "true";
    const { report, gate } = runAggregatePipeline({
      semgrepReport: args["semgrep"] as string | undefined,
      osvReport: args["osv"] as string | undefined,
      trivyReport: args["trivy"] as string | undefined,
      outDir,
    });
    const prPath = args["pr-body-out"] as string | undefined;
    if (prPath) {
      writeFileSync(prPath, formatPrComment(report), "utf8");
    }
    if (!gate.pass) {
      console.error(`Gate fallita: ${gate.reason}`);
      if (!softFail) {
        process.exit(1);
      }
    }
    console.log(
      JSON.stringify(
        { ok: gate.pass, summary: report.summary, outDir, gate },
        null,
        2,
      ),
    );
    return;
  }

  if (cmd === "gate") {
    const summaryPath = (args["summary"] as string) || "security-reports/summary.json";
    const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as IssueSummary;
    const { failOnCriticalGt, failOnHighGt } = parseEnvGate();
    const gate = evaluateGate(summary, failOnCriticalGt, failOnHighGt);
    if (!gate.pass) {
      console.error(`Gate fallita: ${gate.reason}`);
      process.exit(1);
    }
    console.log(JSON.stringify({ ok: true, gate }, null, 2));
    return;
  }

  if (cmd === "pr-body") {
    const reportPath = (args["report"] as string) || "security-reports/unified-report.json";
    const report = loadUnifiedReport(reportPath);
    process.stdout.write(formatPrComment(report));
    return;
  }

  if (cmd === "dashboard") {
    const reportPath = (args["report"] as string) || "security-reports/unified-report.json";
    const outPath = (args["out"] as string) || "security-reports/security-dashboard.html";
    const report = loadUnifiedReport(reportPath);
    writeFileSync(outPath, renderSecurityDashboardHtml(report), "utf8");
    console.log(JSON.stringify({ ok: true, out: outPath }, null, 2));
    return;
  }

  console.error(
    "Uso:\n  security-aggregator aggregate [--semgrep P] [--osv P] [--trivy P] --out-dir D [--pr-body-out F] [--soft-fail]\n  security-aggregator gate [--summary security-reports/summary.json]\n  security-aggregator pr-body [--report unified-report.json]\n  security-aggregator dashboard [--report unified-report.json] [--out security-dashboard.html]",
  );
  process.exit(2);
}

main();
