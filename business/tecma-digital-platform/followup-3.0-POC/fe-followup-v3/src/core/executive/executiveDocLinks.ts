/**
 * Risolve href relativi dei markdown in docs/executive verso path sotto la root monorepo followup-3.0,
 * per costruire URL Git se è impostato VITE_FOLLOWUP_DOCS_BASE_URL.
 */
const EXECUTIVE_DIR_SEGMENTS = ["docs", "executive"];

/**
 * Normalizza un href relativo (es. ../PIANO.md, ../../fe-followup-v3/X.md) in path POSIX dalla root followup-3.0.
 */
export function resolvePathFromExecutiveHref(href: string): string | null {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return null;
  }
  if (trimmed.includes(":")) {
    return null;
  }
  const segments = [...EXECUTIVE_DIR_SEGMENTS];
  const rawParts = trimmed.split("/").filter((p) => p.length > 0 && p !== ".");
  for (const part of rawParts) {
    if (part === "..") {
      if (segments.length === 0) return null;
      segments.pop();
    } else {
      segments.push(part);
    }
  }
  if (segments.length === 0) return null;
  return segments.join("/");
}

export function buildGitDocUrl(repoRootBaseUrl: string, pathFromRepoRoot: string): string {
  const base = repoRootBaseUrl.replace(/\/+$/, "");
  const path = pathFromRepoRoot.replace(/^\/+/, "");
  return `${base}/${path}`;
}

export function getFollowupDocsBaseUrl(): string | undefined {
  const v = import.meta.env.VITE_FOLLOWUP_DOCS_BASE_URL;
  return typeof v === "string" && v.trim().length > 0 ? v.trim().replace(/\/+$/, "") : undefined;
}
