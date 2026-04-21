import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Copy, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { Alert } from "../../components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";
import { followupApi } from "../../api/followupApi";
import { useToast } from "../../contexts/ToastContext";
import { resolveApiBaseUrl } from "../../api/http";
import { ZeusProactiveTab } from "./ZeusProactiveTab";
import { ZeusRegistryTab } from "./ZeusRegistryTab";
import { ZeusSetupWizard } from "./ZeusSetupWizard";

type ZeusTurn = {
  id: string;
  channel: "voice" | "email" | "whatsapp" | "chat";
  direction: "in" | "out";
  text: string;
  externalId: string | null;
  createdAt: string;
  charCount: number;
  wordCount: number;
};

export function ZeusTab({ workspaceId, readOnly = false }: { workspaceId: string; readOnly?: boolean }) {
  const { toastSuccess, toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<Awaited<ReturnType<typeof followupApi.getZeusPocConfig>>["data"] | null>(null);
  const [turns, setTurns] = useState<ZeusTurn[]>([]);
  const [sid, setSid] = useState("");
  const [token, setToken] = useState("");
  const [waFrom, setWaFrom] = useState("");
  const [emailSecret, setEmailSecret] = useState("");
  const [voice, setVoice] = useState(true);
  const [whatsapp, setWhatsapp] = useState(true);
  const [email, setEmail] = useState(true);
  const [chat, setChat] = useState(true);
  const [ingestSecret, setIngestSecret] = useState("");
  const [inboxProvider, setInboxProvider] = useState<"outlook" | "imap">("outlook");
  const [inboxEnabled, setInboxEnabled] = useState(false);
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapSecure, setImapSecure] = useState(true);
  const [imapUser, setImapUser] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapFolder, setImapFolder] = useState("INBOX");
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxSaving, setInboxSaving] = useState(false);
  const [inboxSyncing, setInboxSyncing] = useState(false);

  const loadAll = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    Promise.all([
      followupApi.getZeusPocConfig(workspaceId),
      followupApi.listZeusTurns(workspaceId, { limit: 30 }),
      followupApi.getZeusEmailInboxConfig(workspaceId)
    ])
      .then(([cfg, t, inbox]) => {
        setConfig(cfg.data);
        setTurns(t.data ?? []);
        setVoice(cfg.data.enabledChannels.voice);
        setWhatsapp(cfg.data.enabledChannels.whatsapp);
        setEmail(cfg.data.enabledChannels.email);
        setChat(cfg.data.enabledChannels.chat);
        setWaFrom(cfg.data.twilioWhatsAppFrom ?? "");
        setInboxProvider(inbox.data.provider);
        setInboxEnabled(inbox.data.enabled);
        setImapHost(inbox.data.imapHost ?? "");
        setImapPort(String(inbox.data.imapPort ?? 993));
        setImapSecure(inbox.data.imapSecure !== false);
        setImapUser(inbox.data.imapUser ?? "");
        setImapFolder(inbox.data.imapFolder ?? "INBOX");
      })
      .catch(() => toastError("Impossibile caricare ZEUS"))
      .finally(() => {
        setLoading(false);
        setInboxLoading(false);
      });
  }, [workspaceId, toastError]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => toastSuccess("Copiato"));
  };

  const save = (): Promise<void> => {
    if (readOnly) return Promise.resolve();
    setSaving(true);
    return followupApi
      .patchZeusPocConfig(workspaceId, {
        twilioAccountSid: sid.trim() || undefined,
        twilioAuthToken: token.trim() || undefined,
        twilioWhatsAppFrom: waFrom.trim() || undefined,
        emailWebhookSecret: emailSecret.trim() || undefined,
        ingestWebhookSecret: ingestSecret.trim() || undefined,
        enabledChannels: { voice, whatsapp, email, chat }
      })
      .then((r) => {
        setConfig((prev) =>
          prev
            ? {
                ...prev,
                ...r.data,
                webhookUrls: prev.webhookUrls
              }
            : null
        );
        setToken("");
        toastSuccess("Configurazione ZEUS salvata");
        return followupApi.getZeusPocConfig(workspaceId);
      })
      .then((cfg) => setConfig(cfg.data))
      .catch(() => {
        toastError("Salvataggio fallito");
        throw new Error("save failed");
      })
      .finally(() => setSaving(false));
  };

  const initSecret = (): Promise<void> => {
    if (readOnly) return Promise.resolve();
    setSaving(true);
    return followupApi
      .patchZeusPocConfig(workspaceId, {})
      .then((r) => {
        setConfig((prev) => (prev ? { ...prev, ...r.data, webhookUrls: prev.webhookUrls } : null));
        toastSuccess("Codici di sicurezza pronti");
        return followupApi.getZeusPocConfig(workspaceId);
      })
      .then((cfg) => setConfig(cfg.data))
      .catch(() => {
        toastError("Operazione fallita");
        throw new Error("init secret failed");
      })
      .finally(() => setSaving(false));
  };

  const saveInboxConfig = (): Promise<void> => {
    if (readOnly) return Promise.resolve();
    setInboxSaving(true);
    const payload =
      inboxProvider === "imap"
        ? {
            provider: "imap" as const,
            enabled: inboxEnabled,
            imapHost: imapHost.trim(),
            imapPort: Number.parseInt(imapPort, 10) || 993,
            imapSecure,
            imapUser: imapUser.trim(),
            imapPassword: imapPassword.trim() || undefined,
            imapFolder: imapFolder.trim() || "INBOX"
          }
        : {
            provider: "outlook" as const,
            enabled: inboxEnabled
          };
    return followupApi
      .patchZeusEmailInboxConfig(workspaceId, payload)
      .then((r) => {
        setInboxProvider(r.data.provider);
        setInboxEnabled(r.data.enabled);
        setImapHost(r.data.imapHost ?? "");
        setImapPort(String(r.data.imapPort ?? 993));
        setImapSecure(r.data.imapSecure !== false);
        setImapUser(r.data.imapUser ?? "");
        setImapFolder(r.data.imapFolder ?? "INBOX");
        setImapPassword("");
        toastSuccess("Configurazione casella email salvata");
      })
      .catch(() => {
        toastError("Salvataggio casella email fallito");
        throw new Error("save inbox config failed");
      })
      .finally(() => setInboxSaving(false));
  };

  const syncInboxNow = (): Promise<void> => {
    if (readOnly) return Promise.resolve();
    setInboxSyncing(true);
    return followupApi
      .syncZeusEmailInbox(workspaceId, { limit: 10 })
      .then((r) => {
        toastSuccess(
          `Sync email completata: letti ${r.data.scanned}, importati ${r.data.imported}, risposte ${r.data.replied}`
        );
        return loadAll();
      })
      .catch(() => {
        toastError("Sync email fallita");
        throw new Error("sync inbox failed");
      })
      .finally(() => setInboxSyncing(false));
  };

  const apiRoot = resolveApiBaseUrl().startsWith("http")
    ? resolveApiBaseUrl().replace(/\/$/, "")
    : `${typeof window !== "undefined" ? window.location.origin : ""}${resolveApiBaseUrl().replace(/\/$/, "")}`;

  const fallbackUrls = {
    nativeIngest: `${apiRoot}/workspaces/${encodeURIComponent(workspaceId)}/zeus/webhooks/ingest`,
    twilioVoice: `${apiRoot}/workspaces/${encodeURIComponent(workspaceId)}/zeus/webhooks/twilio/voice`,
    twilioWhatsapp: `${apiRoot}/workspaces/${encodeURIComponent(workspaceId)}/zeus/webhooks/twilio/whatsapp`,
    email: `${apiRoot}/workspaces/${encodeURIComponent(workspaceId)}/zeus/webhooks/email`,
    sipVoice: `${apiRoot}/workspaces/${encodeURIComponent(workspaceId)}/zeus/webhooks/sip/voice`
  };

  const urls = { ...fallbackUrls, ...(config?.webhookUrls ?? {}) };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold text-foreground">ZEUS</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">Email:</strong> lettura dalla <strong className="font-medium text-foreground">casella del cliente</strong>{" "}
          (Microsoft 365 / Outlook, Google, IMAP per provider come Aruba) — non serve un servizio email terzo tipo SendGrid.{" "}
          <strong className="font-medium text-foreground">Altri canali:</strong> chat in app, webhook HTTP, WhatsApp Meta in Integrazioni; Twilio
          solo come alternativa in fondo.
        </p>
      </div>

      <Tabs defaultValue="inbound" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="inbound">Risposte (inbound)</TabsTrigger>
          <TabsTrigger value="registry">Registro &amp; statistiche</TabsTrigger>
          <TabsTrigger value="proactive">Proactive Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="inbound" className="space-y-6 mt-6">
          <ZeusSetupWizard
            workspaceId={workspaceId}
            readOnly={readOnly}
            loading={loading}
            saving={saving}
            config={config}
            voice={voice}
            setVoice={setVoice}
            whatsapp={whatsapp}
            setWhatsapp={setWhatsapp}
            email={email}
            setEmail={setEmail}
            chat={chat}
            setChat={setChat}
            sid={sid}
            setSid={setSid}
            token={token}
            setToken={setToken}
            waFrom={waFrom}
            setWaFrom={setWaFrom}
            emailSecret={emailSecret}
            setEmailSecret={setEmailSecret}
            ingestSecret={ingestSecret}
            setIngestSecret={setIngestSecret}
            save={save}
            initSecret={initSecret}
            loadAll={loadAll}
            copy={copy}
            urls={urls}
          />

          <details className="rounded-lg border border-border bg-card/40 group">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
              <span>Configurazione avanzata</span>
              <span className="text-xs font-normal text-muted-foreground">Casella email, webhook tecnico, Meta, Twilio, turni</span>
            </summary>
            <div className="border-t border-border px-4 pb-4 pt-2">
              <InboundZeusBody
                workspaceId={workspaceId}
                readOnly={readOnly}
                loading={loading}
                config={config}
                turns={turns}
                sid={sid}
                setSid={setSid}
                token={token}
                setToken={setToken}
                waFrom={waFrom}
                setWaFrom={setWaFrom}
                emailSecret={emailSecret}
                setEmailSecret={setEmailSecret}
                ingestSecret={ingestSecret}
                setIngestSecret={setIngestSecret}
                voice={voice}
                setVoice={setVoice}
                whatsapp={whatsapp}
                setWhatsapp={setWhatsapp}
                email={email}
                setEmail={setEmail}
                chat={chat}
                setChat={setChat}
                save={save}
                initSecret={initSecret}
                saving={saving}
                inboxLoading={inboxLoading}
                inboxProvider={inboxProvider}
                setInboxProvider={setInboxProvider}
                inboxEnabled={inboxEnabled}
                setInboxEnabled={setInboxEnabled}
                imapHost={imapHost}
                setImapHost={setImapHost}
                imapPort={imapPort}
                setImapPort={setImapPort}
                imapSecure={imapSecure}
                setImapSecure={setImapSecure}
                imapUser={imapUser}
                setImapUser={setImapUser}
                imapPassword={imapPassword}
                setImapPassword={setImapPassword}
                imapFolder={imapFolder}
                setImapFolder={setImapFolder}
                inboxSaving={inboxSaving}
                inboxSyncing={inboxSyncing}
                saveInboxConfig={saveInboxConfig}
                syncInboxNow={syncInboxNow}
                loadAll={loadAll}
                copy={copy}
                urls={urls}
                hideChatTry
              />
            </div>
          </details>
        </TabsContent>

        <TabsContent value="registry" className="mt-6">
          <ZeusRegistryTab workspaceId={workspaceId} readOnly={readOnly} />
        </TabsContent>

        <TabsContent value="proactive" className="mt-6">
          <ZeusProactiveTab workspaceId={workspaceId} readOnly={readOnly} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function channelLabel(ch: ZeusTurn["channel"]): string {
  switch (ch) {
    case "chat":
      return "Chat / ingest HTTP";
    case "voice":
      return "Voce (numero / operatore)";
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return "Email";
    default:
      return ch;
  }
}

type InboundZeusBodyProps = {
  workspaceId: string;
  readOnly: boolean;
  loading: boolean;
  config: Awaited<ReturnType<typeof followupApi.getZeusPocConfig>>["data"] | null;
  turns: ZeusTurn[];
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
  voice: boolean;
  setVoice: (v: boolean) => void;
  whatsapp: boolean;
  setWhatsapp: (v: boolean) => void;
  email: boolean;
  setEmail: (v: boolean) => void;
  chat: boolean;
  setChat: (v: boolean) => void;
  save: () => Promise<void>;
  initSecret: () => Promise<void>;
  saving: boolean;
  inboxLoading: boolean;
  inboxProvider: "outlook" | "imap";
  setInboxProvider: (v: "outlook" | "imap") => void;
  inboxEnabled: boolean;
  setInboxEnabled: (v: boolean) => void;
  imapHost: string;
  setImapHost: (v: string) => void;
  imapPort: string;
  setImapPort: (v: string) => void;
  imapSecure: boolean;
  setImapSecure: (v: boolean) => void;
  imapUser: string;
  setImapUser: (v: string) => void;
  imapPassword: string;
  setImapPassword: (v: string) => void;
  imapFolder: string;
  setImapFolder: (v: string) => void;
  inboxSaving: boolean;
  inboxSyncing: boolean;
  saveInboxConfig: () => Promise<void>;
  syncInboxNow: () => Promise<void>;
  loadAll: () => void;
  copy: (text: string) => void;
  urls: { nativeIngest: string; twilioVoice: string; twilioWhatsapp: string; email: string; sipVoice?: string };
  /** Se true, nasconde la prova chat (già nel wizard). */
  hideChatTry?: boolean;
};

function ZeusChatTry({
  workspaceId,
  readOnly,
  onSent
}: {
  workspaceId: string;
  readOnly: boolean;
  onSent: () => void;
}) {
  const { toastSuccess, toastError } = useToast();
  const [text, setText] = useState("");
  const [reply, setReply] = useState("");
  const [pending, setPending] = useState(false);

  const send = () => {
    if (readOnly || !text.trim()) return;
    setPending(true);
    followupApi
      .postZeusChat(workspaceId, { text: text.trim() })
      .then((r) => {
        setReply(r.data.reply);
        setText("");
        toastSuccess("Risposta ricevuta");
        onSent();
      })
      .catch(() => toastError("Invio fallito (canale chat disabilitato o AI non configurata)"))
      .finally(() => setPending(false));
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Scrivi un messaggio di prova…"
        rows={3}
        disabled={readOnly || pending}
        className="text-sm"
      />
      <Button type="button" size="sm" onClick={send} disabled={readOnly || pending || !text.trim()}>
        <MessageCircle className="h-4 w-4 mr-1" />
        {pending ? "Invio…" : "Invia (API nativa)"}
      </Button>
      {reply ? (
        <p className="text-sm rounded-md border border-border bg-muted/40 p-3 whitespace-pre-wrap text-foreground">{reply}</p>
      ) : null}
    </div>
  );
}

function InboundZeusBody({
  workspaceId,
  readOnly,
  loading,
  config,
  turns,
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
  voice,
  setVoice,
  whatsapp,
  setWhatsapp,
  email,
  setEmail,
  chat,
  setChat,
  save,
  initSecret,
  saving,
  inboxLoading,
  inboxProvider,
  setInboxProvider,
  inboxEnabled,
  setInboxEnabled,
  imapHost,
  setImapHost,
  imapPort,
  setImapPort,
  imapSecure,
  setImapSecure,
  imapUser,
  setImapUser,
  imapPassword,
  setImapPassword,
  imapFolder,
  setImapFolder,
  inboxSaving,
  inboxSyncing,
  saveInboxConfig,
  syncInboxNow,
  loadAll,
  copy,
  urls,
  hideChatTry = false
}: InboundZeusBodyProps) {
  return (
    <>
      <Alert variant="info" title="URL pubblico del backend">
        <span className="text-sm">
          Gli URL mostrati usano <code className="rounded bg-muted px-1">VITE_API_BASE_URL</code> se assoluto, altrimenti
          l&apos;origine corrente. In produzione imposta <code className="rounded bg-muted px-1">API_BACKEND_PUBLIC_URL</code>{" "}
          sul backend per gli URL completi nella risposta API.
        </span>
      </Alert>

      <Alert variant="info" title="Voce al telefono: go-live rapido (Track A)">
        <span className="text-sm">
          Per i numeri PSTN si usa un operatore certificato sotto il cofano (oggi Twilio): configuri webhook e credenziali; il valore per il
          cliente è <strong className="text-foreground">assistente + CRM + registro turni</strong>. Una rete SIP dedicata (più margine e
          controllo) è un&apos;evoluzione successiva — prompt, dati e inbox restano gli stessi. Dettaglio in documentazione interna{" "}
          <code className="rounded bg-muted px-1 text-xs">docs/ZEUS_VOICE_TRACK_AB.md</code>.
        </span>
      </Alert>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : (
        <>
          <section className="rounded-lg border border-primary/25 bg-card p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium">Email in arrivo — percorso consigliato</h3>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                ZEUS deve leggere dalla <strong className="text-foreground">casella che il cliente usa già</strong>: in prima battuta{" "}
                <strong className="text-foreground">Microsoft 365 / Outlook</strong> (Microsoft Graph) e{" "}
                <strong className="text-foreground">Google / Gmail</strong> (Gmail API); per provider generici (es. Aruba, server dedicati){" "}
                <strong className="text-foreground">IMAP</strong> con le credenziali del dominio. Non è richiesto un servizio terzo tipo
                SendGrid/Mailgun solo per fare da ponte.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" asChild>
                  <Link to="/integrations?tab=connettori">Integrazioni — Connettori (Outlook e altri)</Link>
                </Button>
              </div>
            </div>
            <Alert variant="info" title="Altri canali nativi">
              <span className="text-sm">
                <strong className="font-medium text-foreground">WhatsApp ufficiale:</strong> connettore Meta in Integrazioni.{" "}
                <strong className="font-medium text-foreground">Chat e HTTP ingest</strong> restano sul backend Followup (vedi sotto).
              </span>
            </Alert>
            {!hideChatTry ? (
              <div className="rounded-md border border-dashed border-border p-3 space-y-2">
                <p className="text-xs font-medium text-foreground">Prova in app (JWT)</p>
                <ZeusChatTry workspaceId={workspaceId} readOnly={readOnly} onSent={loadAll} />
              </div>
            ) : null}
            <div className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground w-40 shrink-0">HTTP ingest POST</span>
                <code className="flex-1 min-w-0 break-all text-xs bg-muted px-2 py-1 rounded">{urls.nativeIngest}</code>
                <Button type="button" variant="outline" size="sm" onClick={() => copy(urls.nativeIngest)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Body JSON: <code className="rounded bg-muted px-1">{`{"text":"...","senderLabel":"CRM"}`}</code>. Autenticazione:{" "}
                <code className="rounded bg-muted px-1">?secret=…</code> o header{" "}
                <code className="rounded bg-muted px-1">x-zeus-ingest-secret</code> (valore = segreto ingest dedicato sotto, altrimenti
                uguale al segreto webhook email sotto).
              </p>
            </div>
            <details className="rounded-md border border-dashed border-border bg-muted/20">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
                Tecnico — webhook HTTP email (test o integrazioni custom)
              </summary>
              <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground pt-2">
                  Endpoint che accetta POST con payload normalizzato. Non è il percorso utente standard rispetto alla lettura da casella IMAP/API.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground w-40 shrink-0">Email POST</span>
                  <code className="flex-1 min-w-0 break-all text-xs bg-muted px-2 py-1 rounded">{urls.email}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => copy(urls.email)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </details>
          </section>

          <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium">Casella email ZEUS (senza provider ponte)</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Percorso raccomandato: leggi direttamente dalla casella del cliente. Outlook/Microsoft 365 usa OAuth Graph; per provider
                come Aruba usa IMAP.
              </p>
            </div>
            {inboxLoading ? (
              <p className="text-sm text-muted-foreground">Caricamento configurazione casella…</p>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Provider casella</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={inboxProvider}
                      onChange={(e) => setInboxProvider(e.target.value as "outlook" | "imap")}
                      disabled={readOnly}
                    >
                      <option value="outlook">Outlook / Microsoft 365 (Graph)</option>
                      <option value="imap">IMAP generico (Aruba, server custom)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={inboxEnabled} onCheckedChange={(c) => setInboxEnabled(c === true)} disabled={readOnly} />
                      Casella attiva per ingestione ZEUS
                    </label>
                  </div>
                </div>

                {inboxProvider === "imap" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Host IMAP</label>
                      <Input value={imapHost} onChange={(e) => setImapHost(e.target.value)} placeholder="imap.aruba.it" disabled={readOnly} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Porta</label>
                      <Input value={imapPort} onChange={(e) => setImapPort(e.target.value)} placeholder="993" disabled={readOnly} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Utente</label>
                      <Input value={imapUser} onChange={(e) => setImapUser(e.target.value)} placeholder="info@dominio.it" disabled={readOnly} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Password / app password</label>
                      <Input
                        value={imapPassword}
                        onChange={(e) => setImapPassword(e.target.value)}
                        type="password"
                        placeholder="lascia vuoto per mantenere quella salvata"
                        autoComplete="off"
                        disabled={readOnly}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Cartella</label>
                      <Input value={imapFolder} onChange={(e) => setImapFolder(e.target.value)} placeholder="INBOX" disabled={readOnly} />
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={imapSecure} onCheckedChange={(c) => setImapSecure(c === true)} disabled={readOnly} />
                        TLS/SSL attivo
                      </label>
                    </div>
                  </div>
                ) : (
                  <Alert variant="info" title="Outlook / Microsoft 365">
                    <span className="text-sm">
                      Connetti prima Outlook in Integrazioni → Connettori. ZEUS userà il token OAuth dell&apos;utente autenticato per leggere
                      la Inbox.
                    </span>
                  </Alert>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button type="button" onClick={() => void saveInboxConfig()} disabled={readOnly || inboxSaving}>
                    {inboxSaving ? "Salvataggio…" : "Salva casella email"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => void syncInboxNow()} disabled={readOnly || inboxSyncing}>
                    {inboxSyncing ? "Sync in corso…" : "Sincronizza email ora"}
                  </Button>
                </div>
              </>
            )}
          </section>

          <section className="rounded-lg border border-border bg-card p-4 space-y-4">
            <h3 className="text-sm font-medium">Segreti e canali abilitati (ZEUS)</h3>
            <p className="text-xs text-muted-foreground">
              Abilita i canali che ZEUS accetta oggi nel backend. <strong className="text-foreground">Email</strong> in produzione va letta da
              casella (roadmap); il segreto qui serve soprattutto al <strong className="text-foreground">webhook HTTP email</strong> tecnico.
              Voce/WhatsApp <strong className="text-foreground">Twilio</strong> restano opzionali.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Segreto webhook email (POST tecnico)</label>
                <Input
                  value={emailSecret}
                  onChange={(e) => setEmailSecret(e.target.value)}
                  placeholder={config?.emailWebhookSecretMasked ?? "genera con il pulsante sotto"}
                  disabled={readOnly}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">Segreto ingest HTTP (opzionale, se vuoto si usa quello email)</label>
                <Input
                  value={ingestSecret}
                  onChange={(e) => setIngestSecret(e.target.value)}
                  placeholder={config?.ingestWebhookSecretMasked ?? "—"}
                  disabled={readOnly}
                />
              </div>
            </div>
            <p className="text-xs font-medium text-foreground">Canali nativi</p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={chat} onCheckedChange={(c) => setChat(c === true)} disabled={readOnly} />
                Chat / ingest HTTP
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={email} onCheckedChange={(c) => setEmail(c === true)} disabled={readOnly} />
                Email
              </label>
            </div>
            <p className="text-xs font-medium text-foreground pt-1">Webhook operatore (secondario — es. Twilio)</p>
            <p className="text-xs text-muted-foreground">
              Solo se vuoi far entrare chiamate o messaggi WhatsApp nel flusso ZEUS tramite URL Twilio sotto; non è il percorso consigliato se
              usi già Meta in Connettori.
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={voice} onCheckedChange={(c) => setVoice(c === true)} disabled={readOnly} />
                Voce (webhook Twilio)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={whatsapp} onCheckedChange={(c) => setWhatsapp(c === true)} disabled={readOnly} />
                WhatsApp (webhook Twilio)
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={save} disabled={readOnly || saving}>
                Salva
              </Button>
              <Button type="button" variant="secondary" onClick={initSecret} disabled={readOnly || saving}>
                Inizializza segreto email
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={loadAll}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Aggiorna turni
              </Button>
            </div>
          </section>

          <details className="rounded-lg border border-dashed border-border bg-muted/15">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
              Alternativa secondaria: connettore Twilio (PSTN / WhatsApp via Twilio)
            </summary>
            <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border/80">
              <Alert variant="info" title="Voce: livello qualità">
                <span className="text-sm">
                  <strong className="text-foreground">Voce standard:</strong> il telefono usa il TTS integrato dell&apos;operatore (es. voci Twilio{" "}
                  <code className="rounded bg-muted px-1">&lt;Say&gt;</code>) — intelligibile, stile assistente.{" "}
                  <strong className="text-foreground">Voce premium</strong> (ElevenLabs o simili) è un possibile miglioramento futuro, non
                  necessario per far funzionare ZEUS al telefono.
                </span>
              </Alert>
              <p className="text-xs text-muted-foreground pt-1">
                Usa questo blocco solo se ti serve esplicitamente Twilio. Il percorso Tecma resta casella email, chat, HTTP e Meta in Connettori.
                Incolla gli URL nei webhook Twilio; firma verificata con Account SID + Auth Token.
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground w-36 shrink-0">Voice POST</span>
                  <code className="flex-1 min-w-0 break-all text-xs bg-muted px-2 py-1 rounded">{urls.twilioVoice}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => copy(urls.twilioVoice)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground w-36 shrink-0">WhatsApp POST</span>
                  <code className="flex-1 min-w-0 break-all text-xs bg-muted px-2 py-1 rounded">{urls.twilioWhatsapp}</code>
                  <Button type="button" variant="outline" size="sm" onClick={() => copy(urls.twilioWhatsapp)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                <div>
                  <label className="text-xs text-muted-foreground">Account SID</label>
                  <Input value={sid} onChange={(e) => setSid(e.target.value)} placeholder={config?.twilioAccountSidMasked ?? ""} disabled={readOnly} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Auth Token (nuovo)</label>
                  <Input
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={config?.twilioAuthTokenMasked ?? "••••"}
                    type="password"
                    autoComplete="off"
                    disabled={readOnly}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs text-muted-foreground">WhatsApp &quot;From&quot; (es. whatsapp:+14155238886)</label>
                  <Input value={waFrom} onChange={(e) => setWaFrom(e.target.value)} disabled={readOnly} />
                </div>
              </div>
            </div>
          </details>

          <section>
            <h3 className="text-sm font-medium mb-2">Ultimi turni</h3>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50 text-left">
                    <th className="p-2 font-medium">Quando</th>
                    <th className="p-2 font-medium">Canale</th>
                    <th className="p-2 font-medium">Dir</th>
                    <th className="p-2 font-medium">Anteprima</th>
                  </tr>
                </thead>
                <tbody>
                  {turns.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-muted-foreground text-center">
                        Nessun messaggio ancora.
                      </td>
                    </tr>
                  ) : (
                    turns.map((row, i) => (
                      <tr key={`${row.createdAt}-${i}`} className="border-b border-border/80">
                        <td className="p-2 whitespace-nowrap text-xs">{row.createdAt}</td>
                        <td className="p-2">{channelLabel(row.channel)}</td>
                        <td className="p-2">{row.direction}</td>
                        <td className="p-2 max-w-xl truncate text-xs text-muted-foreground">{row.text}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
