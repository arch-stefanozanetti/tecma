import { useState, useCallback, useEffect } from "react";
import { Plus, Pencil, Trash2, GitBranch } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { followupApi } from "../../api/followupApi";
import { useToast } from "../../contexts/ToastContext";
import type {
  AutomationRuleRow,
  AutomationRuleTrigger,
  CreateNotificationAction,
} from "../../types/domain";
import { EVENT_LABELS } from "./integrationsCatalog";
import type { AutomationEventType } from "../../types/domain";

export function RegoleTab({ workspaceId }: { workspaceId: string }) {
  const { toastError } = useToast();
  const [rules, setRules] = useState<AutomationRuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEventType, setFormEventType] = useState<AutomationEventType>("request.status_changed");
  const [formToStatus, setFormToStatus] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);

  const loadRules = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    followupApi
      .listAutomationRules(workspaceId)
      .then((res) => setRules(res.data ?? []))
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const openCreate = () => {
    setEditingId(null);
    setFormName("");
    setFormEventType("request.status_changed");
    setFormToStatus("");
    setFormTitle("");
    setFormBody("");
    setFormEnabled(true);
    setDrawerOpen(true);
  };

  const openEdit = (r: AutomationRuleRow) => {
    setEditingId(r._id);
    setFormName(r.name);
    setFormEventType(r.trigger.event_type);
    setFormToStatus(r.trigger.toStatus ?? "");
    const notif = r.actions.find((a) => a.type === "create_notification") as CreateNotificationAction | undefined;
    setFormTitle(notif?.title ?? "");
    setFormBody(notif?.body ?? "");
    setFormEnabled(r.enabled);
    setDrawerOpen(true);
  };

  const handleSubmit = () => {
    if (!formName.trim() || !formTitle.trim()) return;
    setSaving(true);
    const trigger: AutomationRuleTrigger = { event_type: formEventType };
    if (formEventType === "request.status_changed" && formToStatus.trim()) trigger.toStatus = formToStatus.trim();
    const payload = {
      name: formName.trim(),
      enabled: formEnabled,
      trigger,
      actions: [{ type: "create_notification" as const, title: formTitle.trim(), body: formBody.trim() || undefined }],
    };
    const done = () => {
      setSaving(false);
      setDrawerOpen(false);
      loadRules();
    };
    if (editingId) {
      followupApi
        .updateAutomationRule(editingId, payload)
        .then(done)
        .catch((err) => {
          setSaving(false);
          toastError(err?.message ?? "Errore salvataggio");
        });
    } else {
      followupApi
        .createAutomationRule(workspaceId, payload)
        .then(done)
        .catch((err) => {
          setSaving(false);
          toastError(err?.message ?? "Errore creazione");
        });
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Eliminare questa regola?")) return;
    followupApi
      .deleteAutomationRule(id)
      .then(() => loadRules())
      .catch((err) => toastError(err?.message ?? "Errore eliminazione"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Regole di automazione (notifiche in-app):</span> quando un evento si verifica
          (es. trattativa passa a stato X, nuovo cliente) viene creata una notifica in-app. Non sono le stesse &quot;regole di comunicazione&quot;
          (email/WhatsApp) della tab Comunicazioni — quelle usano template e il motore comunicazioni.
        </p>
        <Button size="sm" className="min-h-11 gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Nuova regola
        </Button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {!loading && rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((r) => (
            <div
              key={r._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <div className="font-medium text-foreground">{r.name}</div>
                <div className="text-xs text-muted-foreground">
                  Quando: {EVENT_LABELS[r.trigger.event_type]}
                  {r.trigger.toStatus && ` → ${r.trigger.toStatus}`} · Azione: crea notifica
                  {!r.enabled && " · Disabilitata"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="min-h-11" onClick={() => openEdit(r)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="min-h-11 text-destructive" onClick={() => handleDelete(r._id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && rules.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <GitBranch className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3 text-sm">Nessuna regola configurata. Crea la prima regola per automatizzare azioni su eventi.</p>
        </div>
      )}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>{editingId ? "Modifica regola" : "Nuova regola"}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div>
              <label htmlFor="rule-name" className="text-sm font-medium text-foreground">Nome</label>
              <Input
                id="rule-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Es. Notifica su vinto"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Trigger</label>
              <Select value={formEventType} onValueChange={(v) => setFormEventType(v as AutomationEventType)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(EVENT_LABELS) as AutomationEventType[]).map((k) => (
                    <SelectItem key={k} value={k}>{EVENT_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formEventType === "request.status_changed" && (
                <Input
                  placeholder="Stato di destinazione (opzionale)"
                  value={formToStatus}
                  onChange={(e) => setFormToStatus(e.target.value)}
                  className="mt-2"
                />
              )}
            </div>
            <div>
              <label htmlFor="notif-title" className="text-sm font-medium text-foreground">Titolo notifica</label>
              <Input
                id="notif-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Es. Trattativa vinta"
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="notif-body" className="text-sm font-medium text-foreground">Corpo (opzionale)</label>
              <Input
                id="notif-body"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Testo della notifica"
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="rule-enabled" checked={formEnabled} onCheckedChange={(c) => setFormEnabled(c === true)} />
              <label htmlFor="rule-enabled" className="text-sm font-normal text-foreground cursor-pointer">Regola attiva</label>
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button className="min-h-11" onClick={handleSubmit} disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
