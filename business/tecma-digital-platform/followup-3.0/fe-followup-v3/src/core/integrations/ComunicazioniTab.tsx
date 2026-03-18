import { useState, useCallback, useEffect } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { followupApi } from "../../api/followupApi";
import { useToast } from "../../contexts/ToastContext";

export function ComunicazioniTab({ workspaceId }: { workspaceId: string }) {
  const { toastError } = useToast();
  const [templates, setTemplates] = useState<Array<{ _id: string; name: string; channel: string; subject?: string; bodyText: string }>>([]);
  const [rules, setRules] = useState<Array<Record<string, unknown>>>([]);
  const [deliveries, setDeliveries] = useState<Array<{ _id: string; channel: string; templateId: string; recipientMasked: string; status: string; sentAt: string }>>([]);
  const [whatsappConfig, setWhatsappConfig] = useState<{ config: { accountSid: string; fromNumber: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [waSaving, setWaSaving] = useState(false);
  const [waAccountSid, setWaAccountSid] = useState("");
  const [waAuthToken, setWaAuthToken] = useState("");
  const [waFromNumber, setWaFromNumber] = useState("");

  const load = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    Promise.all([
      followupApi.listCommunicationTemplates(workspaceId).then((r) => setTemplates(r.data ?? [])).catch(() => setTemplates([])),
      followupApi.listCommunicationRules(workspaceId).then((r) => setRules(r.data ?? [])).catch(() => setRules([])),
      followupApi.listCommunicationDeliveries(workspaceId, 30).then((r) => setDeliveries(r.data ?? [])).catch(() => setDeliveries([])),
      followupApi.getWhatsAppConfig(workspaceId).then((r) => { setWhatsappConfig(r.config ? { config: r.config.config } : null); if (r.config?.config) { setWaAccountSid(r.config.config.accountSid); setWaFromNumber(r.config.config.fromNumber); } }).catch(() => setWhatsappConfig(null)),
    ]).finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => { load(); }, [load]);

  const saveWhatsApp = () => {
    if (!workspaceId || !waAccountSid.trim() || !waAuthToken.trim() || !waFromNumber.trim()) {
      toastError("Compila Account SID, Auth Token e Numero mittente.");
      return;
    }
    setWaSaving(true);
    followupApi.saveWhatsAppConfig(workspaceId, { accountSid: waAccountSid.trim(), authToken: waAuthToken.trim(), fromNumber: waFromNumber.trim() })
      .then(() => { load(); setWaAuthToken(""); })
      .catch((e) => toastError(e?.message ?? "Errore salvataggio"))
      .finally(() => setWaSaving(false));
  };

  const removeWhatsApp = () => {
    if (!workspaceId || !window.confirm("Rimuovere la configurazione WhatsApp?")) return;
    followupApi.deleteWhatsAppConfig(workspaceId).then(() => { setWhatsappConfig(null); setWaAccountSid(""); setWaAuthToken(""); setWaFromNumber(""); }).catch((e) => toastError(e?.message ?? "Errore"));
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold text-foreground">Template</h3>
        <p className="text-sm text-muted-foreground mt-1">Template per email, WhatsApp, SMS e notifiche in-app (variabili: {"{{client_name}}"}, {"{{apartment_name}}"}, {"{{visit_date}}"}, ecc.).</p>
        {loading ? <p className="text-sm text-muted-foreground mt-2">Caricamento...</p> : (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50"><th className="px-3 py-2 text-left font-medium">Nome</th><th className="px-3 py-2 text-left font-medium">Canale</th><th className="px-3 py-2 text-left font-medium">Oggetto</th></tr></thead>
              <tbody>
                {templates.length === 0 ? <tr><td colSpan={3} className="px-3 py-4 text-muted-foreground">Nessun template. Crea un template via API o da interfaccia dedicata.</td></tr> :
                  templates.map((t) => (
                    <tr key={t._id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{t.name}</td>
                      <td className="px-3 py-2">{t.channel}</td>
                      <td className="px-3 py-2">{t.subject ?? "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">Regole di comunicazione</h3>
        <p className="text-sm text-muted-foreground mt-1">Evento → azioni (email, WhatsApp, notifica in-app).</p>
        {!loading && (
          <div className="mt-3 overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border bg-muted/50"><th className="px-3 py-2 text-left font-medium">Nome</th><th className="px-3 py-2 text-left font-medium">Stato</th><th className="px-3 py-2 text-left font-medium">Evento</th><th className="px-3 py-2 text-left font-medium">Azioni</th></tr></thead>
              <tbody>
                {rules.length === 0 ? <tr><td colSpan={4} className="px-3 py-4 text-muted-foreground">Nessuna regola. Crea una regola via API.</td></tr> :
                  rules.map((r) => (
                    <tr key={String(r._id)} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{String(r.name ?? "")}</td>
                      <td className="px-3 py-2">{r.enabled ? "Attiva" : "Disattiva"}</td>
                      <td className="px-3 py-2">{typeof r.trigger === "object" && r.trigger && "eventType" in r.trigger ? String((r.trigger as { eventType: string }).eventType) : "—"}</td>
                      <td className="px-3 py-2">{Array.isArray(r.actions) ? r.actions.length : 0} azioni</td>
                    </tr>
                  ))}
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
              <thead><tr className="border-b border-border bg-muted/50"><th className="px-3 py-2 text-left font-medium">Canale</th><th className="px-3 py-2 text-left font-medium">Destinatario</th><th className="px-3 py-2 text-left font-medium">Stato</th><th className="px-3 py-2 text-left font-medium">Data</th></tr></thead>
              <tbody>
                {deliveries.length === 0 ? <tr><td colSpan={4} className="px-3 py-4 text-muted-foreground">Nessun invio recente.</td></tr> :
                  deliveries.map((d) => (
                    <tr key={d._id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">{d.channel}</td>
                      <td className="px-3 py-2">{d.recipientMasked}</td>
                      <td className="px-3 py-2">{d.status}</td>
                      <td className="px-3 py-2">{d.sentAt ? new Date(d.sentAt).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h3 className="text-lg font-semibold text-foreground">Canali</h3>
        <p className="text-sm text-muted-foreground mt-1">Configurazione WhatsApp (Twilio) per workspace. SMTP email da variabili d&apos;ambiente (SMTP_HOST, SMTP_FROM, ecc.).</p>
        <div className="mt-4 space-y-3 max-w-md">
          <div>
            <label className="text-sm font-medium text-foreground">Account SID (Twilio)</label>
            <Input className="mt-1" value={waAccountSid} onChange={(e) => setWaAccountSid(e.target.value)} placeholder="AC..." />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Auth Token</label>
            <Input type="password" className="mt-1" value={waAuthToken} onChange={(e) => setWaAuthToken(e.target.value)} placeholder={whatsappConfig ? "•••••••• (lascia vuoto per non modificare)" : "Token"} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Numero mittente (es. +39...)</label>
            <Input className="mt-1" value={waFromNumber} onChange={(e) => setWaFromNumber(e.target.value)} placeholder="+39..." />
          </div>
          <div className="flex gap-2">
            <Button onClick={saveWhatsApp} disabled={waSaving}>{waSaving ? "Salvataggio..." : "Salva WhatsApp"}</Button>
            {whatsappConfig && <Button variant="outline" onClick={removeWhatsApp}>Rimuovi config</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
