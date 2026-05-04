import { type FormEvent, useEffect, useMemo, useState } from 'react';

import { Button } from '../../components/ui/button';
import { CheckboxWithLabel } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { http } from '../../lib/http';

type Workspace = {
  _id: string;
  name?: string;
  mfaRequired?: boolean;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace._id === selectedWorkspaceId) ?? null,
    [selectedWorkspaceId, workspaces],
  );

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

      {loading ? <p className="mt-6 text-sm text-muted-foreground">Caricamento workspace...</p> : null}
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="workspace-name" className="mb-1 block text-xs font-medium text-foreground">
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

            {successMessage != null ? <p className="text-sm text-emerald-600">{successMessage}</p> : null}
            {error != null ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" disabled={saving || selectedWorkspaceId == null}>
              {saving ? 'Salvataggio...' : 'Salva modifiche'}
            </Button>
          </form>
        </div>
      ) : null}
    </section>
  );
};
