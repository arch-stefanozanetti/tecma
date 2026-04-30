import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CheckCircle2,
  Copy,
  ExternalLink,
  KeyRound,
  Mail,
  MessageCircle,
  Phone,
  Sparkles
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { Alert } from "../../components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { followupApi } from "../../api/followupApi";
import { useToast } from "../../contexts/ToastContext";
import type { WorkspaceAiConfig } from "../../types/domain";

const STEPS = 5;

type AiProvider = "claude" | "openai" | "gemini";

type Props = {
  workspaceId: string;
  readOnly: boolean;
  loading: boolean;
  saving: boolean;
  config: Awaited<ReturnType<typeof followupApi.getZeusPocConfig>>["data"] | null;
  voice: boolean;
  setVoice: (v: boolean) => void;
  whatsapp: boolean;
  setWhatsapp: (v: boolean) => void;
  email: boolean;
  setEmail: (v: boolean) => void;
  chat: boolean;
  setChat: (v: boolean) => void;
  sid: string;
  setSid: (v: string) => void;
  token: string;
  setToken: (v: string) => void;
  waFrom: string;
  setWaFrom: (v: string) => void;
  emailSecret: string;
  setEmailSecret: (v: string) => void;
  ingestSecret: string;
  setIngestSecret: (v: string) => void;
  save: () => Promise<void>;
  initSecret: () => Promise<void>;
  loadAll: () => void;
  copy: (text: string) => void;
  urls: { nativeIngest: string; twilioVoice: string; twilioWhatsapp: string; email: string; sipVoice?: string };
};

export function ZeusSetupWizard(props: Props) {
  const {
    workspaceId,
    readOnly,
    loading,
    saving,
    config,
    voice,
    setVoice,
    whatsapp,
    setWhatsapp,
    email,
    setEmail,
    chat,
    setChat,
    sid,
    setSid,
    token,
    setToken,
    waFrom,
    setWaFrom,
    emailSecret,
    setEmailSecret,
    ingestSecret,
    setIngestSecret,
    save,
    initSecret,
    loadAll,
    copy,
    urls
  } = props;

  const { toastSuccess, toastError } = useToast();
  const [step, setStep] = useState(1);
  const [aiConfig, setAiConfig] = useState<WorkspaceAiConfig | null>(null);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiProvider, setAiProvider] = useState<AiProvider>("claude");
  const [aiKey, setAiKey] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [secretsDone, setSecretsDone] = useState(false);
  const [tryReply, setTryReply] = useState("");
  const [tryPending, setTryPending] = useState(false);
  const [outlookBusy, setOutlookBusy] = useState(false);

  const loadAi = useCallback(() => {
    if (!workspaceId) return;
    setAiLoading(true);
    followupApi
      .getWorkspaceAiConfig(workspaceId)
      .then((r) => setAiConfig(r))
      .catch(() => setAiConfig(null))
      .finally(() => setAiLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    loadAi();
  }, [loadAi]);

  useEffect(() => {
    const p = aiConfig?.provider;
    if (p === "claude" || p === "openai" || p === "gemini") setAiProvider(p);
  }, [aiConfig?.provider]);

  useEffect(() => {
    const masked = config?.emailWebhookSecretMasked;
    if (masked && String(masked).replace(/•|\s/g, "").length > 0) setSecretsDone(true);
  }, [config?.emailWebhookSecretMasked]);

  const aiOk = Boolean(aiConfig?.configured === true || (aiConfig?.apiKeyMasked && aiConfig.apiKeyMasked.length > 0));

  const goNext = () => setStep((s) => Math.min(STEPS, s + 1));
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  const saveAiInline = () => {
    if (readOnly) return;
    const key = aiKey.trim();
    if (!key) {
      toastError("Incolla la chiave API del provider scelto.");
      return;
    }
    setAiSaving(true);
    followupApi
      .putWorkspaceAiConfig(workspaceId, { provider: aiProvider, apiKey: key })
      .then(() => {
        setAiKey("");
        toastSuccess("AI salvata per questo workspace");
        loadAi();
      })
      .catch((err: Error) => toastError(err?.message ?? "Salvataggio AI non riuscito"))
      .finally(() => setAiSaving(false));
  };

  const saveChannels = () => {
    if (readOnly) return;
    void save()
      .then(() => goNext())
      .catch(() => {
        /* toast da save */
      });
  };

  const generateSecrets = () => {
    if (readOnly) return;
    void initSecret()
      .then(() => setSecretsDone(true))
      .catch(() => {
        /* toast da initSecret */
      });
  };

  const openConnectorsInNewTab = () => {
    window.open("/integrations?tab=connettori", "_blank", "noopener,noreferrer");
  };

  const connectOutlookPopup = () => {
    if (readOnly) return;
    setOutlookBusy(true);
    followupApi
      .getOutlookAuthRedirect(workspaceId)
      .then((url) => {
        const w = window.open(url, "zeus-outlook-oauth", "width=520,height=720,scrollbars=yes");
        if (!w) {
          toastError("Abilita i popup per questo sito, oppure usa il pulsante «Apri in nuova scheda» sotto.");
        } else {
          toastSuccess("Finestra Microsoft aperta: completa l’accesso, poi torna qui e continua il wizard.");
        }
      })
      .catch((err: Error) => toastError(err?.message ?? "Impossibile avviare Outlook"))
      .finally(() => setOutlookBusy(false));
  };

  const sendTry = () => {
    const el = document.getElementById("zeus-wizard-try-input") as HTMLTextAreaElement | null;
    const text = el?.value?.trim() ?? "";
    if (!text || readOnly) return;
    setTryPending(true);
    followupApi
      .postZeusChat(workspaceId, { text })
      .then((r) => {
        setTryReply(r.data.reply);
        if (el) el.value = "";
        toastSuccess("Risposta ricevuta");
        loadAll();
      })
      .catch(() => toastError("Prova non riuscita: controlla il passo «Intelligenza artificiale» sopra."))
      .finally(() => setTryPending(false));
  };

  const progress = Math.round((step / STEPS) * 100);

  if (loading && !config) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Caricamento…</p>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            Passo {step} di {STEPS}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6 text-center pt-2">
          <div className="flex justify-center">
            <div className="rounded-full bg-primary/10 p-4">
              <Bot className="h-12 w-12 text-primary" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground">ZEUS, tre cose e sei pronto</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Colleghi l&apos;intelligenza artificiale, provi una chat qui dentro, scegli come ti contattano i clienti. Senza uscire dalla pagina quando possibile.
            </p>
          </div>
          <ul className="text-left text-sm space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <li className="flex gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong className="font-medium text-foreground">Passo 1–2:</strong> chiave AI e prova risposta.
              </span>
            </li>
            <li className="flex gap-2">
              <Mail className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong className="font-medium text-foreground">Passo 3:</strong> email e WhatsApp si collegano da qui (finestra o nuova scheda), senza perderti nel menu.
              </span>
            </li>
            <li className="flex gap-2">
              <Phone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong className="font-medium text-foreground">Chiamate:</strong> se attivi la voce, all&apos;ultimo passo ti diamo i passaggi Twilio uno per uno.
              </span>
            </li>
          </ul>
          <Button type="button" size="lg" className="w-full sm:w-auto" onClick={goNext}>
            Inizia
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-5">
          <h3 className="text-lg font-semibold">Intelligenza artificiale</h3>
          <p className="text-sm text-muted-foreground">
            Scegli il provider e incolla la chiave API. Resti in questa schermata: non serve aprire altre sezioni dell&apos;app.
          </p>
          {aiLoading ? (
            <p className="text-sm text-muted-foreground">Verifica in corso…</p>
          ) : aiOk ? (
            <Alert variant="info" title="Configurazione presente">
              <span className="text-sm">
                AI già attiva per questo workspace
                {aiConfig?.provider ? ` (${aiConfig.provider})` : ""}.
                {aiConfig?.apiKeyMasked ? ` Chiave: ${aiConfig.apiKeyMasked}` : ""} Puoi andare avanti o incollare una nuova chiave per aggiornare.
              </span>
            </Alert>
          ) : (
            <Alert variant="warning" title="Serve una chiave">
              <span className="text-sm">Compila i campi sotto per attivare ZEUS.</span>
            </Alert>
          )}

          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Provider</label>
              <Select
                value={aiProvider}
                onValueChange={(v) => setAiProvider(v as AiProvider)}
                disabled={readOnly || aiSaving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Anthropic (Claude)</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="gemini">Google (Gemini)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Chiave API</label>
              <Input
                value={aiKey}
                onChange={(e) => setAiKey(e.target.value)}
                type="password"
                autoComplete="off"
                placeholder="Incolla la chiave segreta"
                disabled={readOnly || aiSaving}
              />
            </div>
            <Button type="button" onClick={saveAiInline} disabled={readOnly || aiSaving}>
              {aiSaving ? "Salvataggio…" : "Salva chiave AI"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={loadAi} disabled={aiLoading}>
              Ricontrolla stato
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Indietro
            </Button>
            <Button type="button" onClick={goNext} disabled={!aiOk}>
              Continua
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-5">
          <h3 className="text-lg font-semibold">Prova subito</h3>
          <p className="text-sm text-muted-foreground">Scrivi una frase (anche «Ciao») e verifica che ZEUS risponda prima di configurare i canali.</p>
          <Textarea
            id="zeus-wizard-try-input"
            placeholder="Es: Ciao, cerco un trilocale in zona centro"
            rows={4}
            disabled={readOnly || tryPending}
            className="text-sm"
          />
          <Button type="button" onClick={sendTry} disabled={readOnly || tryPending}>
            <MessageCircle className="h-4 w-4 mr-2" />
            {tryPending ? "Invio…" : "Invia messaggio"}
          </Button>
          {tryReply ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm whitespace-pre-wrap">{tryReply}</div>
          ) : null}
          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Indietro
            </Button>
            <Button type="button" onClick={goNext}>
              Continua
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-5">
          <h3 className="text-lg font-semibold">Come ti scrivono i clienti?</h3>
          <p className="text-sm text-muted-foreground">
            Attiva i canali che ti servono. Qui sotto puoi aprire il collegamento alla posta e a WhatsApp senza lasciare questa pagina (usa una seconda finestra o scheda).
          </p>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">Collega la posta (Outlook / Microsoft 365)</p>
            <p className="text-xs text-muted-foreground">
              Si apre una finestra di login Microsoft. Quando hai finito, chiudi la finestra e continua qui.
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={connectOutlookPopup} disabled={readOnly || outlookBusy}>
              {outlookBusy ? "Apertura…" : "Collega Outlook (nuova finestra)"}
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">WhatsApp Business (Meta)</p>
            <p className="text-xs text-muted-foreground">
              Si apre la scheda Integrazioni in una nuova scheda: questa resta aperta così non ti perdi.
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={openConnectorsInNewTab}>
              Apri collegamento WhatsApp
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          </div>

          <p className="text-xs font-medium text-foreground pt-1">Canali ZEUS</p>
          <div className="space-y-3 rounded-lg border border-border bg-card p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={chat} onCheckedChange={(c) => setChat(c === true)} disabled={readOnly} className="mt-1" />
              <div>
                <span className="font-medium text-sm">Chat e prova dall&apos;app</span>
                <p className="text-xs text-muted-foreground mt-0.5">Consigliato per provare subito.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={email} onCheckedChange={(c) => setEmail(c === true)} disabled={readOnly} className="mt-1" />
              <div>
                <span className="font-medium text-sm">Email</span>
                <p className="text-xs text-muted-foreground mt-0.5">Dopo aver collegato la casella sopra.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={voice} onCheckedChange={(c) => setVoice(c === true)} disabled={readOnly} className="mt-1" />
              <div className="flex gap-2">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-sm">Chiamate telefoniche (Twilio)</span>
                  <p className="text-xs text-muted-foreground mt-0.5">Al passo successivo ti guidiamo con URL e numeri.</p>
                </div>
              </div>
            </label>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox checked={whatsapp} onCheckedChange={(c) => setWhatsapp(c === true)} disabled={readOnly} className="mt-1" />
              <div>
                <span className="font-medium text-sm">WhatsApp via Twilio</span>
                <p className="text-xs text-muted-foreground mt-0.5">Solo se usi Twilio per WhatsApp; altrimenti usa Meta sopra.</p>
              </div>
            </label>
          </div>

          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <KeyRound className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Codici di sicurezza (consigliato)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Un clic genera i codici per email e ingest. Puoi anche farlo dopo dalla scheda ZEUS.
                </p>
              </div>
            </div>
            {secretsDone ? (
              <p className="text-sm text-foreground font-medium">Codici pronti.</p>
            ) : (
              <Button type="button" variant="secondary" size="sm" onClick={generateSecrets} disabled={readOnly || saving}>
                Genera codici ora
              </Button>
            )}
          </div>

          <details className="rounded-lg border border-border text-sm">
            <summary className="cursor-pointer px-4 py-3 font-medium">Codici manuali (solo se IT)</summary>
            <div className="px-4 pb-4 space-y-3 border-t border-border/80">
              <div>
                <label className="text-xs text-muted-foreground">Segreto email</label>
                <Input value={emailSecret} onChange={(e) => setEmailSecret(e.target.value)} placeholder={config?.emailWebhookSecretMasked ?? ""} disabled={readOnly} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Segreto ingest (opzionale)</label>
                <Input value={ingestSecret} onChange={(e) => setIngestSecret(e.target.value)} placeholder={config?.ingestWebhookSecretMasked ?? ""} disabled={readOnly} />
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={save} disabled={readOnly || saving}>
                Salva codici
              </Button>
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={goBack}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Indietro
            </Button>
            <Button type="button" onClick={saveChannels} disabled={readOnly || saving}>
              {saving ? "Salvataggio…" : "Salva e continua"}
            </Button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6">
          <div className="text-center pt-2 space-y-3">
            <div className="flex justify-center">
              <div className="rounded-full bg-green-500/15 p-3">
                <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <h3 className="text-xl font-semibold">Configurazione salvata</h3>
            <p className="text-sm text-muted-foreground">
              Da qui puoi usare il registro ZEUS. Se hai attivato email o WhatsApp, completa il collegamento nelle finestre che hai aperto prima.
            </p>
          </div>

          {(voice || whatsapp) && (
            <div className="rounded-lg border border-primary/25 bg-card p-4 space-y-4 text-left">
              <div className="flex items-center gap-2">
                <Phone className="h-5 w-5 text-primary shrink-0" />
                <h4 className="text-base font-semibold text-foreground">Chiamate e messaggi Twilio</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                Segui l&apos;ordine: prima incolli gli URL in Twilio, poi salvi qui account e token. La voce al telefono usa la risposta sintetica di sistema; una voce premium (es. ElevenLabs) è opzionale e va configurata lato ambiente se il team l&apos;ha abilitata.
              </p>

              {voice && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">1 — Voce in entrata</p>
                  <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                    <li>Copia l&apos;URL qui sotto.</li>
                    <li>
                      In Twilio Console → Phone Numbers → il tuo numero → <strong className="text-foreground">Voice &amp; Fax</strong> →
                      &quot;A CALL COMES IN&quot; → Webhook HTTP POST → incolla l&apos;URL.
                    </li>
                    <li>Salva in Twilio, poi compila SID e token qui sotto e premi Salva.</li>
                    <li>Chiama il numero per verificare che risponda ZEUS.</li>
                  </ol>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <code className="flex-1 min-w-0 break-all text-[11px] bg-muted px-2 py-2 rounded border">{urls.twilioVoice}</code>
                    <Button type="button" variant="outline" size="sm" onClick={() => copy(urls.twilioVoice)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              {whatsapp && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-foreground uppercase tracking-wide">{voice ? "2" : "1"} — WhatsApp (Twilio)</p>
                  <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                    <li>Copia l&apos;URL WhatsApp qui sotto nel webhook del sender Twilio.</li>
                    <li>Imposta il numero &quot;From&quot; (formato whatsapp:+…).</li>
                  </ol>
                  <div className="flex flex-wrap items-center gap-2">
                    <code className="flex-1 min-w-0 break-all text-[11px] bg-muted px-2 py-2 rounded border">{urls.twilioWhatsapp}</code>
                    <Button type="button" variant="outline" size="sm" onClick={() => copy(urls.twilioWhatsapp)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-border">
                <div>
                  <label className="text-xs text-muted-foreground">Account SID</label>
                  <Input value={sid} onChange={(e) => setSid(e.target.value)} placeholder={config?.twilioAccountSidMasked ?? ""} disabled={readOnly} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Auth token</label>
                  <Input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    type="password"
                    autoComplete="off"
                    placeholder={config?.twilioAuthTokenMasked ?? "••••"}
                    disabled={readOnly}
                  />
                </div>
                {whatsapp && (
                  <div className="sm:col-span-2">
                    <label className="text-xs text-muted-foreground">WhatsApp &quot;From&quot;</label>
                    <Input value={waFrom} onChange={(e) => setWaFrom(e.target.value)} disabled={readOnly} placeholder="whatsapp:+…" />
                  </div>
                )}
              </div>
              <Button type="button" variant="secondary" onClick={save} disabled={readOnly || saving}>
                {saving ? "Salvataggio…" : "Salva credenziali Twilio"}
              </Button>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button type="button" variant="outline" onClick={() => setStep(1)}>
              Rivedi dal passo 1
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
