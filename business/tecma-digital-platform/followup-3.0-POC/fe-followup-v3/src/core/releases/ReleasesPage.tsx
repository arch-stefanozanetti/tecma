/**
 * Pagina Release e novità.
 *
 * Fonte primaria: CHANGELOG locale (src/core/releases/changelog.ts) — sempre visibile, aggiornato ad ogni release.
 * Fonte secondaria opzionale: GitHub Releases API (VITE_GITHUB_RELEASES_REPO) — mergiato con il changelog locale.
 *
 * COME AGGIORNARE:
 *  1. Implementa la feature / fix.
 *  2. Aggiungi una nuova entry in changelog.ts (in cima all'array).
 *  3. Aggiorna "version" in package.json (FE) e be-followup-v3/package.json (BE) con lo stesso numero.
 *  4. La versione compare automaticamente nel badge "Versione attuale".
 */
import { useCallback, useEffect, useState } from "react";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { RefreshCcw, ExternalLink, Zap, Wrench, CheckCircle2, AlertTriangle } from "lucide-react";
import { CHANGELOG, CURRENT_VERSION, type ChangelogEntry, type ReleaseType, type ChangeType } from "./changelog";

const GITHUB_RELEASES_REPO =
  typeof import.meta.env.VITE_GITHUB_RELEASES_REPO === "string" && import.meta.env.VITE_GITHUB_RELEASES_REPO
    ? import.meta.env.VITE_GITHUB_RELEASES_REPO
    : "";

const RELEASE_TYPE_CONFIG: Record<ReleaseType, { label: string; badgeClass: string }> = {
  major: { label: "Major", badgeClass: "bg-red-50 text-red-700 border-red-200" },
  minor: { label: "Nuove funzionalità", badgeClass: "bg-blue-50 text-blue-700 border-blue-200" },
  patch: { label: "Correzioni", badgeClass: "bg-muted text-muted-foreground border-border" },
};

const CHANGE_TYPE_CONFIG: Record<ChangeType, { icon: React.ElementType; label: string; className: string }> = {
  feature: { icon: Zap, label: "Nuova funzionalità", className: "text-blue-600" },
  improvement: { icon: CheckCircle2, label: "Miglioramento", className: "text-green-600" },
  fix: { icon: Wrench, label: "Correzione", className: "text-amber-600" },
  breaking: { icon: AlertTriangle, label: "Breaking change", className: "text-red-600" },
};

function parseReleaseType(tagName: string): ReleaseType {
  const match = tagName.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return "patch";
  const [, , minor, patch] = match.map(Number);
  if (patch !== 0) return "patch";
  if (minor !== 0) return "minor";
  return "major";
}

interface GithubEntry {
  version: string;
  date: string;
  title: string;
  releaseType: ReleaseType;
  body: string;
  url: string;
  fromGithub: true;
}

const formatDate = (iso: string) => {
  try {
    return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
  } catch {
    return iso;
  }
};

type DisplayEntry = ChangelogEntry & { url?: string; body?: string; fromGithub?: boolean };

export const ReleasesPage = () => {
  const [githubEntries, setGithubEntries] = useState<GithubEntry[]>([]);
  const [loadingGithub, setLoadingGithub] = useState(!!GITHUB_RELEASES_REPO);
  const [githubError, setGithubError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReleaseType | "all">("all");
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set([CURRENT_VERSION]));

  const loadGithub = useCallback(async () => {
    if (!GITHUB_RELEASES_REPO) return;
    setLoadingGithub(true);
    setGithubError(null);
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_RELEASES_REPO}/releases?per_page=30`);
      if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
      const data = (await res.json()) as Array<{
        tag_name: string; name: string | null; body: string | null; published_at: string | null; html_url: string;
      }>;
      setGithubEntries(
        data.map((r) => ({
          version: r.tag_name.replace(/^v/, ""),
          date: r.published_at ? r.published_at.slice(0, 10) : "",
          title: r.name ?? r.tag_name,
          releaseType: parseReleaseType(r.tag_name),
          body: r.body ?? "",
          url: r.html_url,
          fromGithub: true,
        }))
      );
    } catch (e) {
      setGithubError(e instanceof Error ? e.message : "Errore GitHub API");
    } finally {
      setLoadingGithub(false);
    }
  }, []);

  useEffect(() => { void loadGithub(); }, [loadGithub]);

  // Merge: changelog locale + GitHub (le versioni GitHub sovrascrivono quelle locali con lo stesso numero)
  const allEntries: DisplayEntry[] = (() => {
    const githubByVersion = new Map(githubEntries.map((e) => [e.version, e]));
    const localVersions = new Set(CHANGELOG.map((e) => e.version));
    const merged: DisplayEntry[] = CHANGELOG.map((local) => {
      const gh = githubByVersion.get(local.version);
      return gh ? { ...local, url: gh.url, body: gh.body } : local;
    });
    // Aggiungi release GitHub che non sono nel changelog locale
    for (const gh of githubEntries) {
      if (!localVersions.has(gh.version)) {
        merged.push({ ...gh, changes: [], body: gh.body });
      }
    }
    merged.sort((a, b) => {
      const va = a.version.split(".").map(Number);
      const vb = b.version.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        const diff = (vb[i] ?? 0) - (va[i] ?? 0);
        if (diff !== 0) return diff;
      }
      return 0;
    });
    return merged;
  })();

  const filtered = filter === "all" ? allEntries : allEntries.filter((e) => e.releaseType === filter);
  const appVersion = import.meta.env.VITE_APP_VERSION ?? CURRENT_VERSION;

  const toggleExpand = (version: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version);
      else next.add(version);
      return next;
    });
  };

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Release e novità</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Cronologia delle release con nuove funzionalità, miglioramenti e correzioni.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Versione attuale</span>
            <Badge variant="secondary" className="font-mono text-sm">
              v{appVersion}
            </Badge>
            {GITHUB_RELEASES_REPO && (
              <Button variant="outline" size="sm" className="min-h-11 gap-2" onClick={() => loadGithub()}>
                <RefreshCcw className={cn("h-3.5 w-3.5", loadingGithub && "animate-spin")} />
                GitHub
              </Button>
            )}
          </div>
        </div>

        {/* Filtri */}
        <div className="mt-6 flex flex-wrap gap-2">
          {(["all", "major", "minor", "patch"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                filter === t
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              )}
            >
              {t === "all" ? "Tutte" : RELEASE_TYPE_CONFIG[t].label}
            </button>
          ))}
        </div>

        {githubError && (
          <p className="mt-4 text-xs text-amber-600">
            GitHub API: {githubError} — visualizzando solo changelog locale.
          </p>
        )}

        {/* Lista release */}
        <div className="mt-8 space-y-4">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Nessuna release trovata.</p>
          )}
          {filtered.map((entry, idx) => {
            const isExpanded = expandedVersions.has(entry.version);
            const typeCfg = RELEASE_TYPE_CONFIG[entry.releaseType];
            const isLatest = idx === 0 && filter === "all";

            return (
              <article
                key={entry.version}
                className={cn(
                  "rounded-lg border bg-card transition-shadow",
                  isLatest ? "border-primary/30 shadow-md" : "border-border shadow-sm"
                )}
              >
                {/* Header release */}
                <button
                  type="button"
                  onClick={() => toggleExpand(entry.version)}
                  className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-foreground">v{entry.version}</span>
                    {isLatest && (
                      <Badge variant="default" className="text-xs">Ultima</Badge>
                    )}
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        typeCfg.badgeClass
                      )}
                    >
                      {typeCfg.label}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatDate(entry.date)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.url && (
                      <a
                        href={entry.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                        title="Vedi su GitHub"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <span className="text-muted-foreground text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Titolo */}
                <div className="px-5 pb-1">
                  <h2 className="text-base font-medium text-foreground">{entry.title}</h2>
                </div>

                {/* Dettaglio (espandibile) */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-2">
                    {entry.changes.length > 0 && (
                      <ul className="space-y-2 mt-3">
                        {entry.changes.map((change, i) => {
                          const changeCfg = CHANGE_TYPE_CONFIG[change.type];
                          const Icon = changeCfg.icon;
                          return (
                            <li key={i} className="flex items-start gap-2.5 text-sm">
                              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", changeCfg.className)} />
                              <span className="text-foreground leading-relaxed">{change.text}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {/* Body da GitHub (se disponibile e senza changes strutturate) */}
                    {entry.body && entry.changes.length === 0 && (
                      <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {entry.body}
                      </p>
                    )}
                    {entry.changes.length === 0 && !entry.body && (
                      <p className="mt-3 text-sm text-muted-foreground italic">
                        Nessun dettaglio disponibile.
                      </p>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>

        {/* Note operative */}
        <div className="mt-10 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Come aggiornare le release notes
          </p>
          <p className="text-xs text-muted-foreground">
            Aggiungere una nuova entry in cima a{" "}
            <code className="rounded bg-muted px-1">fe-followup-v3/src/core/releases/changelog.ts</code>{" "}
            e aggiornare <code className="rounded bg-muted px-1">version</code> in entrambi i{" "}
            <code className="rounded bg-muted px-1">package.json</code>.
          </p>
        </div>
      </div>
    </div>
  );
};
