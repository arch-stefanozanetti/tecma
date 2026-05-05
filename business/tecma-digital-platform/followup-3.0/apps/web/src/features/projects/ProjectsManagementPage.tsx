import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { http } from '../../lib/http';

type WorkspaceRow = { _id: string; name?: string };
type ProjectRow = { _id: string; name?: string; code?: string; workspaceId?: string };
type AccessGrantRow = {
  _id: string;
  workspace_id: string;
  role: 'owner' | 'collaborator' | 'viewer';
};

type WorkspacesResponse = { data: WorkspaceRow[] };
type ProjectsResponse = { data: ProjectRow[] };
type AccessResponse = { data: AccessGrantRow[] };

interface ProjectsManagementPageProps {
  accessToken: string;
  isTecmaAdmin: boolean;
}

export const ProjectsManagementPage = ({
  accessToken,
  isTecmaAdmin,
}: ProjectsManagementPageProps) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [accessGrants, setAccessGrants] = useState<AccessGrantRow[]>([]);
  const [grantWorkspaceId, setGrantWorkspaceId] = useState('');
  const [grantRole, setGrantRole] = useState<'owner' | 'collaborator' | 'viewer'>('viewer');

  const selectedProject = useMemo(
    () => projects.find((entry) => entry._id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const loadWorkspaces = async (): Promise<WorkspaceRow[]> => {
    const response = await http<WorkspacesResponse>('/workspaces', { method: 'GET', accessToken });
    return Array.isArray(response.data) ? response.data : [];
  };

  const loadProjects = async (wsId: string): Promise<ProjectRow[]> => {
    if (wsId.trim() === '') return [];
    const response = await http<ProjectsResponse>(
      `/projects?workspaceId=${encodeURIComponent(wsId)}`,
      { method: 'GET', accessToken },
    );
    return Array.isArray(response.data) ? response.data : [];
  };

  const loadAccess = async (projectId: string): Promise<AccessGrantRow[]> => {
    const response = await http<AccessResponse>(
      `/projects/${encodeURIComponent(projectId)}/access`,
      {
        method: 'GET',
        accessToken,
      },
    );
    return Array.isArray(response.data) ? response.data : [];
  };

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const wsRows = await loadWorkspaces();
      setWorkspaces(wsRows);
      const targetWorkspaceId = workspaceId || wsRows[0]?._id || '';
      setWorkspaceId(targetWorkspaceId);
      const projectRows = await loadProjects(targetWorkspaceId);
      setProjects(projectRows);
      setSelectedProjectId((current) => {
        if (current != null && projectRows.some((entry) => entry._id === current)) return current;
        return projectRows[0]?._id ?? null;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Impossibile caricare i progetti.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [accessToken]);

  useEffect(() => {
    if (selectedProject == null) {
      setProjectName('');
      setProjectCode('');
      setAccessGrants([]);
      return;
    }
    setProjectName(selectedProject.name ?? '');
    setProjectCode(selectedProject.code ?? '');
    void loadAccess(selectedProject._id)
      .then(setAccessGrants)
      .catch(() => setAccessGrants([]));
  }, [selectedProject, accessToken]);

  const refreshProjectsForWorkspace = async (targetWorkspaceId: string) => {
    const rows = await loadProjects(targetWorkspaceId);
    setProjects(rows);
    setSelectedProjectId((current) => {
      if (current != null && rows.some((entry) => entry._id === current)) return current;
      return rows[0]?._id ?? null;
    });
  };

  const handleWorkspaceChange = async (nextWorkspaceId: string) => {
    setWorkspaceId(nextWorkspaceId);
    setError(null);
    setSuccessMessage(null);
    try {
      await refreshProjectsForWorkspace(nextWorkspaceId);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Errore caricamento progetti.',
      );
    }
  };

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (
        workspaceId.trim() === '' ||
        createName.trim().length < 2 ||
        createCode.trim().length < 2
      ) {
        setError('Workspace, nome e codice progetto sono obbligatori.');
        return;
      }
      await http<{ data: ProjectRow }>('/projects', {
        method: 'POST',
        accessToken,
        body: {
          workspaceId,
          name: createName.trim(),
          code: createCode.trim(),
        },
      });
      setCreateName('');
      setCreateCode('');
      setSuccessMessage('Progetto creato con successo.');
      await refreshProjectsForWorkspace(workspaceId);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Creazione progetto non riuscita.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateProject = async () => {
    if (selectedProject == null) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await http<{ data: ProjectRow }>(`/projects/${encodeURIComponent(selectedProject._id)}`, {
        method: 'PATCH',
        accessToken,
        body: {
          name: projectName.trim(),
          code: projectCode.trim(),
        },
      });
      setSuccessMessage('Progetto aggiornato.');
      await refreshProjectsForWorkspace(workspaceId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Aggiornamento progetto non riuscito.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (selectedProject == null) return;
    if (!window.confirm(`Eliminare progetto ${selectedProject.name ?? selectedProject._id}?`))
      return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await http<{ data: { deleted: boolean } }>(
        `/projects/${encodeURIComponent(selectedProject._id)}`,
        {
          method: 'DELETE',
          accessToken,
        },
      );
      setSuccessMessage('Progetto eliminato.');
      await refreshProjectsForWorkspace(workspaceId);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Eliminazione progetto fallita.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddAccessGrant = async () => {
    if (selectedProject == null) return;
    if (grantWorkspaceId.trim() === '') return;
    setSaving(true);
    setError(null);
    try {
      await http<{ data: AccessGrantRow }>(
        `/projects/${encodeURIComponent(selectedProject._id)}/access`,
        {
          method: 'POST',
          accessToken,
          body: {
            workspaceId: grantWorkspaceId,
            role: grantRole,
          },
        },
      );
      setGrantWorkspaceId('');
      setGrantRole('viewer');
      setSuccessMessage('Grant access aggiunto.');
      setAccessGrants(await loadAccess(selectedProject._id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Creazione grant fallita.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAccessGrant = async (grantId: string) => {
    if (selectedProject == null) return;
    setSaving(true);
    setError(null);
    try {
      await http<{ data: { deleted: boolean } }>(
        `/projects/${encodeURIComponent(selectedProject._id)}/access/${encodeURIComponent(grantId)}`,
        {
          method: 'DELETE',
          accessToken,
        },
      );
      setSuccessMessage('Grant rimosso.');
      setAccessGrants(await loadAccess(selectedProject._id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Rimozione grant fallita.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-panel">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">Projects Management</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crea e gestisci progetti, con access grants per workspace.
        </p>
      </div>

      {error != null ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {successMessage != null ? (
        <p className="mb-3 text-sm text-emerald-600">{successMessage}</p>
      ) : null}

      <label className="mb-4 block text-xs font-medium text-foreground">
        Workspace attivo
        <select
          className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          value={workspaceId}
          onChange={(event) => {
            void handleWorkspaceChange(event.target.value);
          }}
        >
          <option value="">Seleziona workspace</option>
          {workspaces.map((workspace) => (
            <option key={workspace._id} value={workspace._id}>
              {workspace.name ?? workspace._id}
            </option>
          ))}
        </select>
      </label>

      {loading ? <p className="text-sm text-muted-foreground">Caricamento progetti...</p> : null}

      {!loading ? (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Progetti
            </p>
            {projects.map((project) => {
              const selected = project._id === selectedProjectId;
              return (
                <button
                  key={project._id}
                  type="button"
                  onClick={() => setSelectedProjectId(project._id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left ${
                    selected
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                >
                  <p className="font-medium text-sm">{project.name ?? project._id}</p>
                  <p className="text-xs text-muted-foreground">Code: {project.code ?? 'n/a'}</p>
                </button>
              );
            })}
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nessun progetto nel workspace selezionato.
              </p>
            ) : null}
          </div>

          <div className="space-y-6">
            <form
              onSubmit={handleCreateProject}
              className="space-y-3 rounded-lg border border-border p-4"
            >
              <h3 className="text-sm font-semibold text-foreground">Crea progetto</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Nome progetto
                </label>
                <Input
                  value={createName}
                  onChange={(event) => setCreateName(event.target.value)}
                  placeholder="Residenza Aurora"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Code</label>
                <Input
                  value={createCode}
                  onChange={(event) => setCreateCode(event.target.value)}
                  placeholder="AURORA-01"
                />
              </div>
              <Button type="submit" disabled={saving || workspaceId.trim() === ''}>
                {saving ? 'Creazione...' : 'Crea progetto'}
              </Button>
            </form>

            <div className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Dettaglio progetto</h3>
              {selectedProject == null ? (
                <p className="text-sm text-muted-foreground">Seleziona un progetto.</p>
              ) : (
                <>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Nome progetto
                    </label>
                    <Input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Code</label>
                    <Input
                      value={projectCode}
                      onChange={(event) => setProjectCode(event.target.value)}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleUpdateProject} disabled={saving}>
                      Salva progetto
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDeleteProject}
                      disabled={saving}
                    >
                      Elimina progetto
                    </Button>
                  </div>

                  {isTecmaAdmin ? (
                    <div className="space-y-3 border-t border-border pt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Access grants
                      </h4>
                      <div className="grid gap-3 sm:grid-cols-[1fr_160px_auto]">
                        <select
                          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                          value={grantWorkspaceId}
                          onChange={(event) => setGrantWorkspaceId(event.target.value)}
                        >
                          <option value="">Workspace target</option>
                          {workspaces
                            .filter((workspace) => workspace._id !== workspaceId)
                            .map((workspace) => (
                              <option key={workspace._id} value={workspace._id}>
                                {workspace.name ?? workspace._id}
                              </option>
                            ))}
                        </select>
                        <select
                          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                          value={grantRole}
                          onChange={(event) =>
                            setGrantRole(event.target.value as 'owner' | 'collaborator' | 'viewer')
                          }
                        >
                          <option value="owner">Owner</option>
                          <option value="collaborator">Collaborator</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleAddAccessGrant}
                          disabled={saving || grantWorkspaceId.trim() === ''}
                        >
                          Aggiungi
                        </Button>
                      </div>
                      <div className="space-y-2">
                        {accessGrants.map((grant) => (
                          <div
                            key={grant._id}
                            className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          >
                            <span>
                              {workspaces.find((workspace) => workspace._id === grant.workspace_id)
                                ?.name ?? grant.workspace_id}{' '}
                              · {grant.role}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                void handleRemoveAccessGrant(grant._id);
                              }}
                            >
                              Rimuovi
                            </Button>
                          </div>
                        ))}
                        {accessGrants.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nessun grant configurato.</p>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
