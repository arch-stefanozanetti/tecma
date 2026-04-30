import { useEffect, useState } from "react";
import moment from "moment";
import { followupApi } from "../../api/followupApi";
import { useIsMobile } from "../shared/useIsMobile";
import type { ApartmentRow, CalendarEvent, WorkspaceUserRow } from "../../types/domain";
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
import { DatetimeField } from "../../components/ui/datetime-field";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  CALENDAR_ACTIVITY_STATUSES,
  CALENDAR_ACTIVITY_TYPES,
  CALENDAR_OUTCOMES,
  OUTCOME_LABELS,
} from "./calendarConstants";

const toDatetimeLocal = (iso: string) => moment(iso).format("YYYY-MM-DDTHH:mm");
const fromDatetimeLocal = (s: string) => moment(s).toISOString();

const SOURCE_OPTIONS: { value: CalendarEvent["source"]; label: string }[] = [
  { value: "FOLLOWUP_SELL", label: "Canale — Vendita" },
  { value: "FOLLOWUP_RENT", label: "Canale — Affitto" },
  { value: "CUSTOM_SERVICE", label: "Canale — Servizio" },
];

const SUBMIT_LABEL: Record<"create" | "edit", string> = { create: "Crea", edit: "Salva" };

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
  /** Membri workspace (vendor / assegnazione). */
  workspaceUsers?: WorkspaceUserRow[];
  currentUserEmail?: string;
  /** Può assegnare ad altri utenti */
  canAssignAny?: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: (createdEvent?: CalendarEvent) => void;
  prefill?: CalendarEventFormPrefill;
  drawerTitle?: string;
  readOnlyClientAndProject?: boolean;
}

export const CalendarEventFormDrawer = ({
  mode,
  event,
  defaultDate,
  workspaceId,
  projectIds,
  projects,
  workspaceUsers = [],
  currentUserEmail = "",
  canAssignAny = false,
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
  const [allDay, setAllDay] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [source, setSource] = useState<CalendarEvent["source"]>("CUSTOM_SERVICE");
  const [activityType, setActivityType] = useState<NonNullable<CalendarEvent["activityType"]>>("meeting");
  const [activityStatus, setActivityStatus] = useState<NonNullable<CalendarEvent["activityStatus"]>>("none");
  const [outcome, setOutcome] = useState<string>("__none__");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [apartmentIds, setApartmentIds] = useState<string[]>([]);
  const [notesInternal, setNotesInternal] = useState("");
  const [notesClientVisible, setNotesClientVisible] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [notifyClientOnActivityUpdate, setNotifyClientOnActivityUpdate] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientsLite, setClientsLite] = useState<Array<{ _id: string; fullName: string; email?: string; projectId: string }>>([]);
  const [apartmentOptions, setApartmentOptions] = useState<ApartmentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isMobile = useIsMobile();

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
    if (!open || !workspaceId || !projectId) {
      setApartmentOptions([]);
      return;
    }
    followupApi.apartments
      .queryApartments({
        workspaceId,
        projectIds: [projectId],
        page: 1,
        perPage: 200,
        searchText: "",
        sort: { field: "code", direction: 1 },
        filters: {},
      })
      .then((r) => setApartmentOptions(r.data ?? []))
      .catch(() => setApartmentOptions([]));
  }, [open, workspaceId, projectId]);

  useEffect(() => {
    if (!open) return;
    setFormError(null);
    const defaultAssignee =
      currentUserEmail.trim().toLowerCase() ||
      workspaceUsers[0]?.userId?.trim().toLowerCase() ||
      "";
    if (mode === "edit" && event) {
      setTitle(event.title);
      setStartsAt(toDatetimeLocal(event.startsAt));
      setEndsAt(toDatetimeLocal(event.endsAt));
      setAllDay(event.allDay === true);
      setProjectId(event.projectId);
      setSource(event.source);
      setActivityType(event.activityType ?? "meeting");
      setActivityStatus(event.activityStatus ?? "none");
      setOutcome(event.outcome && event.outcome.length > 0 ? event.outcome : "__none__");
      setAssignedUserId((event.assignedUserId ?? defaultAssignee).toLowerCase());
      setApartmentIds(event.apartmentIds?.length ? event.apartmentIds : event.apartmentId ? [event.apartmentId] : []);
      setNotesInternal(event.notesInternal ?? "");
      setNotesClientVisible(event.notesClientVisible ?? "");
      setAdditionalInfo(event.additionalInfo ?? "");
      setNotifyClientOnActivityUpdate(event.notifyClientOnActivityUpdate === true);
      setClientId(event.clientId ?? "");
    } else {
      const start = prefill?.startsAt
        ? moment(prefill.startsAt)
        : defaultDate.clone().hour(9).minute(0).second(0);
      const end = prefill?.endsAt ? moment(prefill.endsAt) : start.clone().add(1, "hour");
      setTitle(prefill?.title ?? "");
      setStartsAt(start.format("YYYY-MM-DDTHH:mm"));
      setEndsAt(end.format("YYYY-MM-DDTHH:mm"));
      setAllDay(false);
      setProjectId(prefill?.projectId ?? projectIds[0] ?? "");
      setSource("CUSTOM_SERVICE");
      setActivityType("meeting");
      setActivityStatus("none");
      setOutcome("__none__");
      setAssignedUserId(defaultAssignee);
      setApartmentIds([]);
      setNotesInternal("");
      setNotesClientVisible("");
      setAdditionalInfo("");
      setNotifyClientOnActivityUpdate(false);
      setClientId(prefill?.clientId ?? "");
    }
  }, [open, mode, event, defaultDate, projectIds, prefill, currentUserEmail, workspaceUsers]);

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
    !workspaceId || !projectIds?.length ? "Seleziona un progetto nello scope per creare eventi." : null;

  const buildTimeIso = () => {
    if (allDay) {
      const d = moment(startsAt).startOf("day");
      return {
        startsAtIso: d.toISOString(),
        endsAtIso: d.clone().endOf("day").toISOString(),
      };
    }
    let endsAtValue = endsAt;
    if (moment(endsAtValue).isSameOrBefore(moment(startsAt))) {
      endsAtValue = moment(startsAt).add(1, "hour").format("YYYY-MM-DDTHH:mm");
    }
    return { startsAtIso: fromDatetimeLocal(startsAt), endsAtIso: fromDatetimeLocal(endsAtValue) };
  };

  const toggleApartment = (id: string) => {
    setApartmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const { startsAtIso, endsAtIso } = buildTimeIso();
      const assignee = (assignedUserId || currentUserEmail).trim().toLowerCase();
      if (mode === "edit" && event) {
        await followupApi.updateCalendarEvent(event._id, {
          title: title.trim(),
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          projectId,
          source,
          activityType,
          activityStatus,
          outcome: outcome === "__none__" ? null : (outcome as CalendarEvent["outcome"]),
          assignedUserId: assignee,
          allDay: allDay || undefined,
          apartmentIds: apartmentIds.length > 0 ? apartmentIds : null,
          notesInternal: notesInternal.trim() || null,
          notesClientVisible: notesClientVisible.trim() || null,
          additionalInfo: additionalInfo.trim() || null,
          notifyClientOnActivityUpdate,
          clientId: clientId.trim() ? clientId.trim() : null,
        });
        onSaved();
      } else {
        if (!canCreate) {
          setFormError(noScopeMessage ?? "Seleziona un progetto.");
          return;
        }
        const { event: createdEvent } = await followupApi.createCalendarEvent({
          workspaceId: workspaceId!,
          projectId,
          title: title.trim(),
          startsAt: startsAtIso,
          endsAt: endsAtIso,
          source,
          activityType,
          activityStatus,
          ...(outcome !== "__none__" && { outcome: outcome as CalendarEvent["outcome"] }),
          assignedUserId: assignee,
          allDay: allDay || undefined,
          apartmentIds: apartmentIds.length > 0 ? apartmentIds : undefined,
          notesInternal: notesInternal.trim() || undefined,
          notesClientVisible: notesClientVisible.trim() || undefined,
          additionalInfo: additionalInfo.trim() || undefined,
          notifyClientOnActivityUpdate: notifyClientOnActivityUpdate || undefined,
          ...(clientId.trim() && { clientId: clientId.trim() }),
        });
        onSaved(createdEvent);
      }
      onClose();
    } catch (err) {
      setFormError(parseApiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const titleLabel = drawerTitle ?? (mode === "edit" ? "Modifica attività" : "Nuova attività");

  return (
    <SidePanel variant="operational" open={open} onOpenChange={(o) => !o && onClose()}>
      <SidePanelContent side="right" size={isMobile ? "full" : "lg"} className={isMobile ? "h-full max-h-full" : undefined}>
        <SidePanelHeader actions={<SidePanelClose />}>
          <SidePanelTitle>{titleLabel}</SidePanelTitle>
        </SidePanelHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <SidePanelBody className="space-y-4 overflow-y-auto">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Titolo *</label>
              <Input
                className="min-h-11 rounded-lg border-border"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Titolo attività"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Tipo di attività *</label>
                <Select value={activityType} onValueChange={(v) => setActivityType(v as NonNullable<CalendarEvent["activityType"]>)}>
                  <SelectTrigger className="min-h-11 rounded-lg border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALENDAR_ACTIVITY_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ACTIVITY_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">Status</label>
                <Select value={activityStatus} onValueChange={(v) => setActivityStatus(v as NonNullable<CalendarEvent["activityStatus"]>)}>
                  <SelectTrigger className="min-h-11 rounded-lg border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CALENDAR_ACTIVITY_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ACTIVITY_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Esito (opzionale)</label>
              <Select value={outcome} onValueChange={setOutcome}>
                <SelectTrigger className="min-h-11 rounded-lg border-border">
                  <SelectValue placeholder="Esito" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">—</SelectItem>
                  {CALENDAR_OUTCOMES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {OUTCOME_LABELS[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Vendor / assegnatario *</label>
              {canAssignAny ? (
                <Select value={assignedUserId} onValueChange={(v) => setAssignedUserId(v)} required>
                  <SelectTrigger className="min-h-11 rounded-lg border-border">
                    <SelectValue placeholder="Seleziona utente" />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaceUsers.map((u) => (
                      <SelectItem key={u.userId} value={u.userId.toLowerCase()}>
                        {u.userId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input className="min-h-11 rounded-lg border-border bg-muted" value={assignedUserId || currentUserEmail} readOnly disabled />
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Canale (report)</label>
              <Select value={source} onValueChange={(v) => setSource(v as CalendarEvent["source"])}>
                <SelectTrigger className="min-h-11 rounded-lg border-border">
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

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Inizio</label>
              <DatetimeField
                idPrefix="event-start"
                value={startsAt}
                disabled={allDay}
                onChange={(nextStart) => {
                  setStartsAt(nextStart);
                  const startM = moment(nextStart);
                  const endM = moment(endsAt);
                  if (!allDay && (!endM.isValid() || endM.isSameOrBefore(startM))) {
                    setEndsAt(startM.clone().add(1, "hour").format("YYYY-MM-DDTHH:mm"));
                  }
                }}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Fine</label>
              <DatetimeField
                idPrefix="event-end"
                value={endsAt}
                disabled={allDay}
                min={startsAt}
                onChange={(v) => setEndsAt(v)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="allDay" checked={allDay} onCheckedChange={(c) => setAllDay(c === true)} />
              <label htmlFor="allDay" className="text-sm font-medium leading-none">
                Tutto il giorno
              </label>
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
                  <SelectTrigger className="min-h-11 rounded-lg border-border">
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
              <p className="mb-1.5 text-sm font-medium text-foreground">Appartamenti (opzionale)</p>
              <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-border p-2">
                {apartmentOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Nessun appartamento caricato per questo progetto.</p>
                ) : (
                  apartmentOptions.map((a) => (
                    <label key={a._id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={apartmentIds.includes(a._id)}
                        onCheckedChange={() => toggleApartment(a._id)}
                      />
                      <span>
                        {a.code} — {a.name}
                      </span>
                    </label>
                  ))
                )}
              </div>
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
                <Select value={clientId || "__none__"} onValueChange={(v) => setClientId(v === "__none__" ? "" : v)}>
                  <SelectTrigger className="min-h-11 rounded-lg border-border">
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
              <label className="mb-1.5 block text-sm font-medium text-foreground">Note interne (max 2000)</label>
              <Textarea
                className="min-h-[72px] rounded-lg border-border"
                value={notesInternal}
                onChange={(e) => setNotesInternal(e.target.value.slice(0, 2000))}
                placeholder="Non visibili al cliente"
              />
              <p className="mt-1 text-xs text-muted-foreground">{notesInternal.length}/2000</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Note visibili al cliente (max 2000)</label>
              <Textarea
                className="min-h-[72px] rounded-lg border-border"
                value={notesClientVisible}
                onChange={(e) => setNotesClientVisible(e.target.value.slice(0, 2000))}
              />
              <p className="mt-1 text-xs text-muted-foreground">{notesClientVisible.length}/2000</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Informazioni aggiuntive</label>
              <Textarea
                className="min-h-[56px] rounded-lg border-border"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value.slice(0, 4000))}
              />
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id="notify"
                checked={notifyClientOnActivityUpdate}
                onCheckedChange={(c) => setNotifyClientOnActivityUpdate(c === true)}
              />
              <label htmlFor="notify" className="text-sm leading-snug text-foreground">
                Invia aggiornamenti attività al cliente (quando il canale email sarà collegato).
              </label>
            </div>

            {noScopeMessage && mode === "create" && !readOnlyClientAndProject && (
              <p className="text-sm text-amber-600">{noScopeMessage}</p>
            )}
            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </SidePanelBody>
          <SidePanelFooter>
            <Button type="button" variant="outline" onClick={onClose} className="min-h-11">
              Annulla
            </Button>
            <Button type="submit" disabled={saving || (mode === "create" && !canCreate)} className="min-h-11">
              {saving ? "Salvataggio..." : SUBMIT_LABEL[mode]}
            </Button>
          </SidePanelFooter>
        </form>
      </SidePanelContent>
    </SidePanel>
  );
};
