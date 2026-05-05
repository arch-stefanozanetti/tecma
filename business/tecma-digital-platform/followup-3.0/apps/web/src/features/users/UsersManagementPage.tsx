import { useEffect, useMemo, useState, type FormEvent } from 'react';

import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { http } from '../../lib/http';

type WorkspaceRow = { _id: string; name?: string };
type UserRow = {
  _id: string;
  email: string;
  fullName?: string;
  role?: string;
  systemRole?: string;
  status?: string;
};

type UsersResponse = { data: UserRow[] };
type WorkspacesResponse = { data: WorkspaceRow[] };

interface UsersManagementPageProps {
  accessToken: string;
  isTecmaAdmin: boolean;
}

export const UsersManagementPage = ({ accessToken, isTecmaAdmin }: UsersManagementPageProps) => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [selectedUserSystemRole, setSelectedUserSystemRole] = useState<'user' | 'tecma_admin'>('user');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<'owner' | 'admin' | 'collaborator' | 'viewer'>('viewer');
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((entry) => entry._id === selectedUserId) ?? null,
    [users, selectedUserId],
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
    if (selectedUser == null) {
      setSelectedUserName('');
      setSelectedUserSystemRole('user');
      return;
    }
    setSelectedUserName(selectedUser.fullName ?? '');
    setSelectedUserSystemRole(
      selectedUser.systemRole === 'tecma_admin' ? 'tecma_admin' : 'user',
    );
  }, [selectedUser]);

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
      setError(requestError instanceof Error ? requestError.message : 'Invito utente non riuscito.');
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
      setError(requestError instanceof Error ? requestError.message : 'Eliminazione utente fallita.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-panel">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-foreground">Users Management</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestisci utenti, inviti e ruoli di sistema.
        </p>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Caricamento utenti...</p> : null}
      {error != null ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
      {successMessage != null ? <p className="mb-3 text-sm text-emerald-600">{successMessage}</p> : null}

      {!loading ? (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Utenti
            </p>
            {users.map((entry) => {
              const selected = entry._id === selectedUserId;
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
                >
                  <p className="truncate font-medium">{entry.fullName ?? entry.email}</p>
                  <p className="truncate text-xs text-muted-foreground">{entry.email}</p>
                </button>
              );
            })}
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nessun utente disponibile.</p>
            ) : null}
          </div>

          <div className="space-y-6">
            <form onSubmit={handleInvite} className="space-y-3 rounded-lg border border-border p-4">
              <h3 className="text-sm font-semibold text-foreground">Invita utente</h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
                <Input
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="nome@azienda.it"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Nome completo</label>
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
                  </p>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-foreground">Nome completo</label>
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
          </div>
        </div>
      ) : null}
    </section>
  );
};
