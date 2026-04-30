import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { LogoTecma } from "../../components/LogoTecma";

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await followupApi.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Richiesta non riuscita.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8 rounded-lg border border-border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <LogoTecma className="h-10 w-auto" />
          <h1 className="text-xl font-semibold">Password dimenticata</h1>
          <p className="text-center text-sm text-muted-foreground">
            Inserisci l&apos;email associata all&apos;account. Se esiste, riceverai un link per reimpostare la password.
          </p>
        </div>
        {sent ? (
          <p className="text-sm text-muted-foreground">
            Se l&apos;indirizzo è registrato, controlla la posta per il link di reset.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Invio…" : "Invia link"}
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
