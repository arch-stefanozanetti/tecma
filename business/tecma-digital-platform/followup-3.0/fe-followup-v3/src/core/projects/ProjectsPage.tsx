/**
 * Pagina lista progetti del workspace corrente.
 * Per ogni progetto mostra nome, modalità e link alla configurazione.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";
import { Building2, ExternalLink, Plus, RefreshCcw, Settings } from "lucide-react";

interface ProjectItem {
  id: string;
  projectId: string;
  name?: string;
  displayName?: string;
  mode?: string;
}

const MODE_LABEL: Record<string, string> = {
  rent: "Affitto",
  sell: "Vendita",
};

export const ProjectsPage = () => {
  const navigate = useNavigate();
  const { workspaceId, isAdmin } = useWorkspace();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await followupApi.listWorkspaceProjects(workspaceId);
      setProjects((res.data ?? []) as unknown as ProjectItem[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore caricamento");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [workspaceId]);

  const goToProject = (projectId: string) => {
    navigate(`/projects/${projectId}?workspaceId=${encodeURIComponent(workspaceId ?? "")}`);
  };

  const effectiveId = (p: ProjectItem) => p.projectId ?? p.id;
  const effectiveName = (p: ProjectItem) => p.displayName ?? p.name ?? effectiveId(p);

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold text-foreground">Progetti</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Progetti attivi nel workspace corrente. Clicca su un progetto per configurarlo.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => load()}>
              <RefreshCcw className="h-4 w-4" />
              Aggiorna
            </Button>
            {isAdmin && (
              <Button size="sm" className="gap-2" onClick={() => navigate("/?section=workspaces")}>
                <Plus className="h-4 w-4" />
                Nuovo progetto
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6">
          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Caricamento…</p>
          ) : projects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 px-8 py-16 text-center">
              <Building2 className="mx-auto h-10 w-10 text-muted-foreground/30" />
              <p className="mt-3 text-sm text-muted-foreground">
                Nessun progetto nel workspace corrente.
              </p>
              {isAdmin && (
                <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => navigate("/?section=workspaces")}>
                  <Plus className="h-4 w-4" />
                  Aggiungi un progetto
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border bg-background shadow-panel">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border text-left text-sm font-normal text-muted-foreground">
                    <th className="px-4 py-3 font-normal">Progetto</th>
                    <th className="px-4 py-3 font-normal">ID</th>
                    <th className="px-4 py-3 font-normal">Modalità</th>
                    <th className="w-10 px-4 py-3 font-normal" />
                  </tr>
                </thead>
                <tbody>
                  {projects.map((proj) => {
                    const pid = effectiveId(proj);
                    const name = effectiveName(proj);
                    const mode = (proj.mode as string) ?? "";
                    return (
                      <tr
                        key={pid}
                        className="group border-b border-border text-sm text-foreground hover:bg-muted cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() => goToProject(pid)}
                        onKeyDown={(e) => e.key === "Enter" && goToProject(pid)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground">{name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-muted-foreground">{pid}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              mode === "rent"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-green-50 text-green-700"
                            )}
                          >
                            {MODE_LABEL[mode] ?? mode}
                          </span>
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => goToProject(pid)}
                            aria-label="Configura progetto"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
