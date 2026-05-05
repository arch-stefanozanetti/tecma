import { isTecmaPlatformAdmin } from '@followup/shared-rbac';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { SupportErrorReport } from '../../components/support/SupportErrorReport';
import { LogoTecma } from '../../components/LogoTecma';
import { Button } from '../../components/ui/button';
import { Checkbox } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  handleSessionExpired,
  isTokenExpired,
  isRecoverableSessionError,
  type SessionExpiredNotice,
} from '../../lib/authSession';
import { sessionOrchestrator } from '../../core/session/session-orchestrator';
import { http, normalizeApiError } from '../../lib/http';
import type { NormalizedApiError } from '../../lib/httpError';
import { parseMePayload } from '../../lib/parseMePayload';
import { cn } from '../../lib/utils';

export interface ProjectAccessProject {
  id: string;
  name: string;
  displayName?: string;
  mode?: string;
}

interface ProjectAccessPageProps {
  accessToken: string;
  /** Profilo dal POST /auth/login: evita di tornare al login se GET /auth/me fallisce solo per x-api-key mancante. */
  initialProfile?: { id: string; email: string; systemRole: string } | null;
  onContinue: (projectIds: string[]) => void;
  /** Se /auth/me fallisce: pulizia sessione e ritorno al login (niente schermata intermedia). */
  onSessionInvalid?: (notice?: SessionExpiredNotice) => void;
}

/** Valore sentinella per il Select Radix (nessun workspace ancora scelto). */
const WORKSPACE_SELECT_PLACEHOLDER = '__workspace_placeholder__';

type AuthStatus = 'pending' | 'ok' | 'fail';

type ProjectTypeFilter = 'all' | 'rent' | 'sell';

interface WorkspaceRow {
  _id: string;
  name?: string;
}

interface ProjectsResponse {
  data: Array<{
    _id: string;
    name: string;
    displayName?: string;
    code?: string;
    mode?: string;
    workspaceId?: string;
  }>;
}

interface WorkspacesResponse {
  data: WorkspaceRow[];
}

interface PreferencesResponse {
  data: { projectIds: string[] };
}

function projectMode(project: ProjectAccessProject): 'rent' | 'sell' {
  return String(project.mode ?? '').toLowerCase() === 'rent' ? 'rent' : 'sell';
}

function mapApiProject(p: {
  _id: string;
  name: string;
  displayName?: string;
  code?: string;
  mode?: string;
}): ProjectAccessProject {
  const display =
    typeof p.displayName === 'string' && p.displayName.trim() !== ''
      ? p.displayName.trim()
      : p.name;
  const base: ProjectAccessProject = {
    id: p._id,
    name: p.name,
    displayName: display,
  };
  if (p.mode != null && p.mode !== '') {
    return { ...base, mode: p.mode };
  }
  return base;
}

export const ProjectAccessPage = ({
  accessToken,
  initialProfile = null,
  onContinue,
  onSessionInvalid,
}: ProjectAccessPageProps) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>(() =>
    initialProfile != null ? 'ok' : 'pending',
  );
  const [meEmail, setMeEmail] = useState<string | null>(() =>
    initialProfile != null ? initialProfile.email.trim().toLowerCase() : null,
  );
  const [meUserId, setMeUserId] = useState<string | null>(() => initialProfile?.id ?? null);
  const [isAdmin, setIsAdmin] = useState(() => isTecmaPlatformAdmin(initialProfile?.systemRole));
  const [apiConfigError, setApiConfigError] = useState<NormalizedApiError | null>(null);
  const [projects, setProjects] = useState<ProjectAccessProject[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem('followup.workspaceId') ?? '';
  });
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<ProjectTypeFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [workspacesError, setWorkspacesError] = useState<NormalizedApiError | null>(null);
  const [workspacesLoading, setWorkspacesLoading] = useState(true);

  /** Chiamate API post-login non riuscite: tendina workspace vuota ma non è “nessun workspace assegnato”. */
  const apiCallsDegraded = apiConfigError != null || workspacesError != null;
  const degradedError = apiConfigError ?? workspacesError;

  const expireSession = useCallback(
    (e: unknown) => {
      const notice = handleSessionExpired(e);
      if (onSessionInvalid != null) {
        onSessionInvalid(notice);
        return;
      }
      window.location.reload();
    },
    [onSessionInvalid],
  );

  const backToLogin = useCallback(() => {
    void sessionOrchestrator.invalidateSession({
      reason: 'manual_logout',
      source: 'project_access',
      redirectToLogin: true,
      strategy: 'auth-only',
    });
    if (onSessionInvalid != null) {
      onSessionInvalid({
        reason: 'session_expired',
        message: 'La sessione è scaduta. Accedi di nuovo per continuare.',
      });
      return;
    }
    window.location.reload();
  }, [onSessionInvalid]);

  const access = useMemo(() => {
    if (meEmail == null) return null;
    return {
      found: true as const,
      email: meEmail,
      isAdmin,
      role: '',
      projects,
    };
  }, [meEmail, isAdmin, projects]);

  const loadProjects = useCallback(
    async (userId: string | null, wsId: string, tecmaPlatformAdmin: boolean) => {
      if (userId == null) {
        setProjects([]);
        setLoading(false);
        setError(null);
        return;
      }
      const trimmedWorkspaceId = wsId.trim();
      if (!tecmaPlatformAdmin && trimmedWorkspaceId === '') {
        setProjects([]);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const path =
          trimmedWorkspaceId !== ''
            ? `/projects?workspaceId=${encodeURIComponent(trimmedWorkspaceId)}&userId=${encodeURIComponent(userId)}`
            : tecmaPlatformAdmin
              ? '/projects'
              : '';
        if (path === '') {
          setProjects([]);
          setLoading(false);
          return;
        }
        const res = await http<ProjectsResponse>(path, { method: 'GET', accessToken });
        const list = (res.data ?? []).map(mapApiProject);
        setProjects(list);
        setSelected((prev) => {
          if (prev.length === 0) return list.map((p) => p.id);
          const allowed = new Set(list.map((p) => p.id));
          return prev.filter((id) => allowed.has(id));
        });
      } catch (e) {
        if (isRecoverableSessionError(e)) {
          expireSession(e);
          return;
        }
        setError(normalizeApiError(e));
        setProjects([]);
      } finally {
        setLoading(false);
      }
    },
    [accessToken],
  );

  useEffect(() => {
    if (isTokenExpired(accessToken)) {
      void sessionOrchestrator.invalidateSession({
        reason: 'token_precheck',
        source: 'bootstrap',
        redirectToLogin: true,
        strategy: 'auth-only',
      });
      if (onSessionInvalid != null) {
        onSessionInvalid({
          reason: 'session_expired',
          message: 'La sessione è scaduta. Accedi di nuovo per continuare.',
        });
      } else {
        window.location.reload();
      }
      return;
    }
    let cancelled = false;
    const run = async () => {
      if (initialProfile == null) {
        setAuthStatus('pending');
      }
      try {
        const me = await http<unknown>('/auth/me', { method: 'GET', accessToken });
        if (cancelled) return;
        const parsed = parseMePayload(me);
        if (parsed == null) {
          if (initialProfile != null) {
            if (!cancelled) {
              const email = initialProfile.email.trim().toLowerCase();
              setMeEmail(email);
              setMeUserId(initialProfile.id);
              setIsAdmin(isTecmaPlatformAdmin(initialProfile.systemRole));
              setAuthStatus('ok');
              setApiConfigError({
                category: 'system',
                reason: 'server_error',
                endpoint: '/auth/me',
                method: 'GET',
                userMessage: 'Non riusciamo a completare la verifica del profilo.',
                technicalMessage:
                  'Il backend non ha restituito id/email in /auth/me nel formato atteso.',
              });
            }
            return;
          }
          if (!cancelled) setAuthStatus('fail');
          return;
        }
        setMeEmail(parsed.email);
        setMeUserId(parsed.id);
        setIsAdmin(isTecmaPlatformAdmin(parsed.systemRole));
        window.sessionStorage.setItem('followup3.lastEmail', parsed.email);
        setAuthStatus('ok');
        setApiConfigError(null);
      } catch (e) {
        if (isRecoverableSessionError(e)) {
          if (!cancelled) expireSession(e);
          return;
        }
        /* Profilo login già noto: restiamo in app e mostriamo recovery utente-safe. */
        if (initialProfile != null) {
          if (!cancelled) {
            const email = initialProfile.email.trim().toLowerCase();
            setMeEmail(email);
            setMeUserId(initialProfile.id);
            setIsAdmin(isTecmaPlatformAdmin(initialProfile.systemRole));
            setAuthStatus('ok');
            setApiConfigError(normalizeApiError(e));
          }
          return;
        }
        if (!cancelled) setAuthStatus('fail');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accessToken, initialProfile, onSessionInvalid]);

  useEffect(() => {
    if (authStatus !== 'fail') return;
    if (onSessionInvalid != null) {
      onSessionInvalid();
      return;
    }
    void sessionOrchestrator.invalidateSession({
      reason: 'session_expired',
      source: 'project_access',
      redirectToLogin: true,
      strategy: 'auth-only',
    });
    window.location.reload();
  }, [authStatus, onSessionInvalid]);

  useEffect(() => {
    let cancelled = false;
    setWorkspacesLoading(true);
    setWorkspacesError(null);
    void http<WorkspacesResponse>('/workspaces', { method: 'GET', accessToken })
      .then((r) => {
        if (cancelled) return;
        setWorkspaces(Array.isArray(r.data) ? r.data : []);
        setWorkspacesError(null);
      })
      .catch((e) => {
        if (cancelled) return;
        if (isRecoverableSessionError(e)) {
          expireSession(e);
          return;
        }
        setWorkspaces([]);
        setWorkspacesError(normalizeApiError(e));
      })
      .finally(() => {
        if (!cancelled) setWorkspacesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (authStatus !== 'ok' || meEmail == null || meUserId == null) return;
    void loadProjects(meUserId, workspaceId, isAdmin);
  }, [authStatus, meEmail, meUserId, workspaceId, isAdmin, loadProjects]);

  useEffect(() => {
    setSelected([]);
  }, [workspaceId]);

  useEffect(() => {
    if (authStatus !== 'ok' || meEmail == null) return;
    let cancelled = false;
    void http<PreferencesResponse>('/session/preferences', { method: 'GET', accessToken })
      .then((prefs) => {
        if (cancelled || !prefs.data?.projectIds?.length) return;
        const valid = new Set(projects.map((p) => p.id));
        const intersected = prefs.data.projectIds.filter((id) => valid.has(id));
        if (intersected.length > 0) setSelected(intersected);
      })
      .catch((e) => {
        if (isRecoverableSessionError(e)) expireSession(e);
      });
    return () => {
      cancelled = true;
    };
  }, [authStatus, meEmail, accessToken, projects]);

  const toggleProject = (project: ProjectAccessProject) => {
    setSelected((prev) =>
      prev.includes(project.id) ? prev.filter((id) => id !== project.id) : [...prev, project.id],
    );
  };

  const visibleProjects = useMemo(() => {
    if (access == null) return [];
    let list = access.projects;
    const q = filter.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (project) =>
          (project.displayName ?? '').toLowerCase().includes(q) ||
          (project.name ?? '').toLowerCase().includes(q) ||
          project.id.toLowerCase().includes(q),
      );
    }
    if (typeFilter !== 'all') {
      list = list.filter((p) => projectMode(p) === typeFilter);
    }
    return list;
  }, [access, filter, typeFilter]);

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
    setSelected(Array.from(new Set([...selected, ...visibleProjects.map((p) => p.id)])));
  };

  const canConfirm = selected.length > 0 && !!access?.found && workspaceId.trim() !== '';

  const confirmSelection = async () => {
    if (access == null) return;
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('followup.workspaceId', workspaceId);
      window.sessionStorage.setItem(
        'followup3.projectsCache',
        JSON.stringify(
          projects.map((p) => ({
            id: p.id,
            name: p.name,
            displayName: p.displayName ?? p.name,
            mode: p.mode,
          })),
        ),
      );
    }
    await http('/session/preferences', {
      method: 'POST',
      accessToken,
      body: { projectIds: selected },
    }).catch(() => undefined);
    window.sessionStorage.setItem('followup.projectScope', JSON.stringify(selected));
    onContinue(selected);
  };

  const reloadProjects = () => {
    if (meUserId != null) void loadProjects(meUserId, workspaceId, isAdmin);
  };

  if (authStatus === 'pending') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-auth-page font-body text-foreground">
        <div className="flex flex-col items-center">
          <p className="text-sm text-muted-foreground">Verifica accesso…</p>
          <div
            className="mt-3 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden
          />
        </div>
      </div>
    );
  }

  if (authStatus === 'fail') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-auth-page font-body text-foreground">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">Reindirizzamento al login…</p>
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"
            aria-hidden
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-auth-page font-body text-foreground">
      <div className="hidden min-w-0 w-5/12 flex-col justify-between overflow-hidden border-r border-border/60 bg-auth-sidebar px-12 py-12 md:flex">
        <div>
          <LogoTecma className="h-12 w-12 opacity-90" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Project access
          </p>
          <h1 className="mt-4 text-3xl font-normal leading-tight text-card-foreground">
            Scegli workspace
            <br />e progetti
          </h1>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            {isAdmin ? (
              <>
                Come amministratore Tecma vedi tutti i workspace. La lista progetti segue il
                workspace selezionato; senza selezione resta disponibile solo il fallback globale.
              </>
            ) : (
              <>
                Prima selezioni il workspace: i progetti mostrati sono solo quelli di quel
                workspace. Poi scegli uno o più progetti con cui entrare in Followup.
              </>
            )}
          </p>
        </div>

        <div className="space-y-3 text-xs text-muted-foreground">
          <p className="font-semibold text-card-foreground">Suggerimenti</p>
          <ul className="space-y-1">
            {isAdmin ? (
              <li>• Cambia workspace per ricaricare i progetti collegati a quel contesto.</li>
            ) : (
              <li>• Cambia workspace per vedere un altro elenco progetti.</li>
            )}
            <li>• Filtra per Rent/Sell e cerca per nome prima di confermare.</li>
          </ul>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-hidden px-4 py-6 lg:px-10 lg:py-8">
        <div className="flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden">
          <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-ui px-6 py-6 shadow-panel">
            <header className="mb-4 flex-shrink-0">
              {degradedError != null ? (
                <div className="mb-3">
                  <SupportErrorReport
                    userMessage="Riprova tra qualche secondo. Se il problema continua, invia una segnalazione."
                    technicalContext={degradedError}
                    severity="high"
                    source="ProjectAccessPage.degraded"
                    userEmail={meEmail ?? undefined}
                    userId={meUserId ?? undefined}
                    workspaceId={workspaceId}
                    projectIds={selected}
                    endpoint={degradedError.endpoint}
                    method={degradedError.method}
                    requestId={degradedError.requestId}
                    traceId={degradedError.traceId}
                    responseStatus={degradedError.httpStatus}
                    onRetry={() => window.location.reload()}
                    onBackToLogin={backToLogin}
                  />
                </div>
              ) : null}
              {workspacesError == null &&
              authStatus === 'ok' &&
              !isAdmin &&
              workspaces.length === 0 ? (
                <p
                  className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                  role="status"
                >
                  Nessun workspace assegnato al tuo account. Contatta un amministratore per
                  abilitare i workspace necessari.
                </p>
              ) : null}
              {workspacesError == null &&
              authStatus === 'ok' &&
              isAdmin &&
              workspaces.length === 0 ? (
                <p
                  className="mb-3 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
                  role="status"
                >
                  Nessun workspace disponibile al momento. Riprova o crea un nuovo workspace.
                </p>
              ) : null}
              <h2 className="text-xl font-semibold text-foreground">
                Seleziona workspace e progetti
              </h2>
              {access?.found === true ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  <span className="font-medium text-card-foreground">{access.email}</span>
                  {access.isAdmin ? (
                    <span className="ml-2 rounded-full bg-sidebar-accent px-2 py-0.5 text-xs text-primary">
                      admin
                    </span>
                  ) : null}
                  {access.role !== '' && access.role.toLowerCase() !== 'admin' ? (
                    <span className="ml-2 text-muted-foreground">{access.role}</span>
                  ) : null}
                </p>
              ) : null}
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
              <div className="flex flex-shrink-0 flex-wrap items-end gap-4">
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Workspace
                  </label>
                  <Select
                    disabled={workspacesLoading || apiCallsDegraded}
                    value={workspaceId === '' ? WORKSPACE_SELECT_PLACEHOLDER : workspaceId}
                    onValueChange={(v) => {
                      if (v === WORKSPACE_SELECT_PLACEHOLDER) return;
                      setWorkspaceId(v);
                    }}
                  >
                    <SelectTrigger
                      aria-label="Workspace"
                      className="h-9 min-w-[220px] rounded-lg border border-input bg-background text-sm font-medium text-foreground"
                    >
                      <SelectValue
                        placeholder={
                          workspacesLoading
                            ? 'Caricamento workspace…'
                            : apiCallsDegraded
                              ? 'Workspace non disponibile'
                              : 'Scegli un workspace'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        value={WORKSPACE_SELECT_PLACEHOLDER}
                        disabled
                        className="text-muted-foreground"
                      >
                        Scegli un workspace
                      </SelectItem>
                      {workspaces.map((ws) => (
                        <SelectItem key={ws._id} value={ws._id}>
                          {ws.name ?? ws._id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {apiCallsDegraded ? (
                    <p className="mt-2 max-w-md text-xs text-muted-foreground">
                      Non riusciamo a caricare i workspace. Puoi riprovare o tornare al login.
                      <button
                        type="button"
                        className="ml-1 font-medium text-primary underline underline-offset-2"
                        onClick={() => window.location.reload()}
                      >
                        Riprova
                      </button>
                      .
                    </p>
                  ) : null}
                </div>
                <div className="min-w-0">
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Email
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="email"
                      readOnly
                      value={meEmail ?? ''}
                      className="h-9 max-w-[220px] min-w-0 rounded-lg bg-muted"
                    />
                    {meEmail != null && (isAdmin || workspaceId !== '') ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loading}
                        onClick={() => void reloadProjects()}
                        className="h-9 flex-shrink-0"
                      >
                        {loading ? 'Ricarica…' : 'Ricarica progetti'}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="mb-2 flex flex-wrap items-center gap-2 gap-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Progetti
                  </span>
                  {visibleProjects.length > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {selected.length} di {visibleProjects.length} selezionati
                    </span>
                  ) : null}
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">Tipo:</span>
                    {(['all', 'rent', 'sell'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTypeFilter(t)}
                        className={cn(
                          'rounded-md border px-2 py-1 text-xs font-medium transition-colors',
                          typeFilter === t
                            ? 'border-primary bg-sidebar-accent text-primary'
                            : 'border-border bg-background text-foreground hover:bg-muted',
                        )}
                      >
                        {t === 'all' ? 'Tutti' : t === 'rent' ? 'Rent' : 'Sell'}
                      </button>
                    ))}
                    <Input
                      type="text"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder="Cerca nome o codice"
                      className="h-9 min-w-0 w-36 text-xs sm:w-44"
                    />
                    {projects.length > 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={toggleAllVisible}
                        className="h-9 flex-shrink-0"
                      >
                        {allVisibleSelected ? 'Deseleziona' : 'Seleziona tutti'}
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto rounded-ui border border-border bg-background/80 pb-24 md:pb-0">
                  {apiCallsDegraded ? (
                    <div className="space-y-3 px-4 py-8 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">
                        Workspace e progetti non disponibili
                      </p>
                      <p>
                        Non riusciamo a caricare workspace e progetti. Riprova tra qualche secondo.
                        Se il problema continua, invia una segnalazione.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => window.location.reload()}
                      >
                        Riprova
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={backToLogin}>
                        Torna al login
                      </Button>
                    </div>
                  ) : !isAdmin && workspaceId === '' ? (
                    <div className="px-4 py-8 text-sm text-muted-foreground">
                      Seleziona un workspace qui sopra: verranno caricati solo i progetti a te
                      assegnati in quel workspace.
                    </div>
                  ) : null}
                  {!apiCallsDegraded &&
                  projects.length === 0 &&
                  error == null &&
                  loading &&
                  (isAdmin || workspaceId !== '') ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      {meEmail != null ? 'Caricamento progetti…' : 'Caricamento…'}
                    </div>
                  ) : null}
                  {!apiCallsDegraded &&
                  projects.length === 0 &&
                  error == null &&
                  !loading &&
                  (isAdmin || workspaceId !== '') ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      {isAdmin
                        ? 'Nessun progetto disponibile al momento nel workspace selezionato.'
                        : 'Nessun progetto visibile in questo workspace per il tuo utente. Contatta un amministratore per verificare i permessi di accesso ai progetti.'}
                    </div>
                  ) : null}
                  {error != null ? (
                    <div className="border-b border-border px-4 py-3">
                      <SupportErrorReport
                        userMessage="Riprova tra qualche secondo. Se il problema continua, invia una segnalazione."
                        technicalContext={error}
                        severity="medium"
                        source="ProjectAccessPage.projects"
                        userEmail={meEmail ?? undefined}
                        userId={meUserId ?? undefined}
                        workspaceId={workspaceId}
                        projectIds={selected}
                        endpoint={error.endpoint}
                        method={error.method}
                        requestId={error.requestId}
                        traceId={error.traceId}
                        responseStatus={error.httpStatus}
                        onRetry={reloadProjects}
                        onBackToLogin={backToLogin}
                      />
                    </div>
                  ) : null}
                  {projects.length > 0 && visibleProjects.length === 0 && error == null ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground">
                      Nessun progetto corrisponde al filtro. Prova a cambiare la ricerca.
                    </div>
                  ) : null}
                  {visibleProjects.length > 0 ? (
                    <ul className="divide-y divide-border">
                      {visibleProjects.map((project) => {
                        const isProjectSelected = selected.includes(project.id);
                        const mode = projectMode(project);
                        return (
                          <li key={project.id}>
                            <div
                              role="button"
                              tabIndex={0}
                              onClick={() => toggleProject(project)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  toggleProject(project);
                                }
                              }}
                              className="flex min-h-11 w-full cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm text-foreground hover:bg-muted"
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
                                <span className="block truncate font-medium">
                                  {project.displayName || project.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {project.id}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  'flex-shrink-0 rounded-full px-2 py-0.5 text-[11px]',
                                  mode === 'rent'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-sidebar-accent text-sidebar-accent-foreground',
                                )}
                              >
                                {mode === 'rent' ? 'Rent' : 'Sell'}
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              </div>
            </section>

            <footer className="fixed bottom-0 left-0 right-0 z-10 mt-6 flex flex-shrink-0 flex-col gap-3 border-t border-border bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-4 sm:flex-row sm:items-center sm:justify-between md:static md:mt-6 md:px-0 md:py-0">
              <p className="order-2 hidden text-xs text-muted-foreground sm:order-1 md:block">
                Puoi cambiare progetti e ambiente dal menu in alto a destra.
              </p>
              <Button
                type="button"
                onClick={() => void confirmSelection()}
                disabled={!canConfirm || loading || apiCallsDegraded}
                className="order-1 min-h-11 w-full sm:order-2 sm:w-auto"
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
