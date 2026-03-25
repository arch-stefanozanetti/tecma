export type IssueType = "SAST" | "SCA" | "CONTAINER" | "IAC";

export type Severity = "low" | "medium" | "high" | "critical";

export type ToolName = "semgrep" | "osv" | "trivy";

export interface NormalizedLocation {
  file: string;
  startLine?: number;
  endLine?: number;
}

export interface NormalizedIssue {
  type: IssueType;
  severity: Severity;
  file: string;
  message: string;
  fix?: string;
  tool: ToolName;
  ruleId?: string;
  cveId?: string;
  dedupeKey: string;
  locations?: NormalizedLocation[];
  rawSeverity?: string;
}

export interface IssueSummary {
  total: number;
  bySeverity: Record<Severity, number>;
  byType: Record<IssueType, number>;
  critical: number;
  high: number;
}

export interface UnifiedReport {
  generatedAt: string;
  summary: IssueSummary;
  issues: NormalizedIssue[];
}

export type PostProcessFn = (issues: NormalizedIssue[]) => NormalizedIssue[];
