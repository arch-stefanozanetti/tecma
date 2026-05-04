import { isTecmaPlatformAdmin } from '@followup/shared-rbac';
import { type FormEvent, useState } from 'react';

import { LogoTecma } from '../../components/LogoTecma';
import { Button } from '../../components/ui/button';
import { CheckboxWithLabel } from '../../components/ui/checkbox';
import { Input } from '../../components/ui/input';
import { PasswordInput } from '../../components/ui/password-input';
import { http } from '../../lib/http';

const FORGOT_CREDENTIALS_URL = import.meta.env.VITE_FORGOT_CREDENTIALS_URL ?? '#';
const BUSINESS_PLATFORM_LOGIN_URL = import.meta.env.VITE_BUSINESSPLATFORM_LOGIN ?? '#';

const STORAGE_EMAIL = 'followup3.rememberedEmail';

function getStoredEmail(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STORAGE_EMAIL) ?? '';
  } catch {
    return '';
  }
}

interface LoginResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; systemRole?: string };
  };
}

/**
 * Stesso contratto di `reply.send({ data: result })` ma a volte un proxy o un client
 * restituisce i campi in root: li alziamo sotto `data` per un’unica validazione.
 */
function liftGreenfieldLoginEnvelope(raw: unknown): unknown {
  if (raw == null || typeof raw !== 'object') return raw;
  const root = raw as Record<string, unknown>;
  if (root.data != null) return raw;
  if (
    typeof root.accessToken === 'string' &&
    typeof root.refreshToken === 'string' &&
    root.user != null &&
    typeof root.user === 'object'
  ) {
    return {
      data: {
        accessToken: root.accessToken,
        refreshToken: root.refreshToken,
        user: root.user,
      },
    };
  }
  return raw;
}

function parseUserId(user: Record<string, unknown>): string | null {
  const id = user.id;
  if (typeof id === 'string' && id !== '') return id;
  if (typeof id === 'number' && Number.isFinite(id)) return String(id);
  return null;
}

/** API greenfield: `{ data: { accessToken, refreshToken, user } }`. */
function getGreenfieldLoginPayload(raw: unknown): LoginResponse['data'] | null {
  if (raw == null || typeof raw !== 'object') return null;
  const root = raw as Record<string, unknown>;
  const data = root.data;
  if (data == null || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.accessToken !== 'string' || typeof d.refreshToken !== 'string') return null;
  const u = d.user;
  if (u == null || typeof u !== 'object') return null;
  const user = u as Record<string, unknown>;
  const id = parseUserId(user);
  if (id == null || typeof user.email !== 'string') return null;
  return {
    accessToken: d.accessToken,
    refreshToken: d.refreshToken,
    user: {
      id,
      email: user.email,
      ...(typeof user.systemRole === 'string' ? { systemRole: user.systemRole } : {}),
    },
  };
}

function getLoginShapeDebugKeys(raw: unknown): { rootKeys: string[]; dataKeys: string[] } {
  if (raw == null || typeof raw !== 'object') return { rootKeys: [], dataKeys: [] };
  const root = raw as Record<string, unknown>;
  const data = root.data;
  const dataKeys =
    data != null && typeof data === 'object' ? Object.keys(data as Record<string, unknown>) : [];
  return { rootKeys: Object.keys(root), dataKeys };
}

const LOGIN_SHAPE_HINT =
  'Risposta login non valida: il backend greenfield deve restituire { data: { accessToken, refreshToken, user } }. Verifica VITE_API_BASE_URL verso services/api (URL base che termina con /v1).';

interface LoginPageProps {
  onSuccess: (
    accessToken: string,
    profile: { id: string; email: string; systemRole: string },
  ) => void;
}

export const LoginPage = ({ onSuccess }: LoginPageProps) => {
  const [email, setEmail] = useState(getStoredEmail);
  const [password, setPassword] = useState('');
  const [rememberCredentials, setRememberCredentials] = useState<boolean>(
    () => typeof window !== 'undefined' && !!getStoredEmail(),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAccedi = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const raw = await http<unknown>('/auth/login', {
        method: 'POST',
        body: { email: normalizedEmail, password },
      });
      const payload = getGreenfieldLoginPayload(liftGreenfieldLoginEnvelope(raw));
      if (payload == null) {
        if (import.meta.env.DEV) {
          const keys = getLoginShapeDebugKeys(raw);
          console.warn('[LoginPage] Payload login non valido (solo chiavi)', keys);
        }
        setError(LOGIN_SHAPE_HINT);
        return;
      }
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('followup.auth.accessToken', payload.accessToken);
        window.sessionStorage.setItem('followup.auth.refreshToken', payload.refreshToken);
        window.sessionStorage.setItem('followup3.accessToken', payload.accessToken);
        window.sessionStorage.setItem('followup3.lastEmail', payload.user.email);
        window.sessionStorage.setItem(
          'followup3.isAdmin',
          isTecmaPlatformAdmin(payload.user.systemRole) ? '1' : '0',
        );
        window.sessionStorage.removeItem('followup.apiEnvironment');
        window.sessionStorage.removeItem('followup.workspaceId');
        if (rememberCredentials) {
          try {
            window.localStorage.setItem(STORAGE_EMAIL, normalizedEmail);
          } catch {
            /* ignore */
          }
        } else {
          try {
            window.localStorage.removeItem(STORAGE_EMAIL);
          } catch {
            /* ignore */
          }
        }
      }
      const u = payload.user;
      if (u?.id == null || typeof u.email !== 'string') {
        setError('Risposta login incompleta (profilo utente).');
        return;
      }
      onSuccess(payload.accessToken, {
        id: u.id,
        email: u.email,
        systemRole: u.systemRole ?? 'user',
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Credenziali non valide.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex bg-auth-page text-foreground font-body">
      <div className="hidden md:flex w-5/12 flex-col justify-between border-r border-border/60 bg-auth-sidebar px-12 py-12 lg:px-10">
        <div>
          <LogoTecma className="h-12 w-12 opacity-90" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
            Tecma Followup
          </p>
          <h1 className="mt-4 text-3xl font-normal leading-tight text-card-foreground">
            Unifica rent + sell
            <br />
            in un unico cockpit operativo.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Accedi con le stesse credenziali della BusinessPlatform. Tutti i tuoi progetti e
            iniziative vengono caricati automaticamente.
          </p>
        </div>
        <div className="space-y-3 text-xs text-muted-foreground">
          <p className="font-semibold text-card-foreground">Pensato per team commerciali moderni</p>
          <ul className="space-y-1">
            <li>• Calendario multi-progetto con priorità intelligenti</li>
            <li>• Registry clienti e appartamenti unificato rent + sell</li>
            <li>• Flussi guidati per proposte, compromessi e rogiti</li>
          </ul>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-10 lg:px-10">
        <div className="w-full max-w-md">
          <div className="glass-panel rounded-ui px-7 py-8 shadow-panel">
            <div className="mb-6 flex flex-col items-center lg:items-start">
              <LogoTecma className="h-10 w-10 opacity-90 lg:hidden" />
              <h2 className="mt-2 lg:mt-0 text-2xl font-semibold text-foreground">
                Accedi a Followup 3.0
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">Inserisci le tue credenziali.</p>
            </div>

            <form onSubmit={handleAccedi} className="space-y-3">
              <div>
                <label
                  htmlFor="login-email"
                  className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Email
                </label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="nome.cognome@azienda.it"
                  className="min-h-11 h-11 rounded-lg"
                />
              </div>
              <div>
                <label
                  htmlFor="login-password"
                  className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
                >
                  Password
                </label>
                <PasswordInput
                  id="login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Inserisci la password"
                  className="min-h-11 h-11 rounded-lg"
                />
              </div>
              <CheckboxWithLabel
                label="Ricordami l'email"
                checked={rememberCredentials}
                onCheckedChange={setRememberCredentials}
                className="mt-1"
              />
              {error != null ? <p className="text-xs text-destructive">{error}</p> : null}
              <Button type="submit" disabled={loading} className="mt-1 w-full min-h-11 rounded-lg">
                {loading ? 'Accesso in corso...' : 'Accedi'}
              </Button>
              <p className="text-center py-2">
                <a
                  href={FORGOT_CREDENTIALS_URL}
                  className="inline-block py-2 text-sm text-primary hover:underline min-h-11 flex items-center justify-center"
                >
                  Password dimenticata?
                </a>
              </p>
            </form>

            <div className="mt-6 border-t border-border pt-5 text-center">
              <button
                type="button"
                onClick={() => window.location.assign(BUSINESS_PLATFORM_LOGIN_URL)}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                Accedi con SSO aziendale
              </button>
            </div>
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Problemi di accesso? Contatta l&apos;amministratore di BusinessPlatform o il team Tecma.
          </p>
        </div>
      </div>
    </div>
  );
};
