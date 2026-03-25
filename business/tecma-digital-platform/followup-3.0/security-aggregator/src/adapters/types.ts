import type { NormalizedIssue } from "../schema.js";

export interface ScannerAdapter {
  readonly tool: NormalizedIssue["tool"];
  parse(raw: unknown, sourcePath: string): NormalizedIssue[];
}
