import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { followupApi } from "../../api/followupApi";
import { me as authMe } from "../../api/authApi";
import { saveProjectScope } from "../../auth/projectScope";
import { useAsync } from "../shared/useAsync";
import type { ProjectAccessProject, ProjectAccessResponse, WorkspaceRow } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { LogoTecma } from "../../components/LogoTecma";

interface ProjectAccessPageProps {
  onCompleted: () => void;
}

type LegacyWorkspaceId = "dev-1" | "demo" | "prod";

const LEGACY_WORKSPACE_LABELS: Record<LegacyWorkspaceId, string> = {
  "dev-1": "Dev-1",
  demo: "Demo",
  prod: "Production",
};

type AuthStatus = "pending" | "ok" | "fail";

type ProjectTypeFilter = "all" | "rent" | "sell";

function getProjectMode(project: ProjectAccessProject): "rent" | "sell" {
  const s = `${project.id} ${project.name ?? ""} ${project.displayName ?? ""}`.toLowerCase();
  return s.includes("rent") ? "rent" : "sell";
}

export const ProjectAccessPage = ({ onCompleted }: ProjectAccessPageProps) => {
  const loadProjectsByEmailApi = useCallback(async (inputEmail: string) => {
    const normalizedEmail = inputEmail.trim().toLowerCase();
    const result = await followupApi.getProjectsByEmail(normalizedEmail);
    if (!result.found) throw new Error(`Utente ${normalizedEmail} non trovato su Mongo.`);
    if (result.projects.length === 0) throw new Error(`Nessun progetto associato a ${normalizedEmail}.`);
    return result;
  }, []);

  const { run: runLoadProjects, data: accessData, error, isLoading: loading } = useAsync(loadProjectsByEmailApi);
  const access = accessData ?? null;

  const [authStatus, setAuthStatus] = useState<AuthStatus>("pending");
  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const didAutoLoadRef = useRef(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>("");
  const [workspaceProjectIds, setWorkspaceProjectIds] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<ProjectTypeFilter>("all");

  const canConfirm = useMemo(() => selected.length > 0 && !!access?.found && !!workspaceId, [selected.length, access?.found, workspaceId]);

  // Carica workspaces (admin) o usa legacy
  useEffect(() => {
    if (!access?.isAdmin) return;
    followupApi
      .listWorkspaces()
      .then((list) => setWorkspaces(Array.isArray(list) ? list : []))
      .catch(() => setWorkspaces([]));
  }, [access?.isAdmin]);

  // Quando arrivano i dati: imposta workspace, selected, preferenze
  useEffect(() => {
    if (!access) return;
    const normalizedEmail = access.email.trim().toLowerCase();
    sessionStorage.setItem("followup3.lastEmail", normalizedEmail);
    setSelected(access.projects.map((p) => p.id));

    let cancelled = false;
    followupApi
      .getUserPreferences(normalizedEmail)
      .then((prefs) => {
        if (cancelled || !prefs.found) return;
        const validProjectIds = access.projects.map((p) => p.id);
        const intersected = (prefs.selectedProjectIds ?? []).filter((id) => validProjectIds.includes(id));
        if (intersected.length > 0) setSelected(intersected);
        if (prefs.workspaceId) setWorkspaceId(prefs.workspaceId);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [access]);

  // Default workspace: se esistono tz_workspaces preferire il primo; altrimenti legacy (dev-1/demo)
  useEffect(() => {
    if (!access || workspaceId) return;
    if (workspaces.length > 0) {
      setWorkspaceId(workspaces[0]._id);
    } else {
      setWorkspaceId(access.isAdmin ? "dev-1" : "demo");
    }
  }, [access, workspaceId, workspaces]);

  // Carica progetti del workspace quando cambia (solo admin con tz_workspace)
  useEffect(() => {
    if (!access?.isAdmin || !workspaceId) return;
    const isLegacy = workspaceId === "dev-1" || workspaceId === "demo" || workspaceId === "prod";
    if (isLegacy) {
      setWorkspaceProjectIds(access.projects.map((p) => p.id));
      return;
    }
    followupApi
      .listWorkspaceProjects(workspaceId)
      .then((res) => {
        const ids = (res.data ?? []).map((wp) => wp.projectId);
        setWorkspaceProjectIds(ids);
      })
      .catch(() => setWorkspaceProjectIds([]));
  }, [access, workspaceId]);

  // Allinea selected ai progetti visibili quando cambia il workspace (admin + tz_workspace)
  useEffect(() => {
    if (!access?.isAdmin || workspaceProjectIds.length === 0) return;
    const wsSet = new Set(workspaceProjectIds);
    setSelected((prev) => prev.filter((id) => wsSet.has(id)));
  }, [access?.isAdmin, workspaceId, workspaceProjectIds]);

  const loadProjectsByEmail = useCallback(
    (inputEmail: string) => {
      void runLoadProjects(inputEmail);
    },
    [runLoadProjects]
  );

  useEffect(() => {
    authMe()
      .then((user) => {
        setMeEmail(user.email);
        setAuthStatus("ok");
      })
      .catch(() => {
        sessionStorage.removeItem("followup3.accessToken");
        sessionStorage.removeItem("followup3.lastEmail");
        setAuthStatus("fail");
      });
  }, []);

  useEffect(() => {
    if (didAutoLoadRef.current || !meEmail) return;
    didAutoLoadRef.current = true;
    loadProjectsByEmail(meEmail);
  }, [meEmail, loadProjectsByEmail]);

  const toggleProject = (project: ProjectAccessProject) => {
    setSelected((prev) => (prev.includes(project.id) ? prev.filter((id) => id !== project.id) : [...prev, project.id]));
  };

  const visibleProjects = useMemo(() => {
    if (!access) return [];
    let list = access.projects;
    // Admin con tz_workspace: mostra solo progetti associati al workspace (se ce ne sono)
    // Se workspaceProjectIds è vuoto, mostra tutti i progetti così l'utente può entrare e associarne
    const isTzWorkspace = workspaceId && workspaceId !== "dev-1" && workspaceId !== "demo" && workspaceId !== "prod";
    if (access.isAdmin && isTzWorkspace && workspaceProjectIds.length > 0) {
      const wsSet = new Set(workspaceProjectIds);
      list = list.filter((p) => wsSet.has(p.id));
    }
    const q = filter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (project) =>
          (project.displayName ?? "").toLowerCase().includes(q) ||
          (project.name ?? "").toLowerCase().includes(q) ||
          project.id.toLowerCase().includes(q)
      );
    }
    if (typeFilter !== "all") {
      list = list.filter((p) => getProjectMode(p) === typeFilter);
    }
    return list;
  }, [access, filter, typeFilter, workspaceProjectIds]);

  const allVisibleSelected =
    visibleProjects.length > 0 && visibleProjects.every((project) => selected.includes(project.id));

  const toggleAllVisible = () => {
    if (!visibleProjects.length) return;
    if (allVisibleSelected) {
      const remaining = selected.filter((id) => !visibleProjects.some((p) => p.id === id));
      if (remaining.length === 0) return;
      setSelected(remaining);
      return;
    }
    const merged = Array.from(new Set([...selected, ...visibleProjects.map((p) => p.id)]));
    setSelected(merged);
  };

  const confirmSelection = () => {
    if (!access || !access.found) return;
    const chosenEnv = typeof window !== "undefined" ? sessionStorage.getItem("followup3.chosenWorkspaceId") : null;
    const apiEnv: "dev-1" | "demo" | "prod" =
      chosenEnv === "dev-1" || chosenEnv === "demo" || chosenEnv === "prod"
        ? chosenEnv
        : workspaceId === "dev-1" || workspaceId === "demo" || workspaceId === "prod"
          ? (workspaceId as "dev-1" | "demo" | "prod")
          : "demo";
    if (typeof window !== "undefined") sessionStorage.removeItem("followup3.chosenWorkspaceId");
    const scope = {
      email: access.email,
      role: access.role,
      isAdmin: access.isAdmin,
      workspaceId,
      apiEnvironment: apiEnv,
      projects: access.projects,
      selectedProjectIds: selected
    };
    saveProjectScope(scope);
    void followupApi
      .saveUserPreferences(scope.email, scope.workspaceId, scope.selectedProjectIds)
      .catch(() => {
        // opzionale: non bloccare il flusso in caso di errore
      })
      .finally(() => {
        onCompleted();
      });
  };

  const goToLogin = () => {
    sessionStorage.removeItem("followup3.accessToken");
    sessionStorage.removeItem("followup3.lastEmail");
    window.location.replace(`/login?backTo=${encodeURIComponent(window.location.origin + "/")}`);
  };

  if (authStatus === "pending") {
    return (
      <div className="min-h-screen flex bg-auth-page text-foreground font-body items-center justify-center">
        <div className="flex flex-col items-center">
          <p className="text-sm text-muted-foreground">Verifica accesso…</p>
          <div className="mt-3 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden />
        </div>
      </div>
    );
  }

  if (authStatus === "fail") {
    return (
      <div className="min-h-screen flex bg-auth-page text-foreground font-body items-center justify-center">
        <div className="flex flex-col items-center gap-4 rounded-ui glass-panel px-8 py-8 shadow-panel max-w-md">
          <p className="text-center text-foreground font-medium">Sessione non valida o scaduta</p>
          <p className="text-center text-sm text-muted-foreground">
            Effettua di nuovo l’accesso per continuare.
          </p>
          <Button onClick={goToLogin} className="w-full">
            Vai al login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex overflow-hidden bg-auth-page text-foreground font-body">
      <div className="hidden lg:flex w-5/12 min-w-0 flex-col justify-between border-r border-border/60 bg-auth-sidebar px-12 py-12 overflow-hidden">
        <div>
          <LogoTecma className="h-12 w-12 opacity-90" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Project access</p>
          <h1 className="mt-4 text-3xl font-normal leading-tight text-card-foreground">
            Scegli i progetti
            <br />
            con cui lavorare oggi.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Ogni utente può accedere a uno o più progetti. Puoi filtrare, selezionare tutti o solo quelli su cui stai
            lavorando. Followup ricorderà questa scelta per i prossimi accessi.
          </p>
        </div>

        <div className="space-y-3 text-xs text-muted-foreground">
          <p className="font-semibold text-card-foreground">Ambiente e API</p>
          <p>
            L’ambiente scelto al login determina quali dati vedi: <strong>Dev-1</strong> → API e DB dev-1 (biz-tecma-dev1),{" "}
            <strong>Demo</strong> → biz-tecma-demo-prod, <strong>Production</strong> → biz-tecma-prod. Le chiamate usano sempre l’ambiente selezionato.
          </p>
          <p className="font-semibold text-card-foreground mt-2">Suggerimenti</p>
          <ul className="space-y-1">
            <li>• Filtra per Rent/Sell e cerca per nome, poi seleziona i progetti.</li>
            <li>• Puoi cambiare ambiente e progetti dal menu in alto a destra.</li>
          </ul>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center px-4 py-6 lg:px-10 lg:py-8 overflow-hidden">
        <div className="w-full max-w-4xl flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="glass-panel rounded-ui px-6 py-6 shadow-panel flex flex-col min-h-0 flex-1 overflow-hidden">
            <header className="flex-shrink-0 mb-4">
              <h2 className="text-xl font-semibold text-foreground">Seleziona i progetti</h2>
              {access?.found && (
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-card-foreground">{access.email}</span>
                  {access.isAdmin && (
                    <span className="ml-2 rounded-full bg-sidebar-accent px-2 py-0.5 text-xs text-primary">admin</span>
                  )}
                  {access.role != null && access.role !== "" && access.role.toLowerCase() !== "admin" && (
                    <span className="ml-2 text-muted-foreground">{access.role}</span>
                  )}
                </p>
              )}
            </header>

            <section className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
              <div className="flex-shrink-0 flex flex-wrap items-center gap-4">
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      readOnly
                      value={meEmail ?? ""}
                      className="h-9 rounded-lg bg-muted min-w-0 max-w-[220px]"
                    />
                    {meEmail && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => void loadProjectsByEmail(meEmail)}
                        className="h-9 flex-shrink-0"
                      >
                        {loading ? "Ricarica…" : "Ricarica progetti"}
                      </Button>
                    )}
                  </div>
                </div>
                {access?.isAdmin && (
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                      Workspace
                    </label>
                    <select
                      value={workspaceId}
                      onChange={(e) => setWorkspaceId(e.target.value)}
                      className="h-9 rounded-lg border border-input bg-muted px-3 text-sm font-medium text-foreground min-w-[180px] focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {workspaces.map((ws) => (
                        <option key={ws._id} value={ws._id}>
                          {ws.name ?? ws._id}
                        </option>
                      ))}
                      {workspaces.length > 0 && (
                        <option disabled>———</option>
                      )}
                      <option value="dev-1">{LEGACY_WORKSPACE_LABELS["dev-1"]}</option>
                      <option value="demo">{LEGACY_WORKSPACE_LABELS.demo}</option>
                      <option value="prod">{LEGACY_WORKSPACE_LABELS.prod}</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <div className="flex flex-wrap items-center gap-2 gap-y-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Progetti
                  </span>
                  {visibleProjects.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {selected.length} di {visibleProjects.length} selezionati
                    </span>
                  )}
                  <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <span className="text-xs text-muted-foreground">Tipo:</span>
                    {(["all", "rent", "sell"] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTypeFilter(t)}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                          typeFilter === t
                            ? "border-primary bg-sidebar-accent text-primary"
                            : "border-border bg-background text-foreground hover:bg-muted"
                        )}
                      >
                        {t === "all" ? "Tutti" : t === "rent" ? "Rent" : "Sell"}
                      </button>
                    ))}
                    <Input
                      type="text"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Cerca nome o codice"
                      className="h-9 text-xs min-w-0 w-36 sm:w-44"
                    />
                    {access?.projects.length ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={toggleAllVisible}
                        className="h-9 flex-shrink-0"
                      >
                        {allVisibleSelected ? "Deseleziona" : "Seleziona tutti"}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-ui border border-border bg-background/80">
                  {!access && !error && (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      {meEmail ? "Caricamento progetti..." : "Caricamento..."}
                    </div>
                  )}
                  {error && (
                    <div className="border-b border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
                  )}
                  {access?.found && visibleProjects.length === 0 && !error && (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      Nessun progetto corrisponde al filtro. Prova a cambiare la ricerca.
                    </div>
                  )}
                  {access?.found && visibleProjects.length > 0 && (
                    <ul className="divide-y divide-border">
                      {visibleProjects.map((project) => {
                        const isProjectSelected = selected.includes(project.id);
                        const mode = getProjectMode(project);
                        return (
                          <li key={project.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleProject(project)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  toggleProject(project);
                                }
                              }}
                              className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted"
                            >
                              <span onClick={(e) => e.stopPropagation()} className="flex-none">
                                <Checkbox
                                  checked={isProjectSelected}
                                  onCheckedChange={() => toggleProject(project)}
                                  size="sm"
                                  aria-label={project.displayName || project.name}
                                />
                              </span>
                              <div className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{project.displayName || project.name}</span>
                                <span className="text-[11px] text-muted-foreground">{project.id}</span>
                              </div>
                              <span
                                className={cn(
                                  "flex-shrink-0 rounded-full px-2 py-0.5 text-[11px]",
                                  mode === "rent" ? "bg-emerald-100 text-emerald-800" : "bg-sidebar-accent text-sidebar-accent-foreground"
                                )}
                              >
                                {mode === "rent" ? "Rent" : "Sell"}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </section>

            <footer className="flex-shrink-0 mt-6 pt-4 border-t border-border flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground order-2 sm:order-1">
                Puoi cambiare progetti e ambiente dal menu in alto a destra.
              </p>
              <Button
                type="button"
                onClick={confirmSelection}
                disabled={!canConfirm || loading}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                Entra in Followup
              </Button>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};
