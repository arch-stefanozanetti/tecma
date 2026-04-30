import { FormEvent, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { HttpApiError, setTokens } from "../../api/http";
import { Button } from "../../components/ui/button";
import { PasswordInput } from "../../components/ui/password-input";
import { LogoTecma } from "../../components/LogoTecma";

export const SetPasswordFromInvitePage = () => {
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    if (password !== confirm) {
      setError("Le password non coincidono.");
      return;
    }
    if (!token) {
      setError("Link non valido (manca il token).");
      return;
    }
    setLoading(true);
    try {
      const res = await followupApi.setPasswordFromInvite({ token, password });
      setTokens(res.accessToken, res.refreshToken);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("followup3.lastEmail", res.user.email);
      }
      setDone(true);
      window.location.replace("/");
    } catch (err) {
      if (err instanceof HttpApiError && err.code === "PASSWORD_POLICY" && err.hint) {
        setError(`${err.message} ${err.hint}`);
      } else {
        setError(err instanceof Error ? err.message : "Impossibile impostare la password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <LogoTecma className="h-10 w-auto" />
          <h1 className="text-xl font-semibold">Imposta la password</h1>
          <p className="text-center text-sm text-muted-foreground">
            Completa la registrazione scegliendo una password per il tuo account.
          </p>
        </div>
        {!token && (
          <p className="text-sm text-destructive">Link non valido. Richiedi un nuovo invito all&apos;amministratore.</p>
        )}
        {done ? (
          <p className="text-sm text-muted-foreground">Reindirizzamento in corso…</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <label className="text-sm font-medium">Nuova password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="Minimo 8 caratteri"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Conferma password</label>
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !token}>
              {loading ? "Salvataggio…" : "Attiva account"}
            </Button>
          </form>
        )}
        <p className="text-center text-sm">
          <Link to="/login" className="text-primary underline">
            Torna al login
          </Link>
        </p>
      </div>
    </div>
  );
};
