import { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { followupApi } from "../../api/followupApi";
import { useToast } from "../../contexts/ToastContext";
import type { AutomationEventType } from "../../types/domain";
import { EVENT_LABELS } from "./integrationsCatalog";

const COMM_EVENT_TYPES = Object.keys(EVENT_LABELS) as AutomationEventType[];

const PATH_TWILIO_CONNECTOR = "/integrations?tab=connettori&connector=twilio";
const PATH_META_WHATSAPP_CONNECTOR = "/integrations?tab=connettori&connector=meta_whatsapp";
const PATH_CONNETTORI = "/integrations?tab=connettori";

function placeholderKeysInOrder(body: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    const key = m[1].trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

function ruleEventLabel(trigger: unknown): string {
  if (typeof trigger === "object" && trigger !== null && "eventType" in trigger) {
    const et = String((trigger as { eventType: string }).eventType);
    if (COMM_EVENT_TYPES.includes(et as AutomationEventType)) {
      return EVENT_LABELS[et as AutomationEventType];
    }
    return et;
  }
  return "—";
}

export function ComunicazioniTab({
  workspaceId,
  isAdmin = false,
  readOnly = false,
}: {
  workspaceId: string;
  isAdmin?: boolean;
  readOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { toastError, toastSuccess } = useToast();
  const [templates, setTemplates] = useState<
    Array<{
      _id: string;
      name: string;
      channel: string;
      subject?: string;
      bodyText: string;
      metaTemplateName?: string;
      metaTemplateLanguage?: string;
    }>
  >([]);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [deliveries, setDeliveries] = useState<Array<{ _id: string; channel: string; templateId: string; recipientMasked: string; status: string; sentAt: string }>>([]);
  const [whatsappConfig, setWhatsappConfig] = useState<{ config: { accountSid: string; fromNumber: string } } | null>(null);
  const [metaWhatsappConfig, setMetaWhatsappConfig] = useState<{ config: { phoneNumberId: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [tmplName, setTmplName] = useState("");
  const [tmplBody, setTmplBody] = useState("");
  const [tmplMetaName, setTmplMetaName] = useState("");
  const [tmplMetaLang, setTmplMetaLang] = useState("it");
  const [tmplSaving, setTmplSaving] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleEventType, setRuleEventType] = useState<AutomationEventType>("client.created");
  const [ruleTemplateId, setRuleTemplateId] = useState("");
  const [ruleSaving, setRuleSaving] = useState(false);

  const goTwilioConnector = useCallback(() => {
    navigate(PATH_TWILIO_CONNECTOR);
  }, [navigate]);

  const goMetaWhatsappConnector = useCallback(() => {
    navigate(PATH_META_WHATSAPP_CONNECTOR);
  }, [navigate]);

  const goConnettoriTab = useCallback(() => {
    navigate(PATH_CONNETTORI);
  }, [navigate]);

  const load = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    Promise.all([
      followupApi.listCommunicationTemplates(workspaceId).then((r) => setTemplates(r.data ?? [])).catch(() => setTemplates([])),
      followupApi.listCommunicationRules(workspaceId).then((r) => setRules(r.data ?? [])).catch(() => setRules([])),
      followupApi.listCommunicationDeliveries(workspaceId, 30).then((r) => setDeliveries(r.data ?? [])).catch(() => setDeliveries([])),
      followupApi.getWhatsAppConfig(workspaceId).then((r) => {
        setWhatsappConfig(r.config ? { config: r.config.config } : null);
      }).catch(() => setWhatsappConfig(null)),
      followupApi.getMetaWhatsAppConfig(workspaceId).then((r) => {
        setMetaWhatsappConfig(r.config ? { config: r.config.config } : null);
      }).catch(() => setMetaWhatsappConfig(null)),
    ]).finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const createWhatsappTemplate = () => {
    if (!workspaceId || !tmplName.trim() || !tmplBody.trim()) {
      toastError("Nome e testo del messaggio sono obbligatori.");
      return;
    }
    setTmplSaving(true);
    const variables = placeholderKeysInOrder(tmplBody);
    followupApi
      .createCommunicationTemplate(workspaceId, {
        channel: "whatsapp",
        name: tmplName.trim(),
        bodyText: tmplBody.trim(),
        variables: variables.length ? variables : undefined,
        metaTemplateName: tmplMetaName.trim() || undefined,
        metaTemplateLanguage: tmplMetaLang.trim() || undefined,
      })
      .then(() => {
        setTmplName("");
        setTmplBody("");
        setTmplMetaName("");
        setTmplMetaLang("it");
        load();
        toastSuccess("Messaggio salvato.");
      })
      .catch((e) => toastError(e?.message ?? "Errore creazione messaggio"))
      .finally(() => setTmplSaving(false));
  };

  const createWhatsappRule = () => {
    if (!workspaceId || !ruleName.trim() || !ruleTemplateId) {
      toastError("Nome e messaggio collegato sono obbligatori.");
      return;
    }
    setRuleSaving(true);
    followupApi
      .createCommunicationRule(workspaceId, {
        name: ruleName.trim(),
        enabled: true,
        trigger: { eventType: ruleEventType },
        actions: [{ type: "send_whatsapp", templateId: ruleTemplateId, recipientType: "client" }],
        schedules: [],
      })
      .then(() => {
        setRuleName("");
        setRuleTemplateId("");
        load();
        toastSuccess("Regola creata.");
      })
      .catch((e) => toastError(e?.message ?? "Errore creazione regola"))
      .finally(() => setRuleSaving(false));
  };

  const whatsappTemplates = templates.filter((t) => t.channel === "whatsapp");
  const twilioLinked = Boolean(whatsappConfig);
  const metaLinked = Boolean(metaWhatsappConfig);
  const whatsappLinked = twilioLinked || metaLinked;
  const activeSendProvider: "meta" | "twilio" | null = metaLinked ? "meta" : twilioLinked ? "twilio" : null;

  return (
    <div className="space-y-8">
      {/* Stato WhatsApp: configurazione solo da Connettori */}
      <div
        className={
          loading
            ? "rounded-lg border border-border bg-muted/30 p-4"
            : whatsappLinked
              ? "rounded-lg border border-green-200 bg-green-50/60 p-4 dark:bg-green-950/20 dark:border-green-900"
              : "rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:bg-amber-950/25 dark:border-amber-900"
        }
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Verifica connessione WhatsApp…</p>
        ) : whatsappLinked ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1 text-sm text-foreground">
              <p>
                <span className="font-medium text-green-800 dark:text-green-200">WhatsApp collegato.</span>{" "}
                {activeSendProvider === "meta" ? (
                  <span className="text-muted-foreground">
                    Gli invii automatici usano <strong className="text-foreground">Meta Cloud API</strong>
                    {metaWhatsappConfig?.config?.phoneNumberId ? (
                      <> (Phone Number ID {metaWhatsappConfig.config.phoneNumberId.slice(0, 8)}…)</>
                    ) : null}
                    .
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Gli invii usano <strong className="text-foreground">Twilio</strong>
                    {whatsappConfig?.config?.accountSid ? (
                      <> (Account {whatsappConfig.config.accountSid.slice(0, 6)}…)</>
                    ) : null}
                    .
                  </span>
                )}
              </p>
              {twilioLinked && metaLinked ? (
                <p className="text-xs text-muted-foreground">
                  Con entrambi configurati, il backend dà priorità a <strong className="text-foreground">Meta</strong> per le consegne WhatsApp.
                </p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              {activeSendProvider === "meta" ? (
                <Button type="button" variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" onClick={goMetaWhatsappConnector}>
                  Modifica Meta
                </Button>
              ) : (
                <Button type="button" variant="outline" size="sm" className="min-h-11 w-full sm:w-auto" onClick={goTwilioConnector}>
                  Modifica Twilio
                </Button>
              )}
              {twilioLinked && metaLinked ? (
                <Button type="button" variant="ghost" size="sm" className="min-h-9 w-full text-xs sm:w-auto" onClick={goTwilioConnector}>
                  Apri Twilio
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-foreground">
              Per <strong>inviare</strong> messaggi WhatsApp ai clienti collega <strong>Twilio</strong> oppure <strong>Meta Cloud API</strong> dal tab{" "}
              <strong>Connettori</strong>. Un solo provider è sufficiente; se configuri entrambi, gli invii automatici passano da Meta. Qui puoi preparare testi e
              regole in anticipo.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button type="button" className="min-h-11 w-full sm:min-w-[200px] sm:flex-1" onClick={goTwilioConnector}>
                Apri setup Twilio
              </Button>
              <Button type="button" variant="outline" className="min-h-11 w-full sm:min-w-[200px] sm:flex-1" onClick={goMetaWhatsappConnector}>
                Apri setup Meta
              </Button>
            </div>
            <Button type="button" variant="link" className="h-auto min-h-0 justify-start p-0 text-sm text-primary" onClick={goConnettoriTab}>
              Vedi tutti i connettori
            </Button>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        In questa sezione definisci i <strong>messaggi</strong> e <strong>quando</strong> inviarli (email, WhatsApp, SMS). Le notifiche{" "}
        <em>solo in app</em> sono nella tab{" "}
        <Link to="/integrations?tab=regole" className="font-medium text-primary underline-offset-4 hover:underline">
          Automazioni
        </Link>
        .
      </p>

      <div>
        <h3 className="text-lg font-semibold text-foreground">Messaggi WhatsApp</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Testi riutilizzabili. Puoi usare variabili come {"{{client_name}}"}, {"{{apartment_name}}"}, {"{{visit_date}}"}: l&apos;ordine in cui compaiono nel
          testo definisce l&apos;ordine dei parametri inviati a Meta (template approvati).
        </p>
        <div className="mt-3 max-w-xl space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-foreground">Nuovo messaggio</p>
          <Input placeholder="Nome (es. Benvenuto)" value={tmplName} onChange={(e) => setTmplName(e.target.value)} />
          <Input placeholder="Nome template su Meta (obbligatorio se usi Meta Cloud API)" value={tmplMetaName} onChange={(e) => setTmplMetaName(e.target.value)} />
          <div>
            <label className="text-xs text-muted-foreground">Lingua template Meta (es. it, en)</label>
            <Input className="mt-1" placeholder="it" value={tmplMetaLang} onChange={(e) => setTmplMetaLang(e.target.value)} />
          </div>
          <Input placeholder="Testo del messaggio" value={tmplBody} onChange={(e) => setTmplBody(e.target.value)} />
          <Button type="button" size="sm" className="min-h-11" onClick={createWhatsappTemplate} disabled={tmplSaving || loading || readOnly}>
            {tmplSaving ? "Salvataggio…" : "Salva messaggio"}
          </Button>
        </div>
        {loading ? (
          <p className="mt-2 text-sm text-muted-foreground">Caricamento…</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-left font-medium">Canale</th>
                  <th className="px-3 py-2 text-left font-medium">Meta template</th>
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-muted-foreground">
                      Nessun messaggio salvato. Compila il modulo sopra per aggiungerne uno.
                    </td>
                  </tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t._id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{t.name}</td>
                      <td className="px-3 py-2">{t.channel}</td>
                      <td className="px-3 py-2">
                        {t.channel === "whatsapp" && (t.metaTemplateName || t.metaTemplateLanguage)
                          ? [t.metaTemplateName, t.metaTemplateLanguage].filter(Boolean).join(" · ")
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground">Quando inviare un messaggio</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Scegli un evento nel CRM e il messaggio WhatsApp da inviare al cliente.
        </p>
        {!loading && !whatsappLinked && (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            Senza Twilio o Meta configurati in Connettori, le regole non potranno consegnare messaggi WhatsApp reali.
          </p>
        )}
        <div className="mt-3 max-w-xl space-y-3 rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium text-foreground">Nuova regola (WhatsApp al cliente)</p>
          <Input placeholder="Nome regola" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
          <div>
            <label className="text-xs text-muted-foreground">Quando succede</label>
            <Select value={ruleEventType} onValueChange={(v) => setRuleEventType(v as AutomationEventType)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMM_EVENT_TYPES.map((k) => (
                  <SelectItem key={k} value={k}>
                    {EVENT_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Messaggio WhatsApp</label>
            <Select
              value={ruleTemplateId || "__pick__"}
              onValueChange={(v) => setRuleTemplateId(v === "__pick__" ? "" : v)}
              disabled={whatsappTemplates.length === 0}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={whatsappTemplates.length === 0 ? "Crea prima un messaggio sopra" : "Seleziona messaggio"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__pick__" disabled>
                  Seleziona…
                </SelectItem>
                {whatsappTemplates.map((t) => (
                  <SelectItem key={t._id} value={t._id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            onClick={createWhatsappRule}
            disabled={ruleSaving || loading || whatsappTemplates.length === 0 || readOnly}
          >
            {ruleSaving ? "Creazione…" : "Crea regola"}
          </Button>
        </div>
        {!loading && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-left font-medium">Stato</th>
                  <th className="px-3 py-2 text-left font-medium">Evento</th>
                  <th className="px-3 py-2 text-left font-medium">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                      Nessuna regola. Usa il modulo sopra per collegare un evento a un messaggio.
                    </td>
                  </tr>
                ) : (
                  rules.map((r) => (
                    <tr key={String(r._id)} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{String(r.name ?? "")}</td>
                      <td className="px-3 py-2">{r.enabled ? "Attiva" : "Disattiva"}</td>
                      <td className="px-3 py-2">{ruleEventLabel(r.trigger)}</td>
                      <td className="px-3 py-2">{Array.isArray(r.actions) ? r.actions.length : 0} azioni</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground">Ultime comunicazioni</h3>
        <p className="mt-1 text-sm text-muted-foreground">Invii recenti (email, WhatsApp).</p>
        {!loading && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Canale</th>
                  <th className="px-3 py-2 text-left font-medium">Destinatario</th>
                  <th className="px-3 py-2 text-left font-medium">Stato</th>
                  <th className="px-3 py-2 text-left font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-muted-foreground">
                      Nessun invio recente.
                    </td>
                  </tr>
                ) : (
                  deliveries.map((d) => (
                    <tr key={d._id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{d.channel}</td>
                      <td className="px-3 py-2">{d.recipientMasked}</td>
                      <td className="px-3 py-2">{d.status}</td>
                      <td className="px-3 py-2">{d.sentAt ? new Date(d.sentAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details className="group rounded-lg border border-border bg-muted/20">
        <summary className="cursor-pointer list-none rounded-lg px-4 py-3 text-sm font-semibold text-foreground marker:hidden [&::-webkit-details-marker]:hidden">
          Per amministratori di sistema
          <span className="ml-2 text-xs font-normal text-muted-foreground">(email SMTP, dettagli tecnici)</span>
        </summary>
        <div className="space-y-3 border-t border-border px-4 py-3 text-sm text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Email (server CRM):</span> configurazione tramite variabili d&apos;ambiente sul backend{" "}
            <code className="rounded bg-muted px-1 text-xs">SMTP_HOST</code>, <code className="rounded bg-muted px-1 text-xs">SMTP_FROM</code>
            {" "}e opzionalmente <code className="rounded bg-muted px-1 text-xs">SMTP_PORT</code>, <code className="rounded bg-muted px-1 text-xs">SMTP_USER</code>,{" "}
            <code className="rounded bg-muted px-1 text-xs">SMTP_PASS</code>. Sono distinte dalle impostazioni per inviti utenti (
            <code className="rounded bg-muted px-1 text-xs">SES_SMTP_*</code>, <code className="rounded bg-muted px-1 text-xs">EMAIL_FROM</code>).
          </p>
          <p>
            <span className="font-medium text-foreground">WhatsApp:</span> credenziali Twilio o Meta e messaggi di prova si gestiscono dal tab{" "}
            <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={goConnettoriTab}>
              Connettori
            </button>
            .
            {isAdmin && twilioLinked ? " (Twilio: prova nel drawer Twilio.)" : null}
            {isAdmin && metaLinked ? " (Meta: prova template nel drawer Meta WhatsApp.)" : null}
          </p>
        </div>
      </details>
    </div>
  );
}
