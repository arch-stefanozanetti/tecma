import { useState, useCallback, useEffect } from "react";
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

export function ComunicazioniTab({ workspaceId, isAdmin = false }: { workspaceId: string; isAdmin?: boolean }) {
  const { toastError, toastSuccess } = useToast();
  const [templates, setTemplates] = useState<Array<{ _id: string; name: string; channel: string; subject?: string; bodyText: string }>>([]);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [deliveries, setDeliveries] = useState<Array<{ _id: string; channel: string; templateId: string; recipientMasked: string; status: string; sentAt: string }>>([]);
  const [whatsappConfig, setWhatsappConfig] = useState<{ config: { accountSid: string; fromNumber: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [waSaving, setWaSaving] = useState(false);
  const [waAccountSid, setWaAccountSid] = useState("");
  const [waAuthToken, setWaAuthToken] = useState("");
  const [waFromNumber, setWaFromNumber] = useState("");
  const [waTestTo, setWaTestTo] = useState("");
  const [waTestBody, setWaTestBody] = useState("");
  const [waTestSending, setWaTestSending] = useState(false);
  const [tmplName, setTmplName] = useState("");
  const [tmplBody, setTmplBody] = useState("");
  const [tmplSaving, setTmplSaving] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleEventType, setRuleEventType] = useState<AutomationEventType>("client.created");
  const [ruleTemplateId, setRuleTemplateId] = useState("");
  const [ruleSaving, setRuleSaving] = useState(false);

  const load = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    Promise.all([
      followupApi.listCommunicationTemplates(workspaceId).then((r) => setTemplates(r.data ?? [])).catch(() => setTemplates([])),
      followupApi.listCommunicationRules(workspaceId).then((r) => setRules(r.data ?? [])).catch(() => setRules([])),
      followupApi.listCommunicationDeliveries(workspaceId, 30).then((r) => setDeliveries(r.data ?? [])).catch(() => setDeliveries([])),
      followupApi.getWhatsAppConfig(workspaceId).then((r) => {
        setWhatsappConfig(r.config ? { config: r.config.config } : null);
        if (r.config?.config) {
          setWaAccountSid(r.config.config.accountSid);
          setWaFromNumber(r.config.config.fromNumber);
        }
      }).catch(() => setWhatsappConfig(null)),
    ]).finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveWhatsApp = () => {
    if (!workspaceId || !waAccountSid.trim() || !waAuthToken.trim() || !waFromNumber.trim()) {
      toastError("Compila Account SID, Auth Token e Numero mittente.");
      return;
    }
    setWaSaving(true);
    followupApi
      .saveWhatsAppConfig(workspaceId, {
        accountSid: waAccountSid.trim(),
        authToken: waAuthToken.trim(),
        fromNumber: waFromNumber.trim(),
      })
      .then(() => {
        load();
        setWaAuthToken("");
        toastSuccess("Configurazione WhatsApp salvata.");
      })
      .catch((e) => toastError(e?.message ?? "Errore salvataggio"))
      .finally(() => setWaSaving(false));
  };

  const removeWhatsApp = () => {
    if (!workspaceId || !window.confirm("Rimuovere la configurazione WhatsApp?")) return;
    followupApi
      .deleteWhatsAppConfig(workspaceId)
      .then(() => {
        setWhatsappConfig(null);
        setWaAccountSid("");
        setWaAuthToken("");
        setWaFromNumber("");
        toastSuccess("Configurazione WhatsApp rimossa.");
      })
      .catch((e) => toastError(e?.message ?? "Errore"));
  };

  const sendTestWhatsApp = () => {
    if (!workspaceId || !waTestTo.trim()) {
      toastError("Inserisci il numero di destinazione (E.164, es. +39333…).");
      return;
    }
    setWaTestSending(true);
    followupApi
      .testWhatsAppMessage(workspaceId, {
        to: waTestTo.trim(),
        body: waTestBody.trim() || undefined,
      })
      .then(() => {
        toastSuccess("Messaggio di prova inviato. Controlla il telefono e i log Twilio.");
        setWaTestBody("");
      })
      .catch((e) => toastError(e?.message ?? "Invio fallito (verifica Twilio e sandbox)."))
      .finally(() => setWaTestSending(false));
  };

  const createWhatsappTemplate = () => {
    if (!workspaceId || !tmplName.trim() || !tmplBody.trim()) {
      toastError("Nome e testo del template sono obbligatori.");
      return;
    }
    setTmplSaving(true);
    followupApi
      .createCommunicationTemplate(workspaceId, {
        channel: "whatsapp",
        name: tmplName.trim(),
        bodyText: tmplBody.trim(),
      })
      .then(() => {
        setTmplName("");
        setTmplBody("");
        load();
        toastSuccess("Template WhatsApp creato.");
      })
      .catch((e) => toastError(e?.message ?? "Errore creazione template"))
      .finally(() => setTmplSaving(false));
  };

  const createWhatsappRule = () => {
    if (!workspaceId || !ruleName.trim() || !ruleTemplateId) {
      toastError("Nome e template collegato sono obbligatori.");
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
        toastSuccess("Regola di comunicazione creata.");
      })
      .catch((e) => toastError(e?.message ?? "Errore creazione regola"))
      .finally(() => setRuleSaving(false));
  };

  const whatsappTemplates = templates.filter((t) => t.channel === "whatsapp");

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground rounded-lg border border-border bg-muted/30 p-3">
        <span className="font-medium text-foreground">Questa tab</span> gestisce template, regole di <em>comunicazione</em> (email/WhatsApp/SMS) e log invii.
        Le <span className="font-medium text-foreground">Automazioni</span> (notifiche in-app su eventi) sono nella tab dedicata.
      </p>

      <div>
        <h3 className="text-lg font-semibold text-foreground">Template</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Template per email, WhatsApp, SMS e notifiche in-app (variabili: {"{{client_name}}"}, {"{{apartment_name}}"}, {"{{visit_date}}"}, ecc.).
        </p>
        <div className="mt-3 rounded-lg border border-border bg-card p-4 space-y-3 max-w-xl">
          <p className="text-xs font-medium text-foreground">Aggiungi template WhatsApp (minimo)</p>
          <Input placeholder="Nome template" value={tmplName} onChange={(e) => setTmplName(e.target.value)} />
          <Input placeholder="Testo messaggio" value={tmplBody} onChange={(e) => setTmplBody(e.target.value)} />
          <Button type="button" size="sm" className="min-h-11" onClick={createWhatsappTemplate} disabled={tmplSaving || loading}>
            {tmplSaving ? "Creazione…" : "Crea template WhatsApp"}
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground mt-2">Caricamento...</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium">Nome</th>
                  <th className="px-3 py-2 text-left font-medium">Canale</th>
                  <th className="px-3 py-2 text-left font-medium">Oggetto</th>
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-muted-foreground">
                      Nessun template. Usa il modulo sopra o le API <code className="text-xs">POST /v1/workspaces/…/communication-templates</code>.
                    </td>
                  </tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t._id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{t.name}</td>
                      <td className="px-3 py-2">{t.channel}</td>
                      <td className="px-3 py-2">{t.subject ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold text-foreground">Regole di comunicazione</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Evento → azioni (es. invio WhatsApp al cliente usando un template). Distinte dalle automazioni in-app nella tab &quot;Automazioni&quot;.
        </p>
        <div className="mt-3 rounded-lg border border-border bg-card p-4 space-y-3 max-w-xl">
          <p className="text-xs font-medium text-foreground">Aggiungi regola: WhatsApp al cliente su evento</p>
          <Input placeholder="Nome regola" value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
          <div>
            <label className="text-xs text-muted-foreground">Evento</label>
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
            <label className="text-xs text-muted-foreground">Template WhatsApp</label>
            <Select
              value={ruleTemplateId || "__pick__"}
              onValueChange={(v) => setRuleTemplateId(v === "__pick__" ? "" : v)}
              disabled={whatsappTemplates.length === 0}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder={whatsappTemplates.length === 0 ? "Crea prima un template" : "Seleziona template"} />
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
          <Button type="button" size="sm" className="min-h-11" onClick={createWhatsappRule} disabled={ruleSaving || loading || whatsappTemplates.length === 0}>
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
                      Nessuna regola. Usa il modulo sopra o <code className="text-xs">POST /v1/workspaces/…/communication-rules</code>.
                    </td>
                  </tr>
                ) : (
                  rules.map((r) => (
                    <tr key={String(r._id)} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{String(r.name ?? "")}</td>
                      <td className="px-3 py-2">{r.enabled ? "Attiva" : "Disattiva"}</td>
                      <td className="px-3 py-2">
                        {typeof r.trigger === "object" && r.trigger && "eventType" in r.trigger
                          ? String((r.trigger as { eventType: string }).eventType)
                          : "—"}
                      </td>
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
        <h3 className="text-lg font-semibold text-foreground">Ultime comunicazioni (Notification Center)</h3>
        <p className="text-sm text-muted-foreground mt-1">Log degli invii recenti (email, WhatsApp).</p>
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

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-lg font-semibold text-foreground">Canali</h3>
        <p className="text-sm text-muted-foreground mt-1">
          <span className="font-medium text-foreground">Email (motore comunicazioni CRM):</span> variabili d&apos;ambiente sul backend{" "}
          <code className="text-xs">SMTP_HOST</code>, <code className="text-xs">SMTP_FROM</code> e opzionalmente <code className="text-xs">SMTP_PORT</code>,{" "}
          <code className="text-xs">SMTP_USER</code>, <code className="text-xs">SMTP_PASS</code>. Sono <em>distinte</em> dalle variabili per inviti utenti (
          <code className="text-xs">SES_SMTP_*</code>, <code className="text-xs">EMAIL_FROM</code>).
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          <span className="font-medium text-foreground">WhatsApp (Twilio):</span> credenziali per workspace. Il backend aggiunge il prefisso{" "}
          <code className="text-xs">whatsapp:</code> richiesto da Twilio per il canale WhatsApp (puoi inserire il numero come +39…).
        </p>
        <div className="mt-4 space-y-3 max-w-md">
          <div>
            <label className="text-sm font-medium text-foreground">Account SID (Twilio)</label>
            <Input className="mt-1" value={waAccountSid} onChange={(e) => setWaAccountSid(e.target.value)} placeholder="AC..." />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Auth Token</label>
            <Input
              type="password"
              className="mt-1"
              value={waAuthToken}
              onChange={(e) => setWaAuthToken(e.target.value)}
              placeholder={whatsappConfig ? "•••••••• (lascia vuoto per non modificare)" : "Token"}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Numero mittente (es. +39… o sandbox Twilio)</label>
            <Input className="mt-1" value={waFromNumber} onChange={(e) => setWaFromNumber(e.target.value)} placeholder="+14155238886" />
          </div>
          <div className="flex gap-2">
            <Button className="min-h-11" onClick={saveWhatsApp} disabled={waSaving}>
              {waSaving ? "Salvataggio..." : "Salva WhatsApp"}
            </Button>
            {whatsappConfig && (
              <Button variant="outline" className="min-h-11" onClick={removeWhatsApp}>
                Rimuovi config
              </Button>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6 pt-6 border-t border-border max-w-md space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Messaggio di prova (solo admin)</h4>
            <p className="text-xs text-muted-foreground">
              Verifica Account SID, token e mittente senza passare da regole o template. Usa un numero autorizzato (sandbox Twilio o destinatario verificato).
            </p>
            <Input placeholder="Destinatario E.164, es. +393331112233" value={waTestTo} onChange={(e) => setWaTestTo(e.target.value)} />
            <Input placeholder="Testo (opzionale)" value={waTestBody} onChange={(e) => setWaTestBody(e.target.value)} />
            <Button type="button" variant="secondary" className="min-h-11" onClick={sendTestWhatsApp} disabled={waTestSending || !whatsappConfig}>
              {waTestSending ? "Invio…" : "Invia prova WhatsApp"}
            </Button>
            {!whatsappConfig && <p className="text-xs text-muted-foreground">Salva prima la configurazione WhatsApp.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
