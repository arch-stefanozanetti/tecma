import { FormEvent, useCallback, useEffect, useState } from "react";
import { isBssAuth } from "../../api/authApi";
import { followupApi } from "../../api/followupApi";
import { HttpApiError } from "../../api/http";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

function formatErr(e: unknown): string {
  if (e instanceof HttpApiError) return e.message;
  return e instanceof Error ? e.message : "Operazione non riuscita";
}

export function AccountSecurityPage() {
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [otpauthUrl, setOtpauthUrl] = useState<string | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadMe = useCallback(async () => {
    if (isBssAuth()) {
      setMfaEnabled(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const me = await followupApi.me();
      setMfaEnabled(me.mfaEnabled === true);
    } catch {
      setError("Impossibile caricare lo stato di sicurezza.");
      setMfaEnabled(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const onStartSetup = async () => {
    setBusy(true);
    setError(null);
    setBackupCodes(null);
    try {
      const r = await followupApi.startMfaSetup();
      setOtpauthUrl(r.otpauthUrl);
      setConfirmCode("");
    } catch (e) {
      setError(formatErr(e));
    } finally {
      setBusy(false);
    }
  };

  const onConfirmSetup = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await followupApi.confirmMfaSetup(confirmCode);
      setBackupCodes(r.backupCodes);
      setOtpauthUrl(null);
      setConfirmCode("");
      setMfaEnabled(true);
    } catch (e) {
      setError(formatErr(e));
    } finally {
      setBusy(false);
    }
  };

  const onDisable = async (ev: FormEvent) => {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await followupApi.disableMfa(disableCode);
      setDisableCode("");
      setMfaEnabled(false);
      setBackupCodes(null);
      setOtpauthUrl(null);
    } catch (e) {
      setError(formatErr(e));
    } finally {
      setBusy(false);
    }
  };

  if (isBssAuth()) {
    return (
      <p className="text-sm text-muted-foreground">
        Con l&apos;accesso tramite piattaforma BSS l&apos;MFA è gestito dal provider di identità aziendale, non da
        questa schermata.
      </p>
    );
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  }

  return (
    <div className="max-w-lg space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground">Stato MFA (TOTP)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {mfaEnabled
            ? "L’autenticazione a due fattori è attiva per il tuo account."
            : "L’autenticazione a due fattori non è attiva. Ti consigliamo di attivarla, soprattutto se richiesta dal tuo workspace."}
        </p>
      </div>

      {!mfaEnabled && !otpauthUrl && (
        <div>
          <Button type="button" onClick={() => void onStartSetup()} disabled={busy}>
            {busy ? "Avvio…" : "Avvia configurazione MFA"}
          </Button>
        </div>
      )}

      {otpauthUrl && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-foreground">
            1. Aggiungi l&apos;account nell&apos;app di autenticazione (Google Authenticator, Microsoft Authenticator,
            ecc.).
          </p>
          <p className="text-sm text-muted-foreground">
            Su mobile puoi usare il link sotto; su desktop copia l&apos;URI <code className="text-xs">otpauth://</code>{" "}
            nell&apos;app.
          </p>
          <a
            href={otpauthUrl}
            className="inline-block text-sm font-medium text-primary underline"
          >
            Apri nell&apos;app di autenticazione
          </a>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">URI segreto (otpauth)</label>
            <Input readOnly value={otpauthUrl} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
          </div>
          <form onSubmit={onConfirmSetup} className="space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">2. Codice a 6 cifre per confermare</label>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
              maxLength={12}
              className="max-w-xs font-mono tracking-widest"
            />
            <Button type="submit" disabled={busy || confirmCode.replace(/\s/g, "").length < 6}>
              {busy ? "Verifica…" : "Conferma e attiva MFA"}
            </Button>
          </form>
        </div>
      )}

      {backupCodes && backupCodes.length > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-foreground">Codici di backup</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Salvali in un posto sicuro: ogni codice funziona una volta se perdi l&apos;accesso al telefono.
          </p>
          <ul className="mt-3 grid gap-1 font-mono text-xs">
            {backupCodes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {mfaEnabled && (
        <form onSubmit={onDisable} className="space-y-3 rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Disattiva MFA</h3>
          <p className="text-sm text-muted-foreground">
            Inserisci un codice TOTP valido o un codice di backup per disattivare l&apos;autenticazione a due fattori.
          </p>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Codice TOTP o backup"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value.trim())}
            className="max-w-xs font-mono"
          />
          <Button type="submit" variant="destructive" disabled={busy || disableCode.length < 6}>
            {busy ? "Disattivazione…" : "Disattiva MFA"}
          </Button>
        </form>
      )}
    </div>
  );
}
