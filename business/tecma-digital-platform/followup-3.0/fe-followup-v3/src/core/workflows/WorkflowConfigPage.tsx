import { useCallback, useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import type {
  WorkflowRow,
  WorkflowStateRow,
  WorkflowTransitionRow,
  WorkflowType,
  ApartmentLockType,
  WorkspaceRow,
} from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs";

const WORKFLOW_TYPE_LABEL: Record<WorkflowType, string> = {
  sell: "Vendita",
  rent: "Affitto",
  custom: "Personalizzato",
};

const LOCK_LABEL: Record<ApartmentLockType, string> = {
  none: "Nessuno",
  soft: "Blocco temporaneo",
  hard: "Blocco definitivo",
};

export const WorkflowConfigPage = () => {
  const { workspaceId, isAdmin } = useWorkspace();
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  /** Workspace usato per elenco e creazione workflow (admin può scegliere un altro). */
  const [selectedWorkspaceForConfig, setSelectedWorkspaceForConfig] = useState<string>(workspaceId);
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Id del workflow aperto nel drawer Stati/Transizioni. */
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    workflow: WorkflowRow;
    states: WorkflowStateRow[];
    transitions: WorkflowTransitionRow[];
  } | null>(null);
  const [detailTab, setDetailTab] = useState<"stati" | "transizioni">("stati");
  const [createName, setCreateName] = useState("");
  const [createType, setCreateType] = useState<WorkflowType>("sell");
  const [creating, setCreating] = useState(false);
  const [addStateOpen, setAddStateOpen] = useState(false);
  const [addTransOpen, setAddTransOpen] = useState(false);
  const [newStateCode, setNewStateCode] = useState("");
  const [newStateLabel, setNewStateLabel] = useState("");
  const [newStateOrder, setNewStateOrder] = useState(0);
  const [newStateTerminal, setNewStateTerminal] = useState(false);
  const [newStateReversible, setNewStateReversible] = useState(true);
  const [newStateLock, setNewStateLock] = useState<ApartmentLockType>("none");
  const [addingState, setAddingState] = useState(false);
  const [newTransFrom, setNewTransFrom] = useState("");
  const [newTransTo, setNewTransTo] = useState("");
  const [addingTrans, setAddingTrans] = useState(false);

  const effectiveWorkspaceId = selectedWorkspaceForConfig || workspaceId;
  const currentWorkspaceName = workspaces.find((w) => w._id === workspaceId)?.name ?? workspaceId;
  const selectedWorkspaceName = workspaces.find((w) => w._id === effectiveWorkspaceId)?.name ?? effectiveWorkspaceId;

  useEffect(() => {
    followupApi.listWorkspaces().then(setWorkspaces).catch(() => setWorkspaces([]));
  }, []);

  useEffect(() => {
    setSelectedWorkspaceForConfig((prev) => (workspaceId && prev === "" ? workspaceId : prev));
  }, [workspaceId]);

  const loadWorkflows = useCallback(() => {
    if (!effectiveWorkspaceId) return;
    setLoading(true);
    setError(null);
    followupApi
      .listWorkflowsByWorkspace(effectiveWorkspaceId)
      .then((res) => setWorkflows(res.workflows ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Errore caricamento workflow"))
      .finally(() => setLoading(false));
  }, [effectiveWorkspaceId]);

  useEffect(() => {
    if (effectiveWorkspaceId) loadWorkflows();
  }, [effectiveWorkspaceId, loadWorkflows]);

  const loadDetail = useCallback((workflowId: string) => {
    followupApi.getWorkflowWithStatesAndTransitions(workflowId).then((d) => setDetail(d));
  }, []);

  const handleCreateWorkflow = useCallback(() => {
    if (!effectiveWorkspaceId || !createName.trim()) return;
    setCreating(true);
    followupApi
      .createWorkflow({ workspaceId: effectiveWorkspaceId, name: createName.trim(), type: createType })
      .then(() => {
        setCreateName("");
        setCreateType("sell");
        loadWorkflows();
      })
      .catch((e) => window.alert(e instanceof Error ? e.message : "Errore creazione workflow"))
      .finally(() => setCreating(false));
  }, [effectiveWorkspaceId, createName, createType, loadWorkflows]);

  const openDetail = useCallback((wfId: string) => {
    setEditingWorkflowId(wfId);
    setDetailTab("stati");
    loadDetail(wfId);
  }, [loadDetail]);

  const closeDetail = useCallback(() => {
    setEditingWorkflowId(null);
    setDetail(null);
    setAddStateOpen(false);
    setAddTransOpen(false);
  }, []);

  const openAddStateModal = useCallback(() => {
    if (detail) {
      setNewStateOrder(detail.states.length);
      setNewStateCode("");
      setNewStateLabel("");
      setNewStateTerminal(false);
      setNewStateReversible(true);
      setNewStateLock("none");
      setAddStateOpen(true);
    }
  }, [detail]);

  const openAddTransModal = useCallback(() => {
    setNewTransFrom("");
    setNewTransTo("");
    setAddTransOpen(true);
  }, []);

  const handleAddState = useCallback(() => {
    if (!detail || !newStateCode.trim()) return;
    setAddingState(true);
    followupApi
      .createWorkflowState({
        workflowId: detail.workflow._id,
        code: newStateCode.trim(),
        label: newStateLabel.trim() || newStateCode.trim(),
        order: newStateOrder,
        terminal: newStateTerminal,
        reversible: newStateReversible,
        apartmentLock: newStateLock,
      })
      .then(() => {
        setNewStateCode("");
        setNewStateLabel("");
        setNewStateOrder(detail.states.length);
        setAddStateOpen(false);
        loadDetail(detail.workflow._id);
      })
      .catch((e) => window.alert(e instanceof Error ? e.message : "Errore aggiunta stato"))
      .finally(() => setAddingState(false));
  }, [detail, newStateCode, newStateLabel, newStateOrder, newStateTerminal, newStateReversible, newStateLock, loadDetail]);

  const handleAddTransition = useCallback(() => {
    if (!detail || !newTransFrom || !newTransTo) return;
    setAddingTrans(true);
    followupApi
      .createWorkflowTransition({
        workflowId: detail.workflow._id,
        fromStateId: newTransFrom,
        toStateId: newTransTo,
      })
      .then(() => {
        setNewTransFrom("");
        setNewTransTo("");
        setAddTransOpen(false);
        loadDetail(detail.workflow._id);
      })
      .catch((e) => window.alert(e instanceof Error ? e.message : "Errore aggiunta transizione"))
      .finally(() => setAddingTrans(false));
  }, [detail, newTransFrom, newTransTo, loadDetail]);

  if (!workspaceId) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Seleziona un workspace per configurare i workflow.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Solo gli amministratori possono configurare i workflow.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Configurazione workflow</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Crea workflow per tipo (Vendita, Affitto) e definisci stati e transizioni. Usati per validare le transizioni delle trattative e i lock sugli appartamenti.
        </p>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-sm font-medium text-foreground">Workspace:</span>
          <span className="text-sm text-muted-foreground">{currentWorkspaceName}</span>
          {isAdmin && workspaces.length > 0 && (
            <>
              <span className="text-xs text-muted-foreground">|</span>
              <label className="text-xs text-muted-foreground">Workflow per:</label>
              <Select
                value={effectiveWorkspaceId}
                onValueChange={(v) => setSelectedWorkspaceForConfig(v)}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleziona workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((w) => (
                    <SelectItem key={w._id} value={w._id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Nuovo workflow</h2>
        <p className="text-xs text-muted-foreground mb-2">Creato per: {selectedWorkspaceName}</p>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Nome</label>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="es. Vendita standard"
              className="w-48"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Tipo</label>
            <Select value={createType} onValueChange={(v) => setCreateType(v as WorkflowType)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sell">{WORKFLOW_TYPE_LABEL.sell}</SelectItem>
                <SelectItem value="rent">{WORKFLOW_TYPE_LABEL.rent}</SelectItem>
                <SelectItem value="custom">{WORKFLOW_TYPE_LABEL.custom}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreateWorkflow} disabled={creating || !createName.trim()} size="sm">
            {creating ? "Creazione..." : "Crea workflow"}
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-foreground">Workflow del workspace ({selectedWorkspaceName})</h2>
          <Button onClick={loadWorkflows} variant="outline" size="sm">
            Ricarica
          </Button>
        </div>
        {loading ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : workflows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun workflow per questo workspace. Creane uno sopra.</p>
        ) : (
          <ul className="space-y-2">
            {workflows.map((wf) => (
              <li key={wf._id} className="rounded-lg border border-border bg-muted/20 flex items-center justify-between px-3 py-2">
                <span className="font-medium text-foreground">{wf.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{WORKFLOW_TYPE_LABEL[wf.type]}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => openDetail(wf._id)}>
                    Stati e transizioni
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Sheet open={!!editingWorkflowId} onOpenChange={(open) => !open && closeDetail()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Dettaglio workflow {detail?.workflow.name ?? ""}</SheetTitle>
          </SheetHeader>
          {detail && (
            <Tabs value={detailTab} onValueChange={(v) => setDetailTab(v as "stati" | "transizioni")} className="mt-4">
              <TabsList>
                <TabsTrigger value="stati">Stati ({detail.states.length})</TabsTrigger>
                <TabsTrigger value="transizioni">Transizioni ({detail.transitions.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="stati" className="mt-4 space-y-3">
                {detail.states.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessuno stato. Aggiungine uno.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {[...detail.states].sort((a, b) => a.order - b.order).map((s) => (
                      <li key={s._id} className="rounded-md border border-border px-2 py-1 text-xs bg-muted/30">
                        {s.label} ({s.code}) {s.terminal && "· terminale"} {s.apartmentLock !== "none" && `· lock ${s.apartmentLock}`}
                      </li>
                    ))}
                  </ul>
                )}
                <Button type="button" variant="outline" size="sm" onClick={openAddStateModal}>
                  Aggiungi stato
                </Button>
              </TabsContent>
              <TabsContent value="transizioni" className="mt-4 space-y-3">
                {detail.transitions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessuna transizione. Aggiungine una (dopo almeno due stati).</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {detail.transitions.map((t) => {
                      const from = detail.states.find((s) => s._id === t.fromStateId);
                      const to = detail.states.find((s) => s._id === t.toStateId);
                      return (
                        <li key={t._id} className="text-sm text-muted-foreground">
                          {from?.code} → {to?.code}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <Button type="button" variant="outline" size="sm" onClick={openAddTransModal} disabled={detail.states.length < 2}>
                  Aggiungi transizione
                </Button>
              </TabsContent>
            </Tabs>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={addStateOpen} onOpenChange={setAddStateOpen}>
        <DialogContent size="small" className="gap-4">
          <DialogHeader>
            <DialogTitle>Aggiungi stato</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Code</label>
              <Input value={newStateCode} onChange={(e) => setNewStateCode(e.target.value)} placeholder="es. in_lavorazione" className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Label</label>
              <Input value={newStateLabel} onChange={(e) => setNewStateLabel(e.target.value)} placeholder="In lavorazione" className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Ordine</label>
              <Input type="number" value={newStateOrder} onChange={(e) => setNewStateOrder(Number(e.target.value) || 0)} className="w-full" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Lock appartamento</label>
              <Select value={newStateLock} onValueChange={(v) => setNewStateLock(v as ApartmentLockType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["none", "soft", "hard"] as const).map((x) => (
                    <SelectItem key={x} value={x}>{LOCK_LABEL[x]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newStateTerminal} onChange={(e) => setNewStateTerminal(e.target.checked)} />
              Terminale
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={newStateReversible} onChange={(e) => setNewStateReversible(e.target.checked)} />
              Reversibile
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddStateOpen(false)}>Annulla</Button>
            <Button size="sm" onClick={handleAddState} disabled={addingState || !newStateCode.trim()}>
              {addingState ? "..." : "Aggiungi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={addTransOpen} onOpenChange={setAddTransOpen}>
        <DialogContent size="small" className="gap-4">
          <DialogHeader>
            <DialogTitle>Aggiungi transizione</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="grid gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Da stato</label>
                <Select value={newTransFrom} onValueChange={setNewTransFrom}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {detail.states.map((s) => (
                      <SelectItem key={s._id} value={s._id}>{s.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">A stato</label>
                <Select value={newTransTo} onValueChange={setNewTransTo}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona" />
                  </SelectTrigger>
                  <SelectContent>
                    {detail.states.map((s) => (
                      <SelectItem key={s._id} value={s._id}>{s.code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddTransOpen(false)}>Annulla</Button>
            <Button size="sm" onClick={handleAddTransition} disabled={addingTrans || !newTransFrom || !newTransTo}>
              {addingTrans ? "..." : "Aggiungi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
