import { type FormEvent, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { LogoTecma } from '../../components/LogoTecma';
import { Button } from '../../components/ui/button';
import { CheckboxWithLabel } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { http } from '../../lib/http';

function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  const a = window.sessionStorage.getItem('followup.auth.accessToken');
  const b = window.sessionStorage.getItem('followup3.accessToken');
  const t = (a ?? b ?? '').trim();
  return t.length > 0 ? t : null;
}

type WorkspaceRole = 'owner' | 'admin' | 'collaborator' | 'viewer';

const ROLE_OPTIONS: Array<{ value: WorkspaceRole; label: string }> = [
  { value: 'collaborator', label: 'Collaboratore' },
  { value: 'viewer', label: 'Solo lettura' },
  { value: 'admin', label: 'Amministratore workspace' },
  { value: 'owner', label: 'Proprietario' },
];

/**
 * Wizard guidato (3 passi) per creare workspace, progetto collegato e invitare un utente
 * con assegnazione al progetto — allineato alle API production in `services/api`.
 */
export const OrganizationSetupPage = () => {
  const navigate = useNavigate();
  const accessToken = useMemo(() => readAccessToken(), []);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const [projectName, setProjectName] = useState('');
  const [projectCode, setProjectCode] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteFullName, setInviteFullName] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('collaborator');
  const [assignToProject, setAssignToProject] = useState(true);

  const [done, setDone] = useState(false);

  if (accessToken == null) {
    return <Navigate to="/" replace />;
  }

  const steps = ['Workspace', 'Progetto', 'Team'];

  const handleWorkspaceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = workspaceName.trim();
    if (name.length < 2) {
      setError('Inserisci un nome workspace di almeno 2 caratteri.');
      return;
    }
    setLoading(true);
    try {
      const res = await http<{ data: { _id: string } }>('/workspaces', {
        method: 'POST',
        accessToken,
        body: { name, mfaRequired: false },
      });
      setWorkspaceId(res.data._id);
      setStep(1);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Impossibile creare il workspace. Verifica di avere permessi da amministratore (es. tecma_admin) finché il JWT non include i permessi da ruolo workspace.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (workspaceId == null) {
      setError('Workspace mancante.');
      return;
    }
    const name = projectName.trim();
    const code = projectCode.trim().toUpperCase();
    if (name.length < 2 || code.length < 2) {
      setError('Nome e codice progetto devono avere almeno 2 caratteri.');
      return;
    }
    setLoading(true);
    try {
      const res = await http<{ data: { _id: string } }>('/projects', {
        method: 'POST',
        accessToken,
        body: { workspaceId, name, code },
      });
      setProjectId(res.data._id);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creazione progetto non riuscita.');
    } finally {
      setLoading(false);
    }
  };

  const handleTeamSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (workspaceId == null || projectId == null) {
      setError('Dati workspace o progetto mancanti.');
      return;
    }
    const email = inviteEmail.trim().toLowerCase();
    const fullName = inviteFullName.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2) {
      setError('Inserisci email valida e nome completo (minimo 2 caratteri).');
      return;
    }
    setLoading(true);
    try {
      const invited = await http<{ data: { _id: string } }>('/users', {
        method: 'POST',
        accessToken,
        body: { email, fullName, role: inviteRole },
      });
      const newUserId = invited.data._id;

      await http(`/workspaces/${encodeURIComponent(workspaceId)}/members`, {
        method: 'POST',
        accessToken,
        body: { userId: newUserId, role: inviteRole },
      });

      if (assignToProject) {
        await http(
          `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(newUserId)}/projects`,
          {
            method: 'POST',
            accessToken,
            body: { projectId },
          },
        );
      }

      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Invito o assegnazione non riusciti. L’utente potrebbe già esistere: in quel caso aggiungilo dal backoffice come membro.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-app px-4 py-10 font-body text-foreground">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 flex flex-col items-center gap-4">
          <LogoTecma className="h-14 w-14 opacity-90" />
          <div className="text-center">
            <h1 className="text-xl font-semibold tracking-tight">Configura la tua organizzazione</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tre passaggi: workspace, progetto immobiliare, invito al team.
            </p>
          </div>
        </div>

        <ol className="mb-8 flex justify-center gap-2">
          {steps.map((label, i) => (
            <li
              key={label}
              className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
                i === step
                  ? 'bg-primary text-primary-foreground'
                  : i < step
                    ? 'bg-muted text-foreground'
                    : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/20 text-[10px]">
                {i + 1}
              </span>
              {label}
            </li>
          ))}
        </ol>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-panel">
          {done ? (
            <div className="space-y-4 text-center">
              <p className="text-sm font-medium text-foreground">Setup completato.</p>
              <p className="text-sm text-muted-foreground">
                Workspace e progetto sono pronti; l’utente invitato riceverà credenziali secondo la
                policy del tenant (email di attivazione in roadmap).
              </p>
              <Button type="button" className="w-full" onClick={() => navigate('/')}>
                Vai all’app
              </Button>
            </div>
          ) : null}

          {!done && step === 0 ? (
            <form onSubmit={handleWorkspaceSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Un workspace raggruppa progetti e permessi del team (modello ispirato al POC, versione
                production).
              </p>
              <div>
                <label htmlFor="ws-name" className="mb-1 block text-xs font-medium text-foreground">
                  Nome workspace
                </label>
                <Input
                  id="ws-name"
                  value={workspaceName}
                  onChange={(ev) => setWorkspaceName(ev.target.value)}
                  placeholder="Es. Nord Milano Residenziale"
                  autoComplete="organization"
                />
              </div>
              {error != null ? <p className="text-sm text-destructive">{error}</p> : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creazione…' : 'Continua'}
              </Button>
            </form>
          ) : null}

          {!done && step === 1 ? (
            <form onSubmit={handleProjectSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Il progetto è collegato automaticamente al workspace. Potrai aggiungerne altri dalla
                sezione Progetti (in sviluppo).
              </p>
              <div>
                <label htmlFor="proj-name" className="mb-1 block text-xs font-medium text-foreground">
                  Nome progetto
                </label>
                <Input
                  id="proj-name"
                  value={projectName}
                  onChange={(ev) => setProjectName(ev.target.value)}
                  placeholder="Es. Residenza Arborea"
                />
              </div>
              <div>
                <label htmlFor="proj-code" className="mb-1 block text-xs font-medium text-foreground">
                  Codice (univoco, maiuscolo)
                </label>
                <Input
                  id="proj-code"
                  value={projectCode}
                  onChange={(ev) => setProjectCode(ev.target.value)}
                  placeholder="ARB"
                />
              </div>
              {error != null ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(0)}>
                  Indietro
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Salvataggio…' : 'Continua'}
                </Button>
              </div>
            </form>
          ) : null}

          {!done && step === 2 ? (
            <form onSubmit={handleTeamSubmit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Invitiamo un utente: viene creato come <strong>invited</strong>, aggiunto al workspace
                e — se scegli sotto — limitato al progetto creato (tabella{' '}
                <code className="rounded bg-muted px-1 text-xs">tz_workspace_user_projects</code>
                ).
              </p>
              <div>
                <label htmlFor="inv-email" className="mb-1 block text-xs font-medium text-foreground">
                  Email
                </label>
                <Input
                  id="inv-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(ev) => setInviteEmail(ev.target.value)}
                  placeholder="nome@azienda.it"
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="inv-name" className="mb-1 block text-xs font-medium text-foreground">
                  Nome e cognome
                </label>
                <Input
                  id="inv-name"
                  value={inviteFullName}
                  onChange={(ev) => setInviteFullName(ev.target.value)}
                  placeholder="Es. Laura Bianchi"
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="inv-role" className="mb-1 block text-xs font-medium text-foreground">
                  Ruolo nel workspace
                </label>
                <select
                  id="inv-role"
                  value={inviteRole}
                  onChange={(ev) => setInviteRole(ev.target.value as WorkspaceRole)}
                  className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <CheckboxWithLabel
                checked={assignToProject}
                onCheckedChange={(checked) => setAssignToProject(checked)}
                label="Assegna l’accesso al progetto creatato (consigliato)"
              />
              {error != null ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)}>
                  Indietro
                </Button>
                <Button type="submit" className="flex-1" disabled={loading}>
                  {loading ? 'Invio…' : 'Invita e termina'}
                </Button>
              </div>
            </form>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <button
            type="button"
            className="underline underline-offset-2 hover:text-foreground"
            onClick={() => navigate('/')}
          >
            Torna alla home senza completare
          </button>
        </p>
      </div>
    </div>
  );
};
