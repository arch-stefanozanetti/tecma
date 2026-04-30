import { useCallback, useEffect, useState } from "react";
import { ClipboardList, Loader2, Trash2 } from "lucide-react";
import { followupApi } from "../../api/followupApi";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { cn } from "../../lib/utils";
import { formatDate } from "../../lib/formatDate";
import type { ApartmentRow, HandoverRow, UnitIssueRow, UnitIssueStatus } from "../../types/domain";

const ISSUE_STATUS_LABEL: Record<UnitIssueRow["status"], string> = {
  open: "Aperto",
  in_progress: "In lavorazione",
  resolved: "Risolto",
  closed: "Chiuso",
};

const PRIORITY_LABEL: Record<UnitIssueRow["priority"], string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
  critical: "Critica",
};

const HANDOVER_STATUS_LABEL: Record<HandoverRow["sessionStatus"], string> = {
  not_started: "Non avviata",
  in_progress: "In corso",
  completed: "Completata",
};

export interface ApartmentDetailPostVenditaTabProps {
  apartment: ApartmentRow;
  workspaceId: string;
  projectIds: string[];
  canRead: boolean;
  canUpdate: boolean;
}

export function ApartmentDetailPostVenditaTab({
  apartment,
  workspaceId,
  projectIds,
  canRead,
  canUpdate,
}: ApartmentDetailPostVenditaTabProps) {
  const projectId = apartment.projectId;
  const [issues, setIssues] = useState<UnitIssueRow[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  const [handover, setHandover] = useState<HandoverRow | null>(null);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverBusy, setHandoverBusy] = useState(false);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<UnitIssueRow["priority"]>("medium");
  const [createSaving, setCreateSaving] = useState(false);

  const loadIssues = useCallback(async () => {
    if (!workspaceId || !projectIds.length) return;
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const res = await followupApi.postDelivery.queryUnitIssues({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 100,
        filters: { apartmentId: apartment._id },
      });
      setIssues(res.data ?? []);
    } catch (e) {
      setIssuesError(e instanceof Error ? e.message : "Errore caricamento segnalazioni");
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }, [workspaceId, projectIds, apartment._id]);

  const loadHandover = useCallback(async () => {
    if (!workspaceId || !projectId) return;
    setHandoverLoading(true);
    try {
      const res = await followupApi.postDelivery.getHandoverForApartment(workspaceId, projectId, apartment._id);
      setHandover(res.handover);
    } catch {
      setHandover(null);
    } finally {
      setHandoverLoading(false);
    }
  }, [workspaceId, projectId, apartment._id]);

  useEffect(() => {
    if (!canRead) return;
    void loadIssues();
    void loadHandover();
  }, [canRead, loadIssues, loadHandover]);

  const handleCreateIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canUpdate || !newTitle.trim()) return;
    setCreateSaving(true);
    try {
      const { issue } = await followupApi.postDelivery.createUnitIssue({
        workspaceId,
        projectId,
        apartmentId: apartment._id,
        title: newTitle.trim(),
        description: newDescription.trim(),
        priority: newPriority,
      });
      setIssues((prev) => [issue, ...prev]);
      setNewTitle("");
      setNewDescription("");
      setNewPriority("medium");
    } finally {
      setCreateSaving(false);
    }
  };

  const patchIssueStatus = async (issue: UnitIssueRow, status: UnitIssueStatus) => {
    if (!canUpdate) return;
    try {
      const { issue: updated } = await followupApi.postDelivery.patchUnitIssue(issue._id, {
        workspaceId,
        projectId,
        status,
      });
      setIssues((prev) => prev.map((i) => (i._id === updated._id ? updated : i)));
    } catch {
      /* toast opzionale */
    }
  };

  const removeIssue = async (issue: UnitIssueRow) => {
    if (!canUpdate || !window.confirm("Eliminare questa segnalazione?")) return;
    try {
      await followupApi.postDelivery.deleteUnitIssue(issue._id, workspaceId, projectId);
      setIssues((prev) => prev.filter((i) => i._id !== issue._id));
    } catch {
      /* ignore */
    }
  };

  const ensureHandover = async () => {
    if (!canUpdate) return;
    setHandoverBusy(true);
    try {
      const { handover: h } = await followupApi.postDelivery.getOrCreateHandover({
        workspaceId,
        projectId,
        apartmentId: apartment._id,
      });
      setHandover(h);
    } finally {
      setHandoverBusy(false);
    }
  };

  const setSessionStatus = async (sessionStatus: HandoverRow["sessionStatus"]) => {
    if (!handover || !canUpdate) return;
    setHandoverBusy(true);
    try {
      const { handover: h } = await followupApi.postDelivery.patchHandover(handover._id, {
        workspaceId,
        projectId,
        sessionStatus,
      });
      setHandover(h);
    } finally {
      setHandoverBusy(false);
    }
  };

  const toggleChecklistItem = async (itemId: string, done: boolean) => {
    if (!handover || !canUpdate) return;
    setHandoverBusy(true);
    try {
      const nextStatus: HandoverRow["sessionStatus"] =
        handover.sessionStatus === "not_started" ? "in_progress" : handover.sessionStatus;
      const { handover: h } = await followupApi.postDelivery.patchHandover(handover._id, {
        workspaceId,
        projectId,
        sessionStatus: nextStatus,
        checklist: [{ itemId, done }],
      });
      setHandover(h);
    } finally {
      setHandoverBusy(false);
    }
  };

  if (!canRead) {
    return (
      <section className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">Non hai permessi per visualizzare il post-vendita.</p>
      </section>
    );
  }

  const openCount = issues.filter((i) => i.status === "open" || i.status === "in_progress").length;

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Difetti e reclami
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Segnalazioni su questa unità. Aperti o in lavorazione:{" "}
          <span className="font-medium text-foreground">{openCount}</span>
        </p>

        {issuesLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento...
          </p>
        ) : issuesError ? (
          <p className="text-sm text-destructive">{issuesError}</p>
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground mb-4">Nessuna segnalazione.</p>
        ) : (
          <ul className="space-y-3 mb-4">
            {issues.map((issue) => (
              <li
                key={issue._id}
                className="rounded-md border border-border/80 bg-muted/20 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{issue.title}</p>
                    {issue.description ? (
                      <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{issue.description}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-1">
                      {PRIORITY_LABEL[issue.priority]} · {formatDate(issue.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {canUpdate ? (
                      <>
                        <select
                          className={cn(
                            "h-8 rounded-md border border-input bg-background px-2 text-xs",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          )}
                          value={issue.status}
                          onChange={(ev) => void patchIssueStatus(issue, ev.target.value as UnitIssueStatus)}
                          aria-label="Stato segnalazione"
                        >
                          {(Object.keys(ISSUE_STATUS_LABEL) as UnitIssueRow["status"][]).map((s) => (
                            <option key={s} value={s}>
                              {ISSUE_STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => void removeIssue(issue)}
                          aria-label="Elimina segnalazione"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">{ISSUE_STATUS_LABEL[issue.status]}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {canUpdate ? (
          <form onSubmit={(e) => void handleCreateIssue(e)} className="space-y-3 border-t border-border pt-4">
            <p className="text-xs font-medium text-foreground">Nuova segnalazione</p>
            <Input
              placeholder="Titolo"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              className="max-w-md"
            />
            <textarea
              className={cn(
                "flex min-h-[72px] w-full max-w-lg rounded-md border border-input bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              )}
              placeholder="Descrizione (opzionale)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                Priorità
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as UnitIssueRow["priority"])}
                >
                  {(Object.keys(PRIORITY_LABEL) as UnitIssueRow["priority"][]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm" disabled={createSaving || !newTitle.trim()}>
                {createSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crea segnalazione"}
              </Button>
            </div>
          </form>
        ) : null}
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-1">Checklist consegna</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Verbale di consegna: voci standard per unità. Una sessione per appartamento.
        </p>

        {handoverLoading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Caricamento...
          </p>
        ) : !handover ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Nessuna sessione avviata per questa unità.</p>
            {canUpdate ? (
              <Button type="button" size="sm" onClick={() => void ensureHandover()} disabled={handoverBusy}>
                {handoverBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Avvia checklist"}
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Stato sessione:</span>
              <span className="font-medium">{HANDOVER_STATUS_LABEL[handover.sessionStatus]}</span>
              {canUpdate && handover.sessionStatus !== "completed" ? (
                <>
                  {handover.sessionStatus === "not_started" ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => void setSessionStatus("in_progress")} disabled={handoverBusy}>
                      Inizia
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void setSessionStatus("completed")}
                    disabled={handoverBusy}
                  >
                    Completa consegna
                  </Button>
                </>
              ) : null}
            </div>

            <ul className="space-y-2">
              {handover.checklist.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start gap-3 rounded-md border border-border/60 px-3 py-2"
                >
                  <label className="flex items-start gap-2 cursor-pointer flex-1 min-w-0">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-input"
                      checked={Boolean(item.doneAt)}
                      disabled={!canUpdate || handoverBusy || handover.sessionStatus === "completed"}
                      onChange={(ev) => void toggleChecklistItem(item.id, ev.target.checked)}
                    />
                    <span className="text-sm">
                      {item.label}
                      {item.required ? <span className="text-destructive"> *</span> : null}
                      {item.doneAt ? (
                        <span className="block text-xs text-muted-foreground mt-0.5">
                          OK · {formatDate(item.doneAt)}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
