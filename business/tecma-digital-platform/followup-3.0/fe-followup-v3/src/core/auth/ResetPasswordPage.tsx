import { FormEvent, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { Button } from "../../components/ui/button";
import { PasswordInput } from "../../components/ui/password-input";
import { LogoTecma } from "../../components/LogoTecma";

export const ResetPasswordPage = () => {
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
      setError("Link non valido.");
      return;
    }
    setLoading(true);
    try {
      await followupApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset non riuscito.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <LogoTecma className="h-10 w-auto" />
          <h1 className="text-xl font-semibold">Reimposta password</h1>
        </div>
        {done ? (
          <div className="space-y-4 text-center text-sm">
            <p>Password aggiornata. Puoi accedere con la nuova password.</p>
            <Link to="/login" className="text-primary underline">
              Vai al login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            {!token && <p className="text-sm text-destructive">Link non valido o scaduto.</p>}
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
              {loading ? "Salvataggio…" : "Salva password"}
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
