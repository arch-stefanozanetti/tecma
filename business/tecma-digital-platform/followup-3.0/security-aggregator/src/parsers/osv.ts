import { computeDedupeKey } from "../dedupe.js";
import { normalizeOsvSeverity } from "../severity.js";
import type { NormalizedIssue } from "../schema.js";
import type { ScannerAdapter } from "../adapters/types.js";

interface OsvPackage {
  name?: string;
  version?: string;
  ecosystem?: string;
}

interface OsvVuln {
  id?: string;
  summary?: string;
  details?: string;
  severity?: { type?: string; score?: string }[] | string;
  database_specific?: { severity?: string };
}

interface OsvPackageBlock {
  package?: OsvPackage;
  vulnerabilities?: OsvVuln[];
  source?: { path?: string };
}

interface OsvResult {
  packages?: OsvPackageBlock[];
  source?: { path?: string };
}

interface OsvReport {
  results?: OsvResult[];
}

function vulnSeverity(v: OsvVuln): string | undefined {
  if (typeof v.severity === "string") return v.severity;
  if (Array.isArray(v.severity) && v.severity[0]?.type) return v.severity[0].type;
  return v.database_specific?.severity;
}

export const osvAdapter: ScannerAdapter = {
  tool: "osv",
  parse(raw: unknown, _sourcePath: string): NormalizedIssue[] {
    const data = raw as OsvReport;
    const results = data.results ?? [];
    const out: NormalizedIssue[] = [];
    for (const block of results) {
      const pkgs = block.packages ?? [];
      for (const pkgBlock of pkgs) {
        const pkg = pkgBlock.package;
        const pkgName = pkg?.name ?? "unknown";
        const pkgVer = pkg?.version ?? "";
        const ecosystem = pkg?.ecosystem ?? "";
        const sourcePath =
          pkgBlock.source?.path ?? block.source?.path ?? "package-lock.json";
        const vulns = pkgBlock.vulnerabilities ?? [];
        for (const v of vulns) {
          const cveId = v.id ?? "unknown";
          const rawSev = vulnSeverity(v);
          const severity = normalizeOsvSeverity(rawSev);
          const message =
            v.summary ?? v.details ?? `${pkgName}@${pkgVer} — ${cveId}`;
          const dedupeKey = computeDedupeKey([
            "osv",
            cveId,
            pkgName,
            pkgVer,
            ecosystem,
            sourcePath,
          ]);
          out.push({
            type: "SCA",
            severity,
            file: sourcePath,
            message,
            fix: undefined,
            tool: "osv",
            cveId,
            ruleId: cveId,
            dedupeKey,
            rawSeverity: rawSev,
          });
        }
      }
    }
    return out;
  },
};
