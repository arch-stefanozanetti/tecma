import type { UnifiedReport } from "./schema.js";

const BOT_MARKER = "<!-- security-report-bot -->";

export function formatPrComment(report: UnifiedReport, topN = 8): string {
  const { summary, issues } = report;
  const lines: string[] = [
    BOT_MARKER,
    "",
    "## Security report (FollowUp 3.0)",
    "",
    `- **Totale issue (deduplicate):** ${summary.total}`,
    `- **Critical:** ${summary.critical}`,
    `- **High:** ${summary.high}`,
    `- **Per tipo:** SAST ${summary.byType.SAST}, SCA ${summary.byType.SCA}, CONTAINER ${summary.byType.CONTAINER}, IAC ${summary.byType.IAC}`,
    "",
  ];
  if (issues.length === 0) {
    lines.push("_Nessun issue dai tool configurati in questo run._");
    return lines.join("\n");
  }
  lines.push("### Top issue");
  lines.push("");
  const top = issues.slice(0, topN);
  top.forEach((i, idx) => {
    const ref = i.cveId ?? i.ruleId ?? i.dedupeKey.slice(0, 12);
    lines.push(
      `${idx + 1}. **${i.severity.toUpperCase()}** (${i.tool} / ${i.type}) — \`${i.file}\` — ${i.message.slice(0, 200)}${i.message.length > 200 ? "…" : ""} _(${ref})_`,
    );
  });
  lines.push("");
  lines.push("_Report completo: artifact `unified-report.json` nella run Actions._");
  return lines.join("\n");
}
