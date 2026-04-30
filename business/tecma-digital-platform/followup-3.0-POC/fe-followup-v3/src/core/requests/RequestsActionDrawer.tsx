import { useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { RequestRow, RequestActionRow, RequestActionType } from "../../types/domain";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { ACTION_TYPE_LABEL } from "./requestsPageConstants";

export interface RequestsActionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  editingAction: RequestActionRow | null;
  initialRequestIds: string[];
  requests: RequestRow[];
  workspaceId: string | undefined;
  onSaved: () => void;
  isMobile?: boolean;
}

export function RequestsActionDrawer({
  open,
  onOpenChange,
  mode,
  editingAction,
  initialRequestIds,
  requests,
  workspaceId,
  onSaved,
  isMobile = false,
}: RequestsActionDrawerProps): JSX.Element {
  const [actionFormType, setActionFormType] = useState<RequestActionType>("note");
  const [actionFormTitle, setActionFormTitle] = useState("");
  const [actionFormDescription, setActionFormDescription] = useState("");
  const [actionFormRequestIds, setActionFormRequestIds] = useState<string[]>([]);
  const [actionFormSaving, setActionFormSaving] = useState(false);
  const [actionFormError, setActionFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActionFormError(null);
    if (mode === "edit" && editingAction) {
      setActionFormType(editingAction.type);
      setActionFormTitle(editingAction.title ?? "");
      setActionFormDescription(editingAction.description ?? "");
      setActionFormRequestIds([...editingAction.requestIds]);
    } else {
      setActionFormType("note");
      setActionFormTitle("");
      setActionFormDescription("");
      setActionFormRequestIds([...initialRequestIds]);
    }
  }, [open, mode, editingAction, initialRequestIds]);

  function addRequestIdToActionForm(requestId: string): void {
    if (!actionFormRequestIds.includes(requestId)) {
      setActionFormRequestIds((prev) => [...prev, requestId]);
    }
  }

  function removeRequestIdFromActionForm(requestId: string): void {
    if (actionFormRequestIds.length <= 1) return;
    setActionFormRequestIds((prev) => prev.filter((id) => id !== requestId));
  }

  async function handleActionFormSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!workspaceId) return;
    if (actionFormRequestIds.length === 0) {
      setActionFormError("Seleziona almeno una trattativa.");
      return;
    }
    setActionFormError(null);
    setActionFormSaving(true);
    try {
      if (mode === "edit" && editingAction) {
        await followupApi.requests.updateRequestAction(editingAction._id, {
          type: actionFormType,
          title: actionFormTitle.trim() || undefined,
          description: actionFormDescription.trim() || undefined,
          requestIds: actionFormRequestIds,
        });
      } else {
        await followupApi.requests.createRequestAction({
          workspaceId,
          requestIds: actionFormRequestIds,
          type: actionFormType,
          title: actionFormTitle.trim() || undefined,
          description: actionFormDescription.trim() || undefined,
        });
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setActionFormError(err instanceof Error ? err.message : "Errore nel salvataggio.");
    } finally {
      setActionFormSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent side="right" size={isMobile ? "full" : "md"}>
        <DrawerHeader actions={<DrawerCloseButton />}>
          <DrawerTitle>{mode === "edit" ? "Modifica azione" : "Nuova azione"}</DrawerTitle>
        </DrawerHeader>
        <form onSubmit={handleActionFormSubmit} id="action-form">
          <DrawerBody className="space-y-4">
            {actionFormError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{actionFormError}</p>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Tipo</label>
              <Select value={actionFormType} onValueChange={(v) => setActionFormType(v as RequestActionType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ACTION_TYPE_LABEL) as [RequestActionType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Titolo (opzionale)</label>
              <Input
                className="w-full"
                value={actionFormTitle}
                onChange={(e) => setActionFormTitle(e.target.value)}
                placeholder="Es. Chiamata di follow-up"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Descrizione (opzionale)</label>
              <Textarea
                className="min-h-[80px] w-full"
                value={actionFormDescription}
                onChange={(e) => setActionFormDescription(e.target.value)}
                placeholder="Note..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">Trattative collegate</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {actionFormRequestIds.map((rid) => {
                  const req = requests.find((r) => r._id === rid);
                  return (
                    <span
                      key={rid}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs"
                    >
                      {req?.clientName ?? req?.clientId ?? rid.slice(0, 8)}
                      <button
                        type="button"
                        className="rounded hover:bg-muted"
                        onClick={() => removeRequestIdFromActionForm(rid)}
                        disabled={actionFormRequestIds.length <= 1}
                        aria-label="Rimuovi"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
              <Select
                value="_add"
                onValueChange={(v) => {
                  if (v && v !== "_add") addRequestIdToActionForm(v);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Aggiungi trattativa..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_add" disabled>
                    Aggiungi trattativa...
                  </SelectItem>
                  {requests
                    .filter((r) => !actionFormRequestIds.includes(r._id))
                    .map((r) => (
                      <SelectItem key={r._id} value={r._id}>
                        {r.clientName ?? r.clientId} — {r.apartmentCode ?? "—"}
                      </SelectItem>
                    ))}
                  {requests.filter((r) => !actionFormRequestIds.includes(r._id)).length === 0 && (
                    <SelectItem value="_none" disabled>
                      Tutte le trattative della pagina già collegate
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
              Annulla
            </Button>
            <Button type="submit" form="action-form" disabled={actionFormSaving} className="min-h-11">
              {actionFormSaving ? "Salvataggio..." : mode === "edit" ? "Salva" : "Crea azione"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
