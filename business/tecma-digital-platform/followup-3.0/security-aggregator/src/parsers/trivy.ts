import { computeDedupeKey } from "../dedupe.js";
import { normalizeTrivySeverity } from "../severity.js";
import type { NormalizedIssue } from "../schema.js";
import type { ScannerAdapter } from "../adapters/types.js";

interface TrivyVuln {
  VulnerabilityID?: string;
  PkgName?: string;
  InstalledVersion?: string;
  Severity?: string;
  Title?: string;
  Description?: string;
  PrimaryURL?: string;
}

interface TrivyMisconf {
  ID?: string;
  Title?: string;
  Description?: string;
  Severity?: string;
  CauseMetadata?: { Resource?: string };
}

interface TrivyResult {
  Target?: string;
  Class?: string;
  Type?: string;
  Vulnerabilities?: TrivyVuln[];
  Misconfigurations?: TrivyMisconf[];
}

interface TrivyReport {
  Results?: TrivyResult[];
}

/** Vulnerabilità pacchetti: SCA su fs; CONTAINER su image/os-pkgs a rootfs. */
function vulnerabilityIssueType(r: TrivyResult): "SCA" | "CONTAINER" {
  const c = (r.Class ?? "").toLowerCase();
  if (c === "os-pkgs" || c === "vulnerability") return "CONTAINER";
  return "SCA";
}

export const trivyAdapter: ScannerAdapter = {
  tool: "trivy",
  parse(raw: unknown, _sourcePath: string): NormalizedIssue[] {
    const data = raw as TrivyReport;
    const results = data.Results ?? [];
    const out: NormalizedIssue[] = [];
    for (const r of results) {
      const target = r.Target ?? "";
      for (const v of r.Vulnerabilities ?? []) {
        const cveId = v.VulnerabilityID ?? "unknown";
        const rawSev = v.Severity;
        const severity = normalizeTrivySeverity(rawSev);
        const pkg = v.PkgName ?? "";
        const ver = v.InstalledVersion ?? "";
        const message = v.Title ?? v.Description ?? cveId;
        const fixHint = v.PrimaryURL ? `Vedi ${v.PrimaryURL}` : undefined;
        const dedupeKey = computeDedupeKey([
          "trivy",
          "vuln",
          cveId,
          target,
          pkg,
          ver,
        ]);
        out.push({
          type: vulnerabilityIssueType(r),
          severity,
          file: target,
          message: pkg ? `${message} (${pkg}@${ver})` : message,
          fix: fixHint,
          tool: "trivy",
          cveId,
          ruleId: cveId,
          dedupeKey,
          rawSeverity: rawSev,
        });
      }
      for (const m of r.Misconfigurations ?? []) {
        const ruleId = m.ID ?? m.Title ?? "misconfig";
        const rawSev = m.Severity;
        const severity = normalizeTrivySeverity(rawSev);
        const message = m.Title ?? m.Description ?? ruleId;
        const res = m.CauseMetadata?.Resource;
        const dedupeKey = computeDedupeKey([
          "trivy",
          "misconf",
          ruleId,
          target,
          res ?? "",
        ]);
        out.push({
          type: "IAC",
          severity,
          file: target,
          message,
          fix: res ? `Risorsa: ${res}` : undefined,
          tool: "trivy",
          ruleId,
          dedupeKey,
          rawSeverity: rawSev,
        });
      }
    }
    return out;
  },
};
