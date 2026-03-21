import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildItdLoginRedirectUrl, getJwtFromCookie } from "../../auth/itdLogin";
import { followupApi } from "../../api/followupApi";
import { login as authLogin, completeMfaLogin, isBssAuth } from "../../api/authApi";
import { HttpApiError, setTokens } from "../../api/http";
import { Button } from "../../components/ui/button";
import { CheckboxWithLabel } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { PasswordInput } from "../../components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../../components/ui/select";
import { LogoTecma } from "../../components/LogoTecma";

const BUSINESS_PLATFORM_LOGIN_URL =
  import.meta.env.VITE_BUSINESSPLATFORM_LOGIN ?? "https://businessplatform-biz-tecma-dev1.tecmasolutions.com/login";

const FORGOT_CREDENTIALS_URL = import.meta.env.VITE_FORGOT_CREDENTIALS_URL ?? "#";

const STORAGE_EMAIL = "followup3.rememberedEmail";

function formatAuthErrorMessage(e: unknown): string {
  if (e instanceof HttpApiError) {
    if (e.code === "ACCOUNT_LOCKED") {
      return "Account temporaneamente bloccato per troppi tentativi falliti. Riprova più tardi o contatta l'assistenza.";
    }
    if (e.code === "MFA_ENROLLMENT_REQUIRED") {
      return "È richiesta l'autenticazione a due fattori (MFA). Configura MFA dal profilo utente o chiedi supporto all'amministratore.";
    }
    if (e.code === "PASSWORD_POLICY" && e.hint) {
      return `${e.message} ${e.hint}`;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : "Errore login";
}

function getStoredEmail(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_EMAIL) ?? "";
  } catch {
    return "";
  }
}

type WorkspaceId = "dev-1" | "demo" | "prod";

const WORKSPACE_OPTIONS: { value: WorkspaceId; label: string }[] = [
  { value: "dev-1", label: "Dev-1 (solo sviluppatori)" },
  { value: "demo", label: "Demo" },
  { value: "prod", label: "Production" }
];

export const LoginPage = () => {
  const [email, setEmail] = useState(getStoredEmail);
  const [password, setPassword] = useState("");
  const [projectId, setProjectId] = useState("");
  const [rememberCredentials, setRememberCredentials] = useState<boolean>(
    () => typeof window !== "undefined" && !!getStoredEmail()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [loginStep, setLoginStep] = useState<1 | 2>(1);
  const [userAfterLogin, setUserAfterLogin] = useState<{ email: string; isAdmin: boolean } | null>(null);
  const [chosenWorkspace, setChosenWorkspace] = useState<WorkspaceId>("demo");
  const [ssoPending, setSsoPending] = useState<boolean>(
    () => typeof window !== "undefined" && !!getJwtFromCookie()
  );
  const bssAuthMode = isBssAuth();

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const backToRaw = params.get("backTo") || "/";
  const backTo = (() => {
    if (typeof window === "undefined") return "/";
    try {
      const resolved = new URL(backToRaw, window.location.origin);
      if (resolved.origin !== window.location.origin) return "/";
      const targetPath = `${resolved.pathname}${resolved.search}${resolved.hash}` || "/";
      if (targetPath.startsWith("/login")) return "/";
      return targetPath;
    } catch {
      if (backToRaw.startsWith("/login")) return "/";
      if (backToRaw.startsWith("/")) return backToRaw;
      return "/";
    }
  })();

  useEffect(() => {
    if (isBssAuth()) {
      setSsoPending(false);
      return;
    }
    const jwt = getJwtFromCookie();
    if (!jwt) {
      setSsoPending(false);
      return;
    }
    followupApi
      .ssoExchange(jwt)
      .then((result) => {
        if (typeof window !== "undefined") {
          setTokens(result.accessToken, result.refreshToken);
          window.sessionStorage.setItem("followup3.lastEmail", result.user.email);
          const params = new URLSearchParams(window.location.search);
          window.location.replace(params.get("backTo") || "/");
        }
      })
      .catch(() => {
        window.location.replace(buildItdLoginRedirectUrl(BUSINESS_PLATFORM_LOGIN_URL));
      });
  }, []);

  const finishLoginSuccess = (result: {
    accessToken: string;
    refreshToken: string;
    user: { email: string; isAdmin: boolean };
  }) => {
    if (typeof window !== "undefined") {
      setTokens(result.accessToken, result.refreshToken);
      window.sessionStorage.setItem("followup3.lastEmail", result.user.email);
      if (rememberCredentials) {
        try {
          window.localStorage.setItem(STORAGE_EMAIL, email.trim());
        } catch {
          // ignore quota or disabled localStorage
        }
      } else {
        try {
          window.localStorage.removeItem(STORAGE_EMAIL);
        } catch {
          // ignore
        }
      }
    }
    setMfaToken(null);
    setMfaCode("");
    setUserAfterLogin({ email: result.user.email, isAdmin: result.user.isAdmin });
    setChosenWorkspace(result.user.isAdmin ? "dev-1" : "demo");
    setLoginStep(2);
  };

  const handleAccedi = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (bssAuthMode && (!projectId || !projectId.trim())) {
      setError("Con accesso tramite piattaforma BSS è obbligatorio indicare il progetto (Project ID).");
      return;
    }
    setLoading(true);
    try {
      const result = await authLogin(email, password, bssAuthMode ? projectId.trim() : undefined);
      if (result.step === "mfa") {
        setMfaToken(result.mfaToken);
        setMfaCode("");
        return;
      }
      finishLoginSuccess(result);
    } catch (e) {
      setError(formatAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleMfaVerify = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!mfaToken || mfaCode.trim().length < 6) {
      setError("Inserisci il codice a 6 cifre dall'app di autenticazione.");
      return;
    }
    setLoading(true);
    try {
      const result = await completeMfaLogin(mfaToken, mfaCode.trim());
      finishLoginSuccess(result);
    } catch (e) {
      setError(formatAuthErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const handleMfaBack = () => {
    setMfaToken(null);
    setMfaCode("");
    setError(null);
  };

  const handleContinua = () => {
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("followup3.chosenWorkspaceId", chosenWorkspace);
      window.location.replace(backTo);
    }
  };

  const workspaceOptions = userAfterLogin?.isAdmin
    ? WORKSPACE_OPTIONS
    : WORKSPACE_OPTIONS.filter((o) => o.value !== "dev-1");

  if (loginStep === 2) {
    return (
      <div className="min-h-screen flex bg-auth-page text-foreground font-body">
      <div className="hidden md:flex w-5/12 flex-col justify-between border-r border-border/60 bg-auth-sidebar px-12 py-12 lg:px-10">
        <div>
          <LogoTecma className="h-12 w-12 opacity-90" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tecma Followup</p>
          <h1 className="mt-4 text-3xl font-normal leading-tight text-card-foreground">
            Scegli l’ambiente
              <br />
              e poi i progetti.
            </h1>
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-6 py-10 lg:px-10">
          <div className="w-full max-w-md">
            <div className="glass-panel rounded-ui px-7 py-8 shadow-panel">
              <div className="mb-6">
                <h2 className="text-2xl font-semibold text-foreground">Scegli l’ambiente</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Accesso effettuato come <span className="font-medium text-foreground">{userAfterLogin?.email}</span>
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Ambiente
                  </label>
                  <Select
                    value={chosenWorkspace}
                    onValueChange={(v) => setChosenWorkspace(v as WorkspaceId)}
                  >
                    <SelectTrigger className="h-11 min-h-11 rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaceOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleContinua} className="w-full min-h-11 rounded-lg">
                  Continua
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (ssoPending) {
    return (
      <div className="min-h-screen flex bg-auth-page items-center justify-center">
        <p className="text-sm text-muted-foreground">Accesso SSO in corso…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-auth-page text-foreground font-body">
      <div className="hidden md:flex w-5/12 flex-col justify-between border-r border-border/60 bg-auth-sidebar px-12 py-12 lg:px-10">
        <div>
          <LogoTecma className="h-12 w-12 opacity-90" />
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Tecma Followup</p>
          <h1 className="mt-4 text-3xl font-normal leading-tight text-card-foreground">
            Unifica rent + sell
            <br />
            in un unico cockpit operativo.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-muted-foreground">
            Accedi con le stesse credenziali della BusinessPlatform. Tutti i tuoi progetti e iniziative vengono
            caricati automaticamente.
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
                {mfaToken ? "Verifica in due passaggi" : "Accedi a Followup 3.0"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {mfaToken
                  ? "Inserisci il codice a 6 cifre dalla tua app di autenticazione (TOTP)."
                  : "Inserisci le tue credenziali."}
              </p>
            </div>

            {mfaToken ? (
              <form onSubmit={handleMfaVerify} className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Codice MFA
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={12}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="min-h-11 h-11 rounded-lg tracking-widest font-mono text-lg"
                  />
                </div>
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button type="submit" disabled={loading} className="mt-1 w-full min-h-11 rounded-lg">
                  {loading ? "Verifica…" : "Conferma e accedi"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading}
                  className="w-full min-h-11 rounded-lg"
                  onClick={handleMfaBack}
                >
                  Torna al login
                </Button>
              </form>
            ) : (
            <form onSubmit={handleAccedi} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Email
                </label>
                <Input
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
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Password
                </label>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="Inserisci la password"
                  className="min-h-11 h-11 rounded-lg"
                />
              </div>
              {bssAuthMode && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Project ID
                  </label>
                  <Input
                    type="text"
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    required
                    placeholder="ID progetto (obbligatorio per auth BSS)"
                    className="min-h-11 h-11 rounded-lg"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Con accesso tramite piattaforma BSS è necessario indicare il progetto a cui appartieni.
                  </p>
                </div>
              )}
              <CheckboxWithLabel
                label="Ricordami l'email"
                checked={rememberCredentials}
                onCheckedChange={setRememberCredentials}
                className="mt-1"
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="mt-1 w-full min-h-11 rounded-lg">
                {loading ? "Accesso in corso..." : "Accedi"}
              </Button>
              <p className="text-center py-2">
                {bssAuthMode ? (
                  <a href={FORGOT_CREDENTIALS_URL} className="inline-block py-2 text-sm text-primary hover:underline min-h-11 flex items-center justify-center">
                    Hai dimenticato le credenziali?
                  </a>
                ) : (
                  <Link to="/forgot-password" className="inline-block py-2 text-sm text-primary hover:underline min-h-11 flex items-center justify-center">
                    Password dimenticata?
                  </Link>
                )}
              </p>
            </form>
            )}

            {!bssAuthMode && (
              <div className="mt-6 border-t border-border pt-5 text-center">
                <button
                  type="button"
                  onClick={() => window.location.replace(buildItdLoginRedirectUrl(BUSINESS_PLATFORM_LOGIN_URL))}
                  className="text-sm text-muted-foreground hover:text-foreground hover:underline"
                >
                  Accedi con SSO aziendale
                </button>
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            Problemi di accesso? Contatta l’amministratore di BusinessPlatform o il team Tecma.
          </p>
        </div>
      </div>
    </div>
  );
};
