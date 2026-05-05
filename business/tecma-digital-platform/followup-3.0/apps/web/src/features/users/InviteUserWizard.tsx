import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { http } from '../../lib/http';

import {
  PermissionOverrideMatrix,
  type PermissionGroup,
} from './PermissionOverrideMatrix';

type WorkspaceRow = { _id: string; name?: string };
type ProjectRow = { _id: string; displayName?: string; code?: string; workspaceId?: string };
type UserRow = { _id: string; email: string; fullName?: string };

export type WorkspaceRoleKey = 'owner' | 'admin' | 'collaborator' | 'viewer';
export type WizardMode = 'invite' | 'existing';

export interface InviteUserWizardProps {
  accessToken: string;
  workspaces: WorkspaceRow[];
  existingUsers: UserRow[];
  /** Hint UI: mostra modalita "esistente" solo se ci sono utenti senza membership. */
  allowExisting?: boolean;
  onCancel: () => void;
  onCompleted: (result: { userId: string; workspaceId: string; mode: WizardMode }) => void;
}

interface PermissionsCatalogResponse {
  data: {
    groups: PermissionGroup[];
  };
}

interface RolePermissionsResponse {
  data: { roleKey: string; permissions: string[] };
}

interface ProjectsResponse {
  data: ProjectRow[];
}

interface InviteUserResponseRow {
  _id: string;
  email: string;
}

const ROLE_LABELS: Record<WorkspaceRoleKey, string> = {
  owner: 'Owner',
  admin: 'Admin',
  collaborator: 'Collaborator',
  viewer: 'Viewer',
};

export const InviteUserWizard = ({
  accessToken,
  workspaces,
  existingUsers,
  allowExisting = false,
  onCancel,
  onCompleted,
}: InviteUserWizardProps) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [mode, setMode] = useState<WizardMode>('invite');
  const [workspaceId, setWorkspaceId] = useState<string>(workspaces[0]?._id ?? '');
  const [existingUserId, setExistingUserId] = useState<string>('');
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [availableProjects, setAvailableProjects] = useState<ProjectRow[]>([]);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<WorkspaceRoleKey>('viewer');
  const [overrideIds, setOverrideIds] = useState<string[]>([]);
  const [catalog, setCatalog] = useState<PermissionGroup[]>([]);
  const [basePermissions, setBasePermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const selectedWorkspace = useMemo(
    () => workspaces.find((entry) => entry._id === workspaceId) ?? null,
    [workspaceId, workspaces],
  );

  useEffect(() => {
    if (!workspaceId) {
      setAvailableProjects([]);
      return;
    }
    let cancelled = false;
    void http<ProjectsResponse>(`/projects?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: 'GET',
      accessToken,
    })
      .then((response) => {
        if (cancelled) return;
        setAvailableProjects(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setAvailableProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, workspaceId]);

  useEffect(() => {
    let cancelled = false;
    void http<PermissionsCatalogResponse>('/rbac/permission-catalog', {
      method: 'GET',
      accessToken,
    })
      .then((response) => {
        if (cancelled) return;
        setCatalog(Array.isArray(response.data?.groups) ? response.data.groups : []);
      })
      .catch(() => {
        if (cancelled) return;
        setCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    setLoadingPreview(true);
    void http<RolePermissionsResponse>(
      `/rbac/roles/${encodeURIComponent(role)}/effective-permissions`,
      { method: 'GET', accessToken },
    )
      .then((response) => {
        if (cancelled) return;
        const permissions = Array.isArray(response.data?.permissions)
          ? response.data.permissions
          : [];
        setBasePermissions(permissions);
      })
      .catch(() => {
        if (cancelled) return;
        setBasePermissions([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, role]);

  const stepTitles: Record<1 | 2 | 3 | 4, string> = {
    1: 'Tipo invito + workspace',
    2: 'Progetti',
    3: 'Identita + ruolo',
    4: 'Riepilogo + permessi',
  };

  const goNext = (): void => {
    setError(null);
    if (step === 1) {
      if (!workspaceId) {
        setError('Seleziona un workspace.');
        return;
      }
      if (mode === 'existing' && !existingUserId) {
        setError('Seleziona un utente esistente.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
      return;
    }
    if (step === 3) {
      if (mode === 'invite') {
        if (email.trim() === '' || fullName.trim().length < 2) {
          setError('Email e nome completo (min 2 char) sono obbligatori.');
          return;
        }
      }
      setStep(4);
      return;
    }
  };

  const goBack = (): void => {
    setError(null);
    setStep((current) => (current > 1 ? ((current - 1) as 1 | 2 | 3) : 1));
  };

  const handleSubmit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (step !== 4) return;
    setSubmitting(true);
    setError(null);
    try {
      let userId: string;
      if (mode === 'invite') {
        const body = {
          email: email.trim(),
          fullName: fullName.trim(),
          role,
          workspaceId,
        };
        const response = await http<{ data: InviteUserResponseRow }>('/users', {
          method: 'POST',
          accessToken,
          body,
        });
        userId = response.data._id;
      } else {
        userId = existingUserId;
        await http<{ data: unknown }>(
          `/workspaces/${encodeURIComponent(workspaceId)}/members`,
          {
            method: 'POST',
            accessToken,
            body: { userId, role },
          },
        );
      }

      if (overrideIds.length > 0) {
        await http<{ data: unknown }>(`/users/${encodeURIComponent(userId)}`, {
          method: 'PATCH',
          accessToken,
          body: { permissionsOverride: overrideIds },
        });
      }

      for (const projectId of projectIds) {
        try {
          await http<{ data: unknown }>(
            `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(
              userId,
            )}/projects`,
            {
              method: 'POST',
              accessToken,
              body: { projectId },
            },
          );
        } catch {
          // best-effort: project assignment failures are surfaced to the user later
        }
      }

      onCompleted({ userId, workspaceId, mode });
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Invito non completato. Verifica i dati.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-border bg-card p-4"
      data-testid="invite-user-wizard"
    >
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Step {step}/4 — {stepTitles[step]}
          </h3>
          <p className="text-xs text-muted-foreground">
            Wizard guidato per invito o assegnazione utente al workspace.
          </p>
        </div>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Annulla
        </Button>
      </header>

      {error != null ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <fieldset className="space-y-3">
          {allowExisting ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === 'invite'}
                  onChange={() => setMode('invite')}
                  data-testid="wizard-mode-invite"
                />
                <span>
                  <strong>Nuovo utente</strong>
                  <span className="block text-xs text-muted-foreground">
                    Crea un account e invialo nel workspace.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  checked={mode === 'existing'}
                  onChange={() => setMode('existing')}
                  data-testid="wizard-mode-existing"
                />
                <span>
                  <strong>Utente esistente</strong>
                  <span className="block text-xs text-muted-foreground">
                    Aggiungi un utente gia presente al workspace.
                  </span>
                </span>
              </label>
            </div>
          ) : null}

          <label className="block text-xs font-medium text-foreground">
            Workspace
            <select
              className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              data-testid="wizard-workspace-select"
            >
              {workspaces.map((workspace) => (
                <option key={workspace._id} value={workspace._id}>
                  {workspace.name ?? workspace._id}
                </option>
              ))}
            </select>
          </label>

          {mode === 'existing' ? (
            <label className="block text-xs font-medium text-foreground">
              Utente esistente
              <select
                className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={existingUserId}
                onChange={(event) => setExistingUserId(event.target.value)}
                data-testid="wizard-existing-user-select"
              >
                <option value="">— seleziona —</option>
                {existingUsers.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.fullName ?? user.email}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className="space-y-2">
          <p className="text-sm text-foreground">
            Seleziona i progetti del workspace{' '}
            <strong>{selectedWorkspace?.name ?? workspaceId}</strong> a cui dare accesso.
          </p>
          {availableProjects.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nessun progetto disponibile (potrai aggiungerli in seguito).
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {availableProjects.map((project) => {
                const checked = projectIds.includes(project._id);
                return (
                  <li key={project._id}>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setProjectIds((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(project._id);
                            else next.delete(project._id);
                            return [...next];
                          });
                        }}
                        data-testid={`wizard-project-${project._id}`}
                      />
                      <span>
                        <strong>{project.displayName ?? project.code ?? project._id}</strong>
                        {project.code != null ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({project.code})
                          </span>
                        ) : null}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      ) : null}

      {step === 3 ? (
        <fieldset className="space-y-3">
          {mode === 'invite' ? (
            <>
              <label className="block text-xs font-medium text-foreground">
                Email
                <Input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="nome@azienda.it"
                />
              </label>
              <label className="block text-xs font-medium text-foreground">
                Nome completo
                <Input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nome Cognome"
                />
              </label>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Verra usato l&apos;account selezionato allo Step 1.
            </p>
          )}
          <label className="block text-xs font-medium text-foreground">
            Ruolo workspace
            <select
              className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={role}
              onChange={(event) => setRole(event.target.value as WorkspaceRoleKey)}
              data-testid="wizard-role-select"
            >
              <option value="owner">{ROLE_LABELS.owner}</option>
              <option value="admin">{ROLE_LABELS.admin}</option>
              <option value="collaborator">{ROLE_LABELS.collaborator}</option>
              <option value="viewer">{ROLE_LABELS.viewer}</option>
            </select>
          </label>
        </fieldset>
      ) : null}

      {step === 4 ? (
        <fieldset className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p>
              Workspace: <strong>{selectedWorkspace?.name ?? workspaceId}</strong>
            </p>
            <p>
              Modalita: <strong>{mode === 'invite' ? 'Nuovo invito' : 'Utente esistente'}</strong>
            </p>
            {mode === 'invite' ? (
              <p>
                Email: <strong>{email}</strong> · Nome: <strong>{fullName}</strong>
              </p>
            ) : null}
            <p>
              Ruolo: <strong>{ROLE_LABELS[role]}</strong>
            </p>
            <p>
              Progetti:{' '}
              {projectIds.length === 0 ? (
                <em>nessuno</em>
              ) : (
                <strong>{projectIds.length}</strong>
              )}
            </p>
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Permessi effettivi (preview)
            </h4>
            {loadingPreview ? (
              <p className="text-xs text-muted-foreground">Caricamento permessi del ruolo...</p>
            ) : (
              <PermissionOverrideMatrix
                groups={catalog}
                selectedIds={overrideIds}
                basePermissions={basePermissions}
                onChange={setOverrideIds}
                disabled={submitting}
              />
            )}
          </div>
        </fieldset>
      ) : null}

      <footer className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Override custom: <strong>{overrideIds.length}</strong>
        </div>
        <div className="flex flex-wrap gap-2">
          {step > 1 ? (
            <Button type="button" variant="ghost" onClick={goBack} disabled={submitting}>
              Indietro
            </Button>
          ) : null}
          {step < 4 ? (
            <Button type="button" onClick={goNext} disabled={submitting}>
              Avanti
            </Button>
          ) : (
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Salvataggio...' : 'Conferma e invita'}
            </Button>
          )}
        </div>
      </footer>
    </form>
  );
};
