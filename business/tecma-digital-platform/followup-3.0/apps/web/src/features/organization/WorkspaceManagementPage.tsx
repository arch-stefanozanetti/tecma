import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { Button } from '../../components/ui/button';
import { CheckboxWithLabel } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { http } from '../../lib/http';
import { WorkspaceAdvancedPanel } from './WorkspaceAdvancedPanel';

type Workspace = {
  _id: string;
  name?: string;
  mfaRequired?: boolean;
};

type UserRow = {
  _id: string;
  email?: string;
  fullName?: string;
};

type WorkspaceMember = {
  _id: string;
  workspaceId: string;
  userId: string;
  role: 'owner' | 'admin' | 'collaborator' | 'viewer';
  accessScope?: 'all' | 'assigned';
  calendarDisplayColor?: string;
};

type ProjectRow = {
  _id: string;
  name?: string;
  code?: string;
};

type MemberProjectAssignment = {
  _id: string;
  workspaceId: string;
  userId: string;
  projectId: string;
};

interface WorkspaceManagementPageProps {
  accessToken: string;
  isTecmaAdmin: boolean;
  onOpenSetupWizard: () => void;
}

export const WorkspaceManagementPage = ({
  accessToken,
  isTecmaAdmin,
  onOpenSetupWizard,
}: WorkspaceManagementPageProps) => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [workspaceProjects, setWorkspaceProjects] = useState<ProjectRow[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [memberProjectAssignments, setMemberProjectAssignments] = useState<
    MemberProjectAssignment[]
  >([]);
  const [newMemberUserId, setNewMemberUserId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<'owner' | 'admin' | 'collaborator' | 'viewer'>(
    'collaborator',
  );
  const [newAssignmentProjectId, setNewAssignmentProjectId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace._id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );

  const selectedMember = useMemo(
    () => workspaceMembers.find((member) => member.userId === selectedMemberId) ?? null,
    [workspaceMembers, selectedMemberId],
  );

  const userLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const user of allUsers) {
      const label = user.fullName?.trim() || user.email?.trim() || user._id;
      map.set(user._id, label);
    }
    return map;
  }, [allUsers]);

  const projectLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const project of workspaceProjects) {
      map.set(project._id, project.name?.trim() || project.code?.trim() || project._id);
    }
    return map;
  }, [workspaceProjects]);

  const loadWorkspaceContext = async (workspaceId: string) => {
    if (workspaceId.trim() === '') {
      setWorkspaceMembers([]);
      setWorkspaceProjects([]);
      setMemberProjectAssignments([]);
      setSelectedMemberId('');
      return;
    }
    const [membersResponse, usersResponse, projectsResponse] = await Promise.all([
      http<{ data: WorkspaceMember[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/members`, {
        method: 'GET',
        accessToken,
      }),
      http<{ data: UserRow[] }>('/users', { method: 'GET', accessToken }),
      http<{ data: ProjectRow[] }>(`/projects?workspaceId=${encodeURIComponent(workspaceId)}`, {
        method: 'GET',
        accessToken,
      }),
    ]);

    const members = Array.isArray(membersResponse.data) ? membersResponse.data : [];
    setWorkspaceMembers(members);
    setAllUsers(Array.isArray(usersResponse.data) ? usersResponse.data : []);
    setWorkspaceProjects(Array.isArray(projectsResponse.data) ? projectsResponse.data : []);

    setSelectedMemberId((currentId) => {
      if (currentId !== '' && members.some((member) => member.userId === currentId))
        return currentId;
      return members[0]?.userId ?? '';
    });
  };

  const loadMemberAssignments = async (workspaceId: string, memberUserId: string) => {
    if (workspaceId.trim() === '' || memberUserId.trim() === '') {
      setMemberProjectAssignments([]);
      return;
    }
    const response = await http<{ data: MemberProjectAssignment[] }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(memberUserId)}/projects`,
      {
        method: 'GET',
        accessToken,
      },
    );
    setMemberProjectAssignments(Array.isArray(response.data) ? response.data : []);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void http<{ data: Workspace[] }>('/workspaces', { method: 'GET', accessToken })
      .then((response) => {
        if (cancelled) return;
        const rows = Array.isArray(response.data) ? response.data : [];
        setWorkspaces(rows);
        const firstId = rows[0]?._id ?? null;
        setSelectedWorkspaceId((currentId) => {
          if (currentId != null && rows.some((workspace) => workspace._id === currentId)) {
            return currentId;
          }
          return firstId;
        });
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Impossibile caricare i workspace.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    if (selectedWorkspaceId == null) return;
    void loadWorkspaceContext(selectedWorkspaceId).catch((requestError) => {
      if (cancelled) return;
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Impossibile caricare membri e progetti del workspace.',
      );
    });
    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceId, accessToken]);

  useEffect(() => {
    let cancelled = false;
    if (selectedWorkspaceId == null || selectedMemberId.trim() === '') {
      setMemberProjectAssignments([]);
      return;
    }
    void loadMemberAssignments(selectedWorkspaceId, selectedMemberId).catch(() => {
      if (!cancelled) setMemberProjectAssignments([]);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedWorkspaceId, selectedMemberId, accessToken]);

  useEffect(() => {
    if (selectedWorkspace == null) {
      setWorkspaceName('');
      setMfaRequired(false);
      return;
    }
    setWorkspaceName(selectedWorkspace.name ?? '');
    setMfaRequired(Boolean(selectedWorkspace.mfaRequired));
  }, [selectedWorkspace]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (selectedWorkspaceId == null) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const payload = {
        name: workspaceName.trim(),
        mfaRequired,
      };
      if (payload.name.length < 2) {
        setError('Il nome del workspace deve avere almeno 2 caratteri.');
        return;
      }
      const response = await http<{ data: Workspace }>(
        `/workspaces/${encodeURIComponent(selectedWorkspaceId)}`,
        {
          method: 'PATCH',
          accessToken,
          body: payload,
        },
      );
      const updated = response.data;
      setWorkspaces((prev) =>
        prev.map((workspace) =>
          workspace._id === selectedWorkspaceId ? { ...workspace, ...updated } : workspace,
        ),
      );
      setSuccessMessage('Workspace aggiornato con successo.');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Aggiornamento workspace non riuscito.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async () => {
    if (selectedWorkspaceId == null || newMemberUserId.trim() === '') return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await http<{ data: WorkspaceMember }>(
        `/workspaces/${encodeURIComponent(selectedWorkspaceId)}/members`,
        {
          method: 'POST',
          accessToken,
          body: { userId: newMemberUserId, role: newMemberRole },
        },
      );
      setSuccessMessage('Membro aggiunto al workspace.');
      setNewMemberUserId('');
      await loadWorkspaceContext(selectedWorkspaceId);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Aggiunta membro non riuscita.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMemberAdvanced = async (
    userId: string,
    payload: { accessScope?: 'all' | 'assigned'; calendarDisplayColor?: string },
  ) => {
    if (selectedWorkspaceId == null) return;
    setSaving(true);
    setError(null);
    try {
      await http<{ data: WorkspaceMember }>(
        `/workspaces/${encodeURIComponent(selectedWorkspaceId)}/members/${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          accessToken,
          body: payload,
        },
      );
      setSuccessMessage('Impostazioni avanzate membro aggiornate.');
      await loadWorkspaceContext(selectedWorkspaceId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Aggiornamento avanzato membro fallito.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMemberRole = async (userId: string, role: WorkspaceMember['role']) => {
    if (selectedWorkspaceId == null) return;
    setSaving(true);
    setError(null);
    try {
      await http<{ data: WorkspaceMember }>(
        `/workspaces/${encodeURIComponent(selectedWorkspaceId)}/members/${encodeURIComponent(userId)}`,
        {
          method: 'PATCH',
          accessToken,
          body: { role },
        },
      );
      setSuccessMessage('Ruolo membro aggiornato.');
      await loadWorkspaceContext(selectedWorkspaceId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Aggiornamento ruolo membro fallito.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (selectedWorkspaceId == null) return;
    if (!window.confirm('Rimuovere questo membro dal workspace?')) return;
    setSaving(true);
    setError(null);
    try {
      await http<{ data: { deleted: boolean } }>(
        `/workspaces/${encodeURIComponent(selectedWorkspaceId)}/members/${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
          accessToken,
        },
      );
      setSuccessMessage('Membro rimosso dal workspace.');
      await loadWorkspaceContext(selectedWorkspaceId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Rimozione membro fallita.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMemberProject = async () => {
    if (
      selectedWorkspaceId == null ||
      selectedMemberId.trim() === '' ||
      newAssignmentProjectId.trim() === ''
    ) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await http<{ data: MemberProjectAssignment }>(
        `/workspaces/${encodeURIComponent(selectedWorkspaceId)}/members/${encodeURIComponent(selectedMemberId)}/projects`,
        {
          method: 'POST',
          accessToken,
          body: { projectId: newAssignmentProjectId },
        },
      );
      setSuccessMessage('Progetto assegnato al membro.');
      setNewAssignmentProjectId('');
      await loadMemberAssignments(selectedWorkspaceId, selectedMemberId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Assegnazione progetto al membro fallita.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMemberProject = async (projectId: string) => {
    if (selectedWorkspaceId == null || selectedMemberId.trim() === '') return;
    setSaving(true);
    setError(null);
    try {
      await http<{ data: { deleted: boolean } }>(
        `/workspaces/${encodeURIComponent(selectedWorkspaceId)}/members/${encodeURIComponent(
          selectedMemberId,
        )}/projects/${encodeURIComponent(projectId)}`,
        {
          method: 'DELETE',
          accessToken,
        },
      );
      setSuccessMessage('Assegnazione progetto rimossa.');
      await loadMemberAssignments(selectedWorkspaceId, selectedMemberId);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Rimozione assegnazione progetto fallita.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Workspace Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestisci i workspace esistenti e aggiorna nome o policy MFA.
          </p>
        </div>
        {isTecmaAdmin ? (
          <Button type="button" onClick={onOpenSetupWizard}>
            Crea workspace
          </Button>
        ) : (
          <p className="max-w-xs text-right text-xs text-muted-foreground">
            La creazione workspace è riservata ai superadmin Tecma.
          </p>
        )}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Caricamento workspace...</p>
      ) : null}
      {!loading && error != null ? <p className="mt-6 text-sm text-destructive">{error}</p> : null}
      {!loading && error == null && workspaces.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">Nessun workspace disponibile.</p>
      ) : null}

      {!loading && error == null && workspaces.length > 0 ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Workspace disponibili
            </p>
            {workspaces.map((workspace) => {
              const selected = workspace._id === selectedWorkspaceId;
              return (
                <button
                  key={workspace._id}
                  type="button"
                  onClick={() => {
                    setSelectedWorkspaceId(workspace._id);
                    setSuccessMessage(null);
                    setError(null);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="truncate">{workspace.name ?? workspace._id}</span>
                </button>
              );
            })}
          </div>

          <div className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border p-4">
              <div>
                <label
                  htmlFor="workspace-name"
                  className="mb-1 block text-xs font-medium text-foreground"
                >
                  Nome workspace
                </label>
                <Input
                  id="workspace-name"
                  value={workspaceName}
                  onChange={(event) => setWorkspaceName(event.target.value)}
                  placeholder="Nome workspace"
                />
              </div>

              <CheckboxWithLabel
                checked={mfaRequired}
                onCheckedChange={(checked) => setMfaRequired(checked)}
                label="Richiedi MFA obbligatoria per il workspace"
              />

              {successMessage != null ? (
                <p className="text-sm text-emerald-600">{successMessage}</p>
              ) : null}
              {error != null ? <p className="text-sm text-destructive">{error}</p> : null}

              <Button type="submit" disabled={saving || selectedWorkspaceId == null}>
                {saving ? 'Salvataggio...' : 'Salva modifiche'}
              </Button>
            </form>

            <section className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Membri workspace</h3>
              <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
                <select
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={newMemberUserId}
                  onChange={(event) => setNewMemberUserId(event.target.value)}
                >
                  <option value="">Seleziona utente</option>
                  {allUsers
                    .filter(
                      (user) => !workspaceMembers.some((member) => member.userId === user._id),
                    )
                    .map((user) => (
                      <option key={user._id} value={user._id}>
                        {userLabelById.get(user._id) ?? user._id}
                      </option>
                    ))}
                </select>
                <select
                  className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                  value={newMemberRole}
                  onChange={(event) =>
                    setNewMemberRole(
                      event.target.value as 'owner' | 'admin' | 'collaborator' | 'viewer',
                    )
                  }
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="collaborator">Collaborator</option>
                  <option value="viewer">Viewer</option>
                </select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddMember}
                  disabled={saving || newMemberUserId.trim() === ''}
                >
                  Aggiungi membro
                </Button>
              </div>

              <div className="space-y-2">
                {workspaceMembers.map((member) => (
                  <div
                    key={member._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <button
                      type="button"
                      className={`text-left text-sm ${
                        selectedMemberId === member.userId ? 'text-primary' : 'text-foreground'
                      }`}
                      onClick={() => setSelectedMemberId(member.userId)}
                    >
                      {userLabelById.get(member.userId) ?? member.userId}
                    </button>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={member.role}
                        onChange={(event) => {
                          void handleUpdateMemberRole(
                            member.userId,
                            event.target.value as WorkspaceMember['role'],
                          );
                        }}
                      >
                        <option value="owner">Owner</option>
                        <option value="admin">Admin</option>
                        <option value="collaborator">Collaborator</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          void handleRemoveMember(member.userId);
                        }}
                      >
                        Rimuovi
                      </Button>
                    </div>
                  </div>
                ))}
                {workspaceMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun membro nel workspace.</p>
                ) : null}
              </div>
            </section>

            <section className="space-y-4 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">
                Assegnazione progetti ai membri
              </h3>
              {selectedMember == null ? (
                <p className="text-sm text-muted-foreground">
                  Seleziona un membro per gestire i progetti assegnati.
                </p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Membro selezionato:{' '}
                    {userLabelById.get(selectedMember.userId) ?? selectedMember.userId}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <select
                      className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                      value={newAssignmentProjectId}
                      onChange={(event) => setNewAssignmentProjectId(event.target.value)}
                    >
                      <option value="">Seleziona progetto</option>
                      {workspaceProjects
                        .filter(
                          (project) =>
                            !memberProjectAssignments.some(
                              (assignment) => assignment.projectId === project._id,
                            ),
                        )
                        .map((project) => (
                          <option key={project._id} value={project._id}>
                            {projectLabelById.get(project._id) ?? project._id}
                          </option>
                        ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddMemberProject}
                      disabled={saving || newAssignmentProjectId.trim() === ''}
                    >
                      Assegna progetto
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {memberProjectAssignments.map((assignment) => (
                      <div
                        key={assignment._id}
                        className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-sm"
                      >
                        <span>
                          {projectLabelById.get(assignment.projectId) ?? assignment.projectId}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            void handleRemoveMemberProject(assignment.projectId);
                          }}
                        >
                          Rimuovi
                        </Button>
                      </div>
                    ))}
                    {memberProjectAssignments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nessun progetto assegnato.</p>
                    ) : null}
                  </div>
                </>
              )}
            </section>

            {selectedMember != null ? (
              <section
                className="space-y-3 rounded-lg border border-border p-4"
                data-testid="member-advanced-drawer"
              >
                <header>
                  <h3 className="text-sm font-semibold text-foreground">
                    Impostazioni avanzate membro
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Definisci lo scope di accesso e il colore calendario per{' '}
                    {userLabelById.get(selectedMember.userId) ?? selectedMember.userId}.
                  </p>
                </header>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-foreground">
                    Access scope
                    <select
                      className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                      value={selectedMember.accessScope ?? 'assigned'}
                      onChange={(event) =>
                        void handleUpdateMemberAdvanced(selectedMember.userId, {
                          accessScope: event.target.value as 'all' | 'assigned',
                        })
                      }
                      data-testid="member-access-scope"
                    >
                      <option value="assigned">Solo progetti assegnati</option>
                      <option value="all">Tutti i progetti del workspace</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-foreground">
                    Colore calendario (#RRGGBB)
                    <Input
                      defaultValue={selectedMember.calendarDisplayColor ?? ''}
                      placeholder="#1A2B3C"
                      data-testid="member-calendar-color"
                      onBlur={(event) => {
                        const value = event.target.value.trim();
                        if (value === '' && selectedMember.calendarDisplayColor == null) return;
                        if (value === selectedMember.calendarDisplayColor) return;
                        void handleUpdateMemberAdvanced(selectedMember.userId, {
                          calendarDisplayColor: value === '' ? undefined : value,
                        });
                      }}
                    />
                  </label>
                </div>
              </section>
            ) : null}

            {selectedWorkspaceId != null ? (
              <WorkspaceAdvancedPanel
                accessToken={accessToken}
                workspaceId={selectedWorkspaceId}
                canManage={isTecmaAdmin}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
