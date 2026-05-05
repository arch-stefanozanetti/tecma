import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { http } from '../../lib/http';

import { InviteUserWizard } from './InviteUserWizard';
import {
  PermissionOverrideMatrix,
  permissionOverrideDraftDirty,
  type PermissionGroup,
} from './PermissionOverrideMatrix';

type WorkspaceRow = { _id: string; name?: string };
type UserRow = {
  _id: string;
  email: string;
  fullName?: string;
  role?: string;
  systemRole?: string;
  status?: string;
  permissionsOverride?: string[];
  permissions_override?: string[];
};

type UsersResponse = { data: UserRow[] };
type WorkspacesResponse = { data: WorkspaceRow[] };
type PermissionCatalogResponse = { data: { groups: PermissionGroup[] } };
type EffectiveRolePermissionsResponse = {
  data: { roleKey: string; permissions: string[] };
};

interface UsersManagementPageProps {
  accessToken: string;
  isTecmaAdmin: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  collaborator: 'Collaborator',
  viewer: 'Viewer',
};

const readUserOverrides = (user: UserRow | null): string[] => {
  if (user == null) return [];
  if (Array.isArray(user.permissionsOverride)) {
    return user.permissionsOverride.filter((entry) => typeof entry === 'string');
  }
  if (Array.isArray(user.permissions_override)) {
    return user.permissions_override.filter((entry) => typeof entry === 'string');
  }
  return [];
};

export const UsersManagementPage = ({ accessToken, isTecmaAdmin }: UsersManagementPageProps) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [selectedUserSystemRole, setSelectedUserSystemRole] = useState<'user' | 'tecma_admin'>(
    'user',
  );
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'admin' | 'collaborator' | 'viewer'>(
    'viewer',
  );
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState<string[]>([]);
  const [initialOverride, setInitialOverride] = useState<string[]>([]);
  const [permissionCatalog, setPermissionCatalog] = useState<PermissionGroup[]>([]);
  const [basePermissions, setBasePermissions] = useState<string[]>([]);

  const selectedUser = useMemo(
    () => users.find((entry) => entry._id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const overrideDirty = useMemo(
    () => permissionOverrideDraftDirty(initialOverride, overrideDraft),
    [initialOverride, overrideDraft],
  );

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResponse, workspacesResponse] = await Promise.all([
        http<UsersResponse>('/users', { method: 'GET', accessToken }),
        http<WorkspacesResponse>('/workspaces', { method: 'GET', accessToken }),
      ]);
      const nextUsers = Array.isArray(usersResponse.data) ? usersResponse.data : [];
      const nextWorkspaces = Array.isArray(workspacesResponse.data) ? workspacesResponse.data : [];
      setUsers(nextUsers);
      setWorkspaces(nextWorkspaces);
      setSelectedUserId((current) => {
        if (current != null && nextUsers.some((entry) => entry._id === current)) return current;
        return nextUsers[0]?._id ?? null;
      });
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Impossibile caricare gli utenti.',
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [accessToken]);

  useEffect(() => {
    let cancelled = false;
    void http<PermissionCatalogResponse>('/rbac/permission-catalog', {
      method: 'GET',
      accessToken,
    })
      .then((response) => {
        if (cancelled) return;
        setPermissionCatalog(
          Array.isArray(response.data?.groups) ? response.data.groups : [],
        );
      })
      .catch(() => {
        if (cancelled) return;
        setPermissionCatalog([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (selectedUser == null) {
      setSelectedUserName('');
      setSelectedUserSystemRole('user');
      setOverrideDraft([]);
      setInitialOverride([]);
      setBasePermissions([]);
      return;
    }
    setSelectedUserName(selectedUser.fullName ?? '');
    setSelectedUserSystemRole(selectedUser.systemRole === 'tecma_admin' ? 'tecma_admin' : 'user');
    const overrides = readUserOverrides(selectedUser);
    setOverrideDraft(overrides);
    setInitialOverride(overrides);
  }, [selectedUser]);

  useEffect(() => {
    if (selectedUser == null) {
      setBasePermissions([]);
      return;
    }
    const role = selectedUser.role ?? 'viewer';
    let cancelled = false;
    void http<EffectiveRolePermissionsResponse>(
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
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, selectedUser]);

  const resetInviteForm = () => {
    setInviteEmail('');
    setInviteFullName('');
    setInviteRole('viewer');
    setInviteWorkspaceId('');
  };

  const handleInvite = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      if (inviteEmail.trim() === '' || inviteFullName.trim().length < 2) {
        setError('Email e nome completo sono obbligatori.');
        return;
      }
      await http<{ data: UserRow }>('/users', {
        method: 'POST',
        accessToken,
        body: {
          email: inviteEmail.trim(),
          fullName: inviteFullName.trim(),
          role: inviteRole,
          workspaceId: inviteWorkspaceId.trim() === '' ? undefined : inviteWorkspaceId,
        },
      });
      setSuccessMessage('Utente invitato con successo.');
      resetInviteForm();
      await loadAll();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Invito utente non riuscito.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSelectedUser = async () => {
    if (selectedUser == null) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const payload: Record<string, unknown> = { fullName: selectedUserName.trim() };
      if (isTecmaAdmin) payload.systemRole = selectedUserSystemRole;
      await http<{ data: UserRow }>(`/users/${encodeURIComponent(selectedUser._id)}`, {
        method: 'PATCH',
        accessToken,
        body: payload,
      });
      setSuccessMessage('Utente aggiornato.');
      await loadAll();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Aggiornamento utente non riuscito.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOverrides = async () => {
    if (selectedUser == null) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await http<{ data: UserRow }>(`/users/${encodeURIComponent(selectedUser._id)}`, {
        method: 'PATCH',
        accessToken,
        body: { permissionsOverride: overrideDraft },
      });
      setSuccessMessage('Permessi override aggiornati.');
      setInitialOverride(overrideDraft);
      await loadAll();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Salvataggio override non riuscito.',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardOverrides = () => {
    setOverrideDraft(initialOverride);
  };

  const handleDeleteSelectedUser = async () => {
    if (selectedUser == null) return;
    if (!window.confirm(`Eliminare utente ${selectedUser.email}?`)) return;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await http<{ data: { deleted: boolean } }>(`/users/${encodeURIComponent(selectedUser._id)}`, {
        method: 'DELETE',
        accessToken,
      });
      setSuccessMessage('Utente eliminato.');
      await loadAll();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Eliminazione utente fallita.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-panel">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Users Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestisci utenti, inviti, ruoli di sistema e override permessi.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={showWizard ? 'ghost' : 'default'}
            onClick={() => setShowWizard((current) => !current)}
            data-testid="toggle-invite-wizard"
          >
            {showWizard ? 'Chiudi wizard' : 'Apri wizard invito'}
          </Button>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Caricamento utenti...</p> : null}
      {error != null ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {successMessage != null ? (
        <p className="mb-3 text-sm text-emerald-600">{successMessage}</p>
      ) : null}

      {showWizard ? (
        <div className="mb-6">
          <InviteUserWizard
            accessToken={accessToken}
            workspaces={workspaces}
            existingUsers={users}
            allowExisting
            onCancel={() => setShowWizard(false)}
            onCompleted={(result) => {
              setShowWizard(false);
              setSuccessMessage(
                result.mode === 'invite'
                  ? 'Utente invitato dal wizard.'
                  : 'Utente esistente aggiunto al workspace.',
              );
              void loadAll();
            }}
          />
        </div>
      ) : null}

      {!loading ? (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Utenti
            </p>
            {users.map((entry) => {
              const selected = entry._id === selectedUserId;
              const tecmaAdmin = entry.systemRole === 'tecma_admin';
              const roleLabel = entry.role != null ? ROLE_LABELS[entry.role] ?? entry.role : null;
              return (
                <button
                  key={entry._id}
                  type="button"
                  onClick={() => {
                    setSelectedUserId(entry._id);
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selected
                      ? 'border-primary bg-primary/5 text-foreground'
                      : 'border-border bg-background hover:bg-muted'
                  }`}
                  data-testid={`user-row-${entry._id}`}
                >
                  <p className="flex items-center gap-2 truncate font-medium">
                    {entry.fullName ?? entry.email}
                    {tecmaAdmin ? (
                      <span
                        className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary"
                        data-testid={`badge-tecma-admin-${entry._id}`}
                      >
                        Tecma Admin
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{entry.email}</p>
                  {roleLabel != null ? (
                    <p
                      className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground"
                      data-testid={`badge-role-${entry._id}`}
                    >
                      {roleLabel}
                    </p>
                  ) : null}
                </button>
              );
            })}
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun utente disponibile.</p>
            ) : null}
          </div>

          <div className="space-y-6">
            <form onSubmit={handleInvite} className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Invita utente (rapido)</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
                <Input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="nome@azienda.it"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Nome completo
                </label>
                <Input
                  value={inviteFullName}
                  onChange={(event) => setInviteFullName(event.target.value)}
                  placeholder="Nome Cognome"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-foreground">
                  Ruolo workspace
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    value={inviteRole}
                    onChange={(event) =>
                      setInviteRole(
                        event.target.value as 'owner' | 'admin' | 'collaborator' | 'viewer',
                      )
                    }
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="collaborator">Collaborator</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-foreground">
                  Workspace (opzionale)
                  <select
                    className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                    value={inviteWorkspaceId}
                    onChange={(event) => setInviteWorkspaceId(event.target.value)}
                  >
                    <option value="">Nessuno</option>
                    {workspaces.map((workspace) => (
                      <option key={workspace._id} value={workspace._id}>
                        {workspace.name ?? workspace._id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Button type="submit" disabled={saving}>
                {saving ? 'Invio...' : 'Invita utente'}
              </Button>
            </form>

            <div className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Dettaglio utente</h3>
              {selectedUser == null ? (
                <p className="text-sm text-muted-foreground">Seleziona un utente a sinistra.</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Stato: {selectedUser.status ?? 'n/a'} · Role: {selectedUser.role ?? 'n/a'}
                    {selectedUser.systemRole === 'tecma_admin' ? ' · Tecma Admin' : null}
                  </p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">
                      Nome completo
                    </label>
                    <Input
                      value={selectedUserName}
                      onChange={(event) => setSelectedUserName(event.target.value)}
                      placeholder="Nome Cognome"
                    />
                  </div>
                  {isTecmaAdmin ? (
                    <label className="text-xs font-medium text-foreground">
                      Ruolo sistema
                      <select
                        className="mt-1 h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
                        value={selectedUserSystemRole}
                        onChange={(event) =>
                          setSelectedUserSystemRole(event.target.value as 'user' | 'tecma_admin')
                        }
                      >
                        <option value="user">User</option>
                        <option value="tecma_admin">Tecma Admin</option>
                      </select>
                    </label>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={handleUpdateSelectedUser} disabled={saving}>
                      Salva utente
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDeleteSelectedUser}
                      disabled={saving}
                    >
                      Elimina utente
                    </Button>
                  </div>
                </>
              )}
            </div>

            {selectedUser != null ? (
              <div
                className="space-y-3 rounded-lg border border-border p-4"
                data-testid="permission-override-panel"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Permessi override
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Permessi extra rispetto al ruolo workspace. La wildcard{' '}
                      <code className="rounded bg-muted px-1 text-[10px]">*</code> e
                      riservata a Tecma Admin.
                    </p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Override: <strong>{overrideDraft.length}</strong>
                  </div>
                </div>

                <PermissionOverrideMatrix
                  groups={permissionCatalog}
                  selectedIds={overrideDraft}
                  basePermissions={basePermissions}
                  onChange={setOverrideDraft}
                  disabled={saving}
                />

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleSaveOverrides}
                    disabled={saving || !overrideDirty}
                    data-testid="save-overrides-button"
                  >
                    {saving ? 'Salvataggio...' : 'Salva override'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleDiscardOverrides}
                    disabled={saving || !overrideDirty}
                  >
                    Annulla modifiche
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
};
