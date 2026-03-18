import { useEffect, useState } from "react";
import moment from "moment";
import { followupApi } from "../../api/followupApi";
import type { CalendarEvent } from "../../types/domain";
import { Button } from "../../components/ui/button";
import {
  SidePanel,
  SidePanelBody,
  SidePanelClose,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle,
} from "../../components/ui/side-panel";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

const toDatetimeLocal = (iso: string) => moment(iso).format("YYYY-MM-DDTHH:mm");
const fromDatetimeLocal = (s: string) => moment(s).toISOString();

const SOURCE_OPTIONS: { value: CalendarEvent["source"]; label: string }[] = [
  { value: "FOLLOWUP_SELL", label: "Vendita" },
  { value: "FOLLOWUP_RENT", label: "Affitto" },
  { value: "CUSTOM_SERVICE", label: "Servizio" },
];

export interface CalendarEventFormPrefill {
  clientId?: string;
  projectId?: string;
  title?: string;
  startsAt?: string;
  endsAt?: string;
}

export interface CalendarEventFormDrawerProps {
  mode: "create" | "edit";
  event: CalendarEvent | null;
  defaultDate: moment.Moment;
  workspaceId: string;
  projectIds: string[];
  projects: { id: string; name: string; displayName: string }[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Prefill per modalità create (es. da Timeline). */
  prefill?: CalendarEventFormPrefill;
  /** Titolo drawer personalizzato (es. "Fissa in calendario"). */
  drawerTitle?: string;
  /** Cliente e Progetto in sola lettura (es. quando aperto da scheda cliente). */
  readOnlyClientAndProject?: boolean;
}

export const CalendarEventFormDrawer = ({
  mode,
  event,
  defaultDate,
  workspaceId,
  projectIds,
  projects,
  open,
  onClose,
  onSaved,
  prefill,
  drawerTitle,
  readOnlyClientAndProject = false,
}: CalendarEventFormDrawerProps) => {
  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [projectId, setProjectId] = useState("");
  const [source, setSource] = useState<CalendarEvent["source"]>("CUSTOM_SERVICE");
  const [clientId, setClientId] = useState("");
  const [clientsLite, setClientsLite] = useState<Array<{ _id: string; fullName: string; email?: string; projectId: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Carica clienti per la tendina quando il drawer è aperto (per select o per mostrare il nome in sola lettura)
  useEffect(() => {
    if (!open || !workspaceId || projectIds.length === 0) {
      setClientsLite([]);
      return;
    }
    followupApi
      .queryClientsLite(workspaceId, projectIds)
      .then((r) => setClientsLite(r.data ?? []))
      .catch(() => setClientsLite([]));
  }, [open, workspaceId, projectIds]);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    if (mode === "edit" && event) {
      setTitle(event.title);
      setStartsAt(toDatetimeLocal(event.startsAt));
      setEndsAt(toDatetimeLocal(event.endsAt));
      setProjectId(event.projectId);
      setSource(event.source);
      setClientId(event.clientId ?? "");
    } else {
      const start = prefill?.startsAt
        ? moment(prefill.startsAt)
        : defaultDate.clone().hour(9).minute(0).second(0);
      const end = prefill?.endsAt
        ? moment(prefill.endsAt)
        : start.clone().add(1, "hour");
      setTitle(prefill?.title ?? "");
      setStartsAt(start.format("YYYY-MM-DDTHH:mm"));
      setEndsAt(end.format("YYYY-MM-DDTHH:mm"));
      setProjectId(prefill?.projectId ?? projectIds[0] ?? "");
      setSource("CUSTOM_SERVICE");
      setClientId(prefill?.clientId ?? "");
    }
  }, [open, mode, event, defaultDate, projectIds, prefill]);

  const parseApiErrorMessage = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : "Errore durante il salvataggio.";
    try {
      const j = JSON.parse(msg) as { message?: string };
      if (typeof j?.message === "string" && j.message) return j.message;
    } catch {
      // ignore
    }
    return msg;
  };

  const canCreate = Boolean(workspaceId && projectIds?.length && projectId);
  const noScopeMessage =
    !workspaceId || !projectIds?.length
      ? "Seleziona un progetto nello scope per creare eventi."
      : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      if (mode === "edit" && event) {
        await followupApi.updateCalendarEvent(event._id, {
          title: title.trim(),
          startsAt: fromDatetimeLocal(startsAt),
          endsAt: fromDatetimeLocal(endsAt),
          projectId: projectId || undefined,
          source,
          ...(clientId.trim() ? { clientId: clientId.trim() } : { clientId: null }),
        });
      } else {
        if (!canCreate) {
          setFormError(noScopeMessage ?? "Seleziona un progetto.");
          return;
        }
        await followupApi.createCalendarEvent({
          workspaceId: workspaceId!,
          projectId,
          title: title.trim(),
          startsAt: fromDatetimeLocal(startsAt),
          endsAt: fromDatetimeLocal(endsAt),
          source,
          ...(clientId.trim() && { clientId: clientId.trim() }),
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setFormError(parseApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const titleLabel =
    drawerTitle ?? (mode === "edit" ? "Modifica evento" : "Nuovo evento");

  return (
    <SidePanel variant="operational" open={open} onOpenChange={(o) => !o && onClose()}>
      <SidePanelContent side="right" size="md">
        <SidePanelHeader actions={<SidePanelClose />}>
          <SidePanelTitle>{titleLabel}</SidePanelTitle>
        </SidePanelHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <SidePanelBody className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Titolo *</label>
              <Input
                className="h-10 rounded-lg border-border"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Titolo evento"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Inizio</label>
              <Input
                type="datetime-local"
                className="h-10 rounded-lg border-border"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Fine</label>
              <Input
                type="datetime-local"
                className="h-10 rounded-lg border-border"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Progetto</label>
              {readOnlyClientAndProject ? (
                <Input
                  className="h-10 rounded-lg border-border bg-muted"
                  value={projects.find((p) => p.id === projectId)?.displayName || projects.find((p) => p.id === projectId)?.name || projectId}
                  readOnly
                  disabled
                />
              ) : (
                <Select value={projectId} onValueChange={setProjectId} required>
                  <SelectTrigger className="h-10 rounded-lg border-border">
                    <SelectValue placeholder="Seleziona progetto" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.filter((p) => projectIds.includes(p.id)).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.displayName || p.name || p.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Cliente</label>
              {readOnlyClientAndProject ? (
                <Input
                  className="h-10 rounded-lg border-border bg-muted"
                  value={
                    clientId && clientsLite.length > 0
                      ? clientsLite.find((c) => c._id === clientId)?.fullName ?? clientId
                      : clientId || "—"
                  }
                  readOnly
                  disabled
                />
              ) : (
                <Select
                  value={clientId || "__none__"}
                  onValueChange={(v) => setClientId(v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="h-10 rounded-lg border-border">
                    <SelectValue placeholder="Seleziona cliente (opzionale)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessuno</SelectItem>
                    {clientsLite.map((c) => (
                      <SelectItem key={c._id} value={c._id}>
                        {c.fullName}
                        {c.email ? ` — ${c.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Tipo</label>
              <Select value={source} onValueChange={(v) => setSource(v as CalendarEvent["source"])}>
                <SelectTrigger className="h-10 rounded-lg border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {noScopeMessage && mode === "create" && !readOnlyClientAndProject && (
              <p className="text-sm text-amber-600">{noScopeMessage}</p>
            )}
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </SidePanelBody>
          <SidePanelFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={saving || (mode === "create" && !canCreate)}>
              {saving ? "Salvataggio..." : mode === "edit" ? "Salva" : "Crea"}
            </Button>
          </SidePanelFooter>
        </form>
      </SidePanelContent>
    </SidePanel>
  );
};
