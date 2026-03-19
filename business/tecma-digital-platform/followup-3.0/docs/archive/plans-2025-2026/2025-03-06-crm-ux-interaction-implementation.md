# CRM UX Interaction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implementare toggle card/tabella, edit inline e wizard creazione su Clienti, Appartamenti, Progetti e Trattative, secondo il design in `docs/plans/2025-03-06-crm-ux-interaction-design.md`.

**Architecture:** Componente `ViewModeToggle` con persistenza localStorage; componente `EditableField` per edit inline; wizard step-by-step per creazione; vista card come griglia `glass-panel`; pattern unificato su tutte le pagine lista.

**Tech Stack:** React, Tailwind, shadcn/ui, design system (glass-panel, rounded-ui, token).

---

## Task 1: ViewModeToggle component

**Files:**
- Create: `fe-followup-v3/src/core/shared/ViewModeToggle.tsx`
- Modify: (nessuno)

**Step 1: Creare il componente**

```tsx
// ViewModeToggle.tsx
import { LayoutGrid, List } from "lucide-react";
import { cn } from "../../lib/utils";

export type ViewMode = "card" | "table";

interface ViewModeToggleProps {
  value: ViewMode;
  onValueChange: (v: ViewMode) => void;
  storageKey?: string;
  className?: string;
}

const STORAGE_PREFIX = "crm-view-mode-";

export function ViewModeToggle({ value, onValueChange, storageKey, className }: ViewModeToggleProps) {
  const handleChange = (v: ViewMode) => {
    onValueChange(v);
    if (storageKey) {
      try {
        localStorage.setItem(STORAGE_PREFIX + storageKey, v);
      } catch {}
    }
  };

  return (
    <div className={cn("flex rounded-lg border border-border bg-muted/30 p-0.5", className)} role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={value === "card"}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          value === "card" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => handleChange("card")}
      >
        <LayoutGrid className="h-4 w-4" />
        Card
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "table"}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          value === "table" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => handleChange("table")}
      >
        <List className="h-4 w-4" />
        Tabella
      </button>
    </div>
  );
}

export function loadViewModeFromStorage(storageKey: string, fallback: ViewMode = "table"): ViewMode {
  try {
    const v = localStorage.getItem(STORAGE_PREFIX + storageKey);
    if (v === "card" || v === "table") return v;
  } catch {}
  return fallback;
}
```

**Step 2: Verificare che il file compili**

Run: `cd fe-followup-v3 && npm run build` (o `pnpm build`)
Expected: build OK

**Step 3: Commit**

```bash
git add fe-followup-v3/src/core/shared/ViewModeToggle.tsx
git commit -m "feat(ux): add ViewModeToggle component for card/table switch"
```

---

## Task 2: ClientsPage - toggle e vista card

**Files:**
- Modify: `fe-followup-v3/src/core/clients/ClientsPage.tsx`

**Step 1: Aggiungere import e stato**

Aggiungere in cima:
```tsx
import { ViewModeToggle, loadViewModeFromStorage, type ViewMode } from "../shared/ViewModeToggle";
```

Aggiungere stato (dopo `tableType`):
```tsx
const [viewMode, setViewMode] = useState<ViewMode>(() =>
  loadViewModeFromStorage("clients", "table")
);
```

**Step 2: Aggiungere ViewModeToggle nella toolbar**

Nella sezione "Tipologia tabella + Ricerca e filtri", accanto al Select "Tipologia tabella", aggiungere:
```tsx
<ViewModeToggle
  value={viewMode}
  onValueChange={(v) => { setViewMode(v); setPage(1); }}
  storageKey="clients"
  className="shrink-0"
/>
```

Posizionare nel flex: dopo il Select tipologia, prima della ricerca. Layout: `flex items-end gap-3` con ViewModeToggle.

**Step 3: Creare vista card**

Sostituire il blocco che renderizza solo la tabella con un condizionale:
- Se `viewMode === "table"`: renderizzare la tabella esistente.
- Se `viewMode === "card"`: renderizzare una griglia di card.

Griglia card:
```tsx
{viewMode === "card" && (
  <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
    {isLoading && clients.length === 0 ? (
      <p className="col-span-full py-16 text-center text-sm text-muted-foreground">Caricamento...</p>
    ) : clients.length === 0 ? (
      <p className="col-span-full py-16 text-center text-sm text-muted-foreground">
        {committedSearch ? "Nessun risultato" : "Nessun cliente"}
      </p>
    ) : (
      clients.map((client) => (
        <div
          key={client._id}
          role="button"
          tabIndex={0}
          className="glass-panel rounded-ui flex cursor-pointer flex-col gap-2 border border-border p-4 transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring"
          onClick={() => navigate(`/clients/${client._id}`)}
          onKeyDown={(e) => e.key === "Enter" && navigate(`/clients/${client._id}`)}
        >
          <div className="font-medium text-foreground">{client.fullName ?? "—"}</div>
          <div className="text-sm text-muted-foreground">{client.email ?? "—"}</div>
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-xs">{statusLabel(client.status)}</Badge>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); /* apri menu */ }}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))
    )}
  </div>
)}
```

Verificare che `Badge` sia importato. Il menu "altre opzioni" sulla card può aprire lo stesso dropdown della riga tabella (modifica, elimina, ecc.) — per ora si può semplificare con solo navigazione al dettaglio.

**Step 4: Test manuale**

Aprire ClientsPage, verificare toggle Card/Tabella, persistenza dopo refresh.

**Step 5: Commit**

```bash
git add fe-followup-v3/src/core/clients/ClientsPage.tsx
git commit -m "feat(ux): ClientsPage toggle card/table and card grid view"
```

---

## Task 3: EditableField component

**Files:**
- Create: `fe-followup-v3/src/core/shared/EditableField.tsx`

**Step 1: Creare il componente**

```tsx
import { useState, useRef, useEffect } from "react";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { cn } from "../../lib/utils";

interface EditableFieldTextProps {
  value: string;
  onSave: (v: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EditableFieldText({ value, onSave, placeholder, className, disabled }: EditableFieldTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    const trimmed = draft.trim();
    if (trimmed !== value) {
      await onSave(trimmed);
    }
    setEditing(false);
    setDraft(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  };

  if (editing && !disabled) {
    return (
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        className={cn("h-8 text-sm", className)}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "w-full rounded px-1.5 py-0.5 text-left text-sm hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring",
        !value && "text-muted-foreground italic",
        className
      )}
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
    >
      {value || placeholder || "—"}
    </button>
  );
}

interface EditableFieldSelectProps {
  value: string;
  onSave: (v: string) => void | Promise<void>;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function EditableFieldSelect({
  value,
  onSave,
  options,
  placeholder,
  className,
  disabled,
}: EditableFieldSelectProps) {
  const [editing, setEditing] = useState(false);

  const handleSave = (v: string) => {
    if (v !== value) onSave(v);
    setEditing(false);
  };

  if (editing && !disabled) {
    return (
      <Select value={value} onValueChange={handleSave} onOpenChange={setEditing}>
        <SelectTrigger className={cn("h-8 text-sm", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const label = options.find((o) => o.value === value)?.label ?? value ?? placeholder ?? "—";
  return (
    <button
      type="button"
      className={cn(
        "w-full rounded px-1.5 py-0.5 text-left text-sm hover:bg-muted/50 focus:outline-none focus:ring-1 focus:ring-ring",
        !value && "text-muted-foreground italic",
        className
      )}
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
    >
      {label}
    </button>
  );
}
```

**Step 2: Verificare build**

Run: `cd fe-followup-v3 && npm run build`

**Step 3: Commit**

```bash
git add fe-followup-v3/src/core/shared/EditableField.tsx
git commit -m "feat(ux): add EditableField component for inline editing"
```

---

## Task 4: ClientsPage - edit inline su tabella

**Files:**
- Modify: `fe-followup-v3/src/core/clients/ClientsPage.tsx`

**Step 1: Import EditableField e clientsApi**

Aggiungere:
```tsx
import { EditableFieldText, EditableFieldSelect } from "../shared/EditableField";
```

**Step 2: Handler per update inline**

Aggiungere funzione:
```tsx
const handleInlineUpdate = async (clientId: string, field: keyof Pick<ClientRow, "fullName" | "email" | "phone" | "status">, value: string) => {
  try {
    await clientsApi.updateClient(clientId, { [field]: value || undefined } as Partial<ClientRow>);
    refetch();
  } catch (err) {
    toastError?.(err instanceof Error ? err.message : "Errore aggiornamento");
  }
};
```

Verificare che `useToast` sia usato (toastError).

**Step 3: Sostituire celle tabella con EditableField**

Nelle celle Nome, Email, Telefono, Stato della tabella: usare `EditableFieldText` o `EditableFieldSelect` al posto del testo statico. Per Stato usare `EditableFieldSelect` con `STATUS_FILTER_OPTIONS` (filtrando "all" se presente).

Esempio cella Nome:
```tsx
<td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
  <EditableFieldText
    value={client.fullName ?? ""}
    onSave={(v) => handleInlineUpdate(client._id, "fullName", v)}
    placeholder="Nome"
  />
</td>
```

Attenzione: `onClick` sulla riga naviga al dettaglio. Su celle editabili usare `stopPropagation` per evitare navigazione quando si clicca per editare.

**Step 4: Test manuale**

Modificare nome/email/stato inline, verificare salvataggio e refetch.

**Step 5: Commit**

```bash
git add fe-followup-v3/src/core/clients/ClientsPage.tsx
git commit -m "feat(ux): ClientsPage inline edit for name, email, phone, status"
```

---

## Task 5: ClientsPage - edit inline su card

**Files:**
- Modify: `fe-followup-v3/src/core/clients/ClientsPage.tsx`

**Step 1: Usare EditableField nelle card**

Nella vista card, sostituire i testi statici con `EditableFieldText`/`EditableFieldSelect`, con `stopPropagation` sul click della card per evitare conflitto. La card deve avere `onClick` che naviga solo se il click non è su un campo editabile.

Soluzione: wrappare i campi editabili in un `div` con `onClick={(e) => e.stopPropagation()}`. Il click sulla card (area non editabile) naviga al dettaglio.

**Step 2: Commit**

```bash
git add fe-followup-v3/src/core/clients/ClientsPage.tsx
git commit -m "feat(ux): ClientsPage inline edit on card view"
```

---

## Task 6: ClientsPage - wizard creazione

**Files:**
- Modify: `fe-followup-v3/src/core/clients/ClientsPage.tsx`

**Step 1: Sostituire Drawer form con wizard 2 step**

Nel Drawer "Crea cliente":
- Step 1: Nome (obbligatorio), Progetto (obbligatorio). Bottone "Avanti".
- Step 2: Email, Telefono, Stato, Città, AdditionalInfo. Bottone "Salva" e "Indietro".

State: `wizardStep` (1 | 2). Al submit step 1: `setWizardStep(2)`. Al submit step 2: chiamare `handleClientFormSubmit` e chiudere.

**Step 2: Test e commit**

```bash
git add fe-followup-v3/src/core/clients/ClientsPage.tsx
git commit -m "feat(ux): ClientsPage creation wizard 2 steps"
```

---

## Task 7: ApartmentsPage - toggle e vista card

**Files:**
- Modify: `fe-followup-v3/src/core/apartments/ApartmentsPage.tsx`

**Step 1: Aggiungere ViewModeToggle e vista card**

Stesso pattern di ClientsPage: import, stato con `loadViewModeFromStorage("apartments", "table")`, ViewModeToggle in toolbar, griglia card con `glass-panel` per ogni appartamento (codice, nome, piano, mq, prezzo, stato).

**Step 2: Commit**

```bash
git add fe-followup-v3/src/core/apartments/ApartmentsPage.tsx
git commit -m "feat(ux): ApartmentsPage toggle card/table and card grid"
```

---

## Task 8: ApartmentsPage - edit inline e wizard

**Files:**
- Modify: `fe-followup-v3/src/core/apartments/ApartmentsPage.tsx`

**Step 1: Edit inline** su codice, nome, prezzo, stato (tabella e card).

**Step 2: Wizard creazione** 2 step (Step 1: codice, nome, modalità; Step 2: prezzo, piano, mq, stato).

**Step 3: Commit**

```bash
git add fe-followup-v3/src/core/apartments/ApartmentsPage.tsx
git commit -m "feat(ux): ApartmentsPage inline edit and creation wizard"
```

---

## Task 9: ProjectsPage - toggle, card, edit inline

**Files:**
- Modify: `fe-followup-v3/src/core/projects/ProjectsPage.tsx`

**Step 1: ViewModeToggle, vista card, edit inline** su nome e modalità. ProjectsPage è più semplice (meno campi).

**Step 2: Commit**

```bash
git add fe-followup-v3/src/core/projects/ProjectsPage.tsx
git commit -m "feat(ux): ProjectsPage toggle card/table, card view, inline edit"
```

---

## Task 10: RequestsPage - toggle Card/Table nella vista Lista

**Files:**
- Modify: `fe-followup-v3/src/core/requests/RequestsPage.tsx`

**Step 1: Estendere viewMode**

Attualmente: `viewMode` è "list" | "kanban". Estendere a: "list" con sottovista "card" | "table". Oppure: tre tab "Lista" | "Card" | "Kanban".

Decisione design: tre tab "Tabella" | "Card" | "Kanban". "Tabella" e "Card" mostrano gli stessi dati in layout diverso; "Kanban" resta come ora.

Modificare `ViewMode` in `requestsPageConstants` o localmente a `"table" | "card" | "kanban"`. Aggiungere ViewModeToggle o Tabs a tre voci. Se viewMode === "kanban", mostrare kanban; altrimenti lista (table o card).

**Step 2: Vista card per trattative**

Griglia card con cliente, appartamento, tipo, stato, valore. Edit inline su stato.

**Step 3: Commit**

```bash
git add fe-followup-v3/src/core/requests/RequestsPage.tsx
git commit -m "feat(ux): RequestsPage table/card/kanban toggle and card view"
```

---

## Riepilogo

| Task | Descrizione |
|------|-------------|
| 1 | ViewModeToggle component |
| 2 | ClientsPage toggle + card |
| 3 | EditableField component |
| 4 | ClientsPage edit inline tabella |
| 5 | ClientsPage edit inline card |
| 6 | ClientsPage wizard creazione |
| 7 | ApartmentsPage toggle + card |
| 8 | ApartmentsPage edit inline + wizard |
| 9 | ProjectsPage toggle + card + edit |
| 10 | RequestsPage table/card/kanban |

---

## Note esecuzione

- Eseguire i task in ordine (dipendenze: Task 1 prima di 2, 3 prima di 4-5).
- Test manuale dopo ogni task.
- In caso di conflitti con codice esistente (es. ClientsPage ha già logica complessa), adattare mantenendo il pattern.
