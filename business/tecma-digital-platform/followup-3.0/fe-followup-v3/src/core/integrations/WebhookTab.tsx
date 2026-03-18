import { useState, useCallback, useEffect } from "react";
import { Plus, Pencil, Trash2, Webhook } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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
import type { WebhookConfigRow } from "../../types/domain";
import type { AutomationEventType } from "../../types/domain";
import { EVENT_LABELS } from "./integrationsCatalog";

export function WebhookTab({ workspaceId }: { workspaceId: string }) {
  const { toastError } = useToast();
  const [configs, setConfigs] = useState<WebhookConfigRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formUrl, setFormUrl] = useState("");
  const [formSecret, setFormSecret] = useState("");
  const [formEvents, setFormEvents] = useState<AutomationEventType[]>(["request.created", "request.status_changed"]);
  const [formEnabled, setFormEnabled] = useState(true);

  const loadConfigs = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    followupApi
      .listWebhookConfigs(workspaceId)
      .then((res) => setConfigs(res.data ?? []))
      .catch(() => setConfigs([]))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);

  const toggleEvent = (e: AutomationEventType) => {
    setFormEvents((prev) =>
      prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]
    );
  };

  const openCreate = () => {
    setEditingId(null);
    setFormUrl("");
    setFormSecret("");
    setFormEvents(["request.created", "request.status_changed"]);
    setFormEnabled(true);
    setDrawerOpen(true);
  };

  const openEdit = (c: WebhookConfigRow) => {
    setEditingId(c._id);
    setFormUrl(c.url);
    setFormSecret(c.secret ?? "");
    setFormEvents(c.events.length ? c.events : ["request.created", "request.status_changed"]);
    setFormEnabled(c.enabled);
    setDrawerOpen(true);
  };

  const handleSubmit = () => {
    if (!formUrl.trim()) return;
    if (formEvents.length === 0) {
      toastError("Seleziona almeno un evento.");
      return;
    }
    setSaving(true);
    const payload = {
      url: formUrl.trim(),
      secret: formSecret.trim() || undefined,
      events: formEvents,
      enabled: formEnabled,
    };
    const done = () => {
      setSaving(false);
      setDrawerOpen(false);
      loadConfigs();
    };
    if (editingId) {
      followupApi
        .updateWebhookConfig(editingId, payload)
        .then(done)
        .catch((err) => {
          setSaving(false);
          toastError(err?.message ?? "Errore salvataggio");
        });
    } else {
      followupApi
        .createWebhookConfig(workspaceId, payload)
        .then(done)
        .catch((err) => {
          setSaving(false);
          toastError(err?.message ?? "Errore creazione");
        });
    }
  };

  const handleDelete = (id: string) => {
    if (!window.confirm("Eliminare questo webhook?")) return;
    followupApi
      .deleteWebhookConfig(id)
      .then(() => loadConfigs())
      .catch((err) => toastError(err?.message ?? "Errore eliminazione"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Endpoint configurabile per workspace: il backend invierà payload su eventi (nuova trattativa,
          cambio stato). Configura URL, secret e eventi abilitati.
        </p>
        <Button size="sm" variant="outline" className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Aggiungi webhook
        </Button>
      </div>
      {loading && <p className="text-sm text-muted-foreground">Caricamento...</p>}
      {!loading && configs.length > 0 && (
        <div className="space-y-2">
          {configs.map((c) => (
            <div
              key={c._id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4"
            >
              <div>
                <div className="font-medium text-foreground">{c.url}</div>
                <div className="text-xs text-muted-foreground">
                  Eventi: {c.events.map((e) => EVENT_LABELS[e]).join(", ")}
                  {!c.enabled && " · Disabilitato"}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDelete(c._id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && configs.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          <Webhook className="mx-auto h-10 w-10 opacity-40" />
          <p className="mt-3 text-sm">Nessun webhook configurato. Aggiungi un endpoint per ricevere eventi in tempo reale.</p>
        </div>
      )}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader actions={<DrawerCloseButton />}>
            <DrawerTitle>{editingId ? "Modifica webhook" : "Aggiungi webhook"}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div>
              <label htmlFor="wh-url" className="text-sm font-medium text-foreground">URL</label>
              <Input
                id="wh-url"
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://..."
                className="mt-1"
              />
            </div>
            <div>
              <label htmlFor="wh-secret" className="text-sm font-medium text-foreground">Secret (opzionale, per firma HMAC)</label>
              <Input
                id="wh-secret"
                type="password"
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                placeholder="Secret per X-Webhook-Signature"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Eventi</label>
              <div className="mt-2 flex flex-col gap-2">
                {(Object.keys(EVENT_LABELS) as AutomationEventType[]).map((e) => (
                  <div key={e} className="flex items-center gap-2">
                    <Checkbox
                      id={`ev-${e}`}
                      checked={formEvents.includes(e)}
                      onCheckedChange={() => toggleEvent(e)}
                    />
                    <label htmlFor={`ev-${e}`} className="text-sm font-normal text-foreground cursor-pointer">{EVENT_LABELS[e]}</label>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="wh-enabled" checked={formEnabled} onCheckedChange={(c) => setFormEnabled(c === true)} />
              <label htmlFor="wh-enabled" className="text-sm font-normal text-foreground cursor-pointer">Webhook attivo</label>
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button onClick={handleSubmit} disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
