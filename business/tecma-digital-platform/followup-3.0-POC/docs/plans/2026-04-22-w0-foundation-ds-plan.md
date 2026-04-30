# W0 — Foundation Design System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introdurre le primitive DS (`<Skeleton>`, `<EmptyState>`, `<DataTable>`, form helper) e fix fallback token, senza toccare i consumer. Serve come foundation sbloccante per W1-W3.

**Architecture:** I componenti vengono aggiunti come nuovi file in `fe-followup-v3/src/components/ui/` ed esportati via barrel `index.ts`. `<DataTable>` è costruito **sopra** il `table.tsx` esistente (composizione, non sostituzione) e usa `@tanstack/react-table` per logica headless (sort, selection, pagination server-side). `react-hook-form` viene introdotto come infrastruttura ma non applicato a form esistenti in W0. Nessun backend change. Nessun consumer applicativo modificato (solo una pagina demo `/dev/ds-preview`).

**Tech Stack:** React 18, TypeScript, Tailwind, Vitest, Playwright, `@tanstack/react-table` (nuova), `react-hook-form` (nuova), `zod` (già presente).

**Verification:** L1 — build pulito, typecheck pulito, unit test happy+edge per ogni primitiva, pagina demo funzionante, nessuna regressione visibile.

**Parent design:** `docs/plans/2026-04-22-followup3-go-live-design.md` § 2.

---

## Pre-flight

**Working directory:** `/Users/s.zanetti/dev/tecma/business/tecma-digital-platform/followup-3.0/`

**Comandi chiave:**
- `npm --prefix fe-followup-v3 run typecheck`
- `npm --prefix fe-followup-v3 run test:unit -- <path>`
- `npm --prefix fe-followup-v3 run build`

**Baseline:** verificare che il main build passi prima di iniziare: `npm --prefix fe-followup-v3 run build` → deve completare senza errori.

---

## Task 1 — Fix `tailwind.theme.fallback.js`

**Files:**
- Modify: `fe-followup-v3/tailwind.theme.fallback.js` (oggi tutti i campi vuoti)

**Perché:** in worktree/CI senza `@tecma/design-system-tokens` installato il sistema tipografico collassa silenziosamente.

**Step 1: leggere i token reali**

Run: `cat ../../design-system/tokens/typography.json 2>/dev/null || cat node_modules/@tecma/design-system-tokens/dist/*.json 2>/dev/null || echo "no tokens found, use safe defaults"`

**Step 2: popolare il fallback con valori safe**

Sostituire integralmente `tailwind.theme.fallback.js`:

```js
/**
 * Fallback statico per @tecma/design-system-tokens.
 * Usato quando il pacchetto non è installato (worktree isolati, CI light).
 * Valori allineati alla baseline del token package — se il package cambia,
 * aggiornare anche questo file.
 */
const fallbackTheme = {
  fontFamily: {
    sans: ["Inter", "system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
    mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "monospace"],
  },
  fontSize: {
    xs: ["0.75rem", { lineHeight: "1rem" }],
    sm: ["0.875rem", { lineHeight: "1.25rem" }],
    base: ["1rem", { lineHeight: "1.5rem" }],
    lg: ["1.125rem", { lineHeight: "1.75rem" }],
    xl: ["1.25rem", { lineHeight: "1.75rem" }],
    "2xl": ["1.5rem", { lineHeight: "2rem" }],
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
  lineHeight: {
    tight: "1.25",
    normal: "1.5",
    relaxed: "1.75",
  },
};

export default fallbackTheme;
```

**Step 3: verificare build**

Run: `npm --prefix fe-followup-v3 run build`
Expected: build completa senza warning di fallback vuoto.

**Step 4: commit**

```bash
git add fe-followup-v3/tailwind.theme.fallback.js
git commit -m "fix(fe-followup-v3): populate tailwind theme fallback to prevent silent collapse in CI/worktree"
```

---

## Task 2 — `<Skeleton>` atomo + test

**Files:**
- Create: `fe-followup-v3/src/components/ui/skeleton.tsx`
- Create: `fe-followup-v3/src/components/ui/skeleton.test.tsx`

**Step 1: test fallisce**

`fe-followup-v3/src/components/ui/skeleton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Skeleton } from "./skeleton";

describe("Skeleton", () => {
  it("renders with default styles", () => {
    render(<Skeleton data-testid="skel" />);
    const el = screen.getByTestId("skel");
    expect(el).toBeInTheDocument();
    expect(el.className).toContain("animate-pulse");
  });

  it("merges custom className", () => {
    render(<Skeleton data-testid="skel" className="h-8 w-32" />);
    const el = screen.getByTestId("skel");
    expect(el.className).toContain("h-8");
    expect(el.className).toContain("w-32");
    expect(el.className).toContain("animate-pulse");
  });

  it("forwards aria-hidden for decorative loading state", () => {
    render(<Skeleton data-testid="skel" />);
    expect(screen.getByTestId("skel")).toHaveAttribute("aria-hidden", "true");
  });
});
```

**Step 2: run test — fail atteso**

Run: `npm --prefix fe-followup-v3 run test:unit -- src/components/ui/skeleton.test.tsx`
Expected: FAIL "Cannot find module './skeleton'".

**Step 3: implementazione minimale**

`fe-followup-v3/src/components/ui/skeleton.tsx`:

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";

/**
 * Skeleton — placeholder animato durante loading.
 * Usare per evitare layout shift e "Caricamento..." testuale.
 */
export const Skeleton = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn("animate-pulse rounded-md bg-muted", className)}
    {...props}
  />
));
Skeleton.displayName = "Skeleton";
```

**Step 4: run test — pass**

Run: `npm --prefix fe-followup-v3 run test:unit -- src/components/ui/skeleton.test.tsx`
Expected: 3 passed.

**Step 5: commit**

```bash
git add fe-followup-v3/src/components/ui/skeleton.tsx fe-followup-v3/src/components/ui/skeleton.test.tsx
git commit -m "feat(fe-followup-v3): add Skeleton atom with animate-pulse + aria-hidden"
```

---

## Task 3 — Skeleton presets (`SkeletonTable`, `SkeletonCard`, `SkeletonList`)

**Files:**
- Modify: `fe-followup-v3/src/components/ui/skeleton.tsx`
- Modify: `fe-followup-v3/src/components/ui/skeleton.test.tsx`

**Step 1: aggiungere test per presets**

Append a `skeleton.test.tsx`:

```tsx
import { SkeletonTable, SkeletonCard, SkeletonList } from "./skeleton";

describe("SkeletonTable", () => {
  it("renders rows x cols cells", () => {
    const { container } = render(<SkeletonTable rows={3} cols={4} />);
    const cells = container.querySelectorAll('[data-testid="skel-cell"]');
    expect(cells.length).toBe(12);
  });

  it("renders a header row when showHeader is true", () => {
    const { container } = render(<SkeletonTable rows={2} cols={3} showHeader />);
    const headers = container.querySelectorAll('[data-testid="skel-header"]');
    expect(headers.length).toBe(3);
  });
});

describe("SkeletonCard", () => {
  it("renders title and content skeletons", () => {
    render(<SkeletonCard />);
    expect(screen.getByTestId("skel-card-title")).toBeInTheDocument();
    expect(screen.getByTestId("skel-card-content")).toBeInTheDocument();
  });
});

describe("SkeletonList", () => {
  it("renders N list items", () => {
    const { container } = render(<SkeletonList rows={5} />);
    const items = container.querySelectorAll('[data-testid="skel-list-item"]');
    expect(items.length).toBe(5);
  });
});
```

**Step 2: run — fail**

Run: `npm --prefix fe-followup-v3 run test:unit -- src/components/ui/skeleton.test.tsx`
Expected: 3 new tests FAIL.

**Step 3: implementazione presets**

Append a `skeleton.tsx`:

```tsx
export interface SkeletonTableProps {
  rows: number;
  cols: number;
  showHeader?: boolean;
  className?: string;
}

export function SkeletonTable({ rows, cols, showHeader, className }: SkeletonTableProps) {
  return (
    <div className={cn("w-full space-y-2", className)}>
      {showHeader && (
        <div className="flex gap-3 border-b pb-2">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={`h-${i}`} data-testid="skel-header" className="h-4 flex-1" />
          ))}
        </div>
      )}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`r-${r}`} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={`c-${r}-${c}`} data-testid="skel-cell" className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3 rounded-lg border p-4", className)}>
      <Skeleton data-testid="skel-card-title" className="h-5 w-1/3" />
      <Skeleton data-testid="skel-card-content" className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
    </div>
  );
}

export interface SkeletonListProps {
  rows: number;
  className?: string;
}

export function SkeletonList({ rows, className }: SkeletonListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} data-testid="skel-list-item" className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
```

**Step 4: run — pass**

Run: `npm --prefix fe-followup-v3 run test:unit -- src/components/ui/skeleton.test.tsx`
Expected: all passed.

**Step 5: export via barrel**

Modify `fe-followup-v3/src/components/ui/index.ts`: aggiungere dopo `export * from "./separator";`:

```ts
export * from "./skeleton";
```

**Step 6: typecheck**

Run: `npm --prefix fe-followup-v3 run typecheck`
Expected: no errors.

**Step 7: commit**

```bash
git add fe-followup-v3/src/components/ui/skeleton.tsx fe-followup-v3/src/components/ui/skeleton.test.tsx fe-followup-v3/src/components/ui/index.ts
git commit -m "feat(fe-followup-v3): add Skeleton presets (Table, Card, List) + barrel export"
```

---

## Task 4 — `<EmptyState>` + test

**Files:**
- Create: `fe-followup-v3/src/components/ui/empty-state.tsx`
- Create: `fe-followup-v3/src/components/ui/empty-state.test.tsx`

**Step 1: test fallisce**

`fe-followup-v3/src/components/ui/empty-state.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EmptyState } from "./empty-state";
import { Users } from "lucide-react";

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(<EmptyState title="Nessun cliente" description="Aggiungi il primo per iniziare" />);
    expect(screen.getByText("Nessun cliente")).toBeInTheDocument();
    expect(screen.getByText("Aggiungi il primo per iniziare")).toBeInTheDocument();
  });

  it("renders icon when provided", () => {
    render(<EmptyState icon={Users} title="Vuoto" />);
    expect(screen.getByTestId("empty-state-icon")).toBeInTheDocument();
  });

  it("renders action slot", () => {
    render(
      <EmptyState
        title="Vuoto"
        action={<button>Aggiungi</button>}
      />
    );
    expect(screen.getByRole("button", { name: "Aggiungi" })).toBeInTheDocument();
  });

  it("applies search variant styling", () => {
    render(<EmptyState title="Nessun risultato" variant="search" data-testid="es" />);
    const el = screen.getByTestId("es");
    expect(el.getAttribute("data-variant")).toBe("search");
  });

  it("applies error variant styling", () => {
    render(<EmptyState title="Errore" variant="error" data-testid="es" />);
    const el = screen.getByTestId("es");
    expect(el.getAttribute("data-variant")).toBe("error");
  });
});
```

**Step 2: run — fail**

Run: `npm --prefix fe-followup-v3 run test:unit -- src/components/ui/empty-state.test.tsx`
Expected: FAIL.

**Step 3: implementazione**

`fe-followup-v3/src/components/ui/empty-state.tsx`:

```tsx
import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export type EmptyStateVariant = "default" | "search" | "error";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variant?: EmptyStateVariant;
}

const variantIconClass: Record<EmptyStateVariant, string> = {
  default: "text-muted-foreground",
  search: "text-muted-foreground",
  error: "text-destructive",
};

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon, title, description, action, variant = "default", className, ...props }, ref) => (
    <div
      ref={ref}
      data-variant={variant}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center",
        variant === "error" && "border-destructive/40 bg-destructive/5",
        className,
      )}
      {...props}
    >
      {Icon && (
        <Icon
          data-testid="empty-state-icon"
          className={cn("h-10 w-10", variantIconClass[variant])}
          aria-hidden="true"
        />
      )}
      <div className="space-y-1">
        <h3 className="text-base font-medium">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";
```

**Step 4: run — pass**

Run: `npm --prefix fe-followup-v3 run test:unit -- src/components/ui/empty-state.test.tsx`
Expected: 5 passed.

**Step 5: export via barrel**

Modify `fe-followup-v3/src/components/ui/index.ts`: aggiungere `export * from "./empty-state";`.

**Step 6: typecheck + commit**

```bash
npm --prefix fe-followup-v3 run typecheck
git add fe-followup-v3/src/components/ui/empty-state.tsx fe-followup-v3/src/components/ui/empty-state.test.tsx fe-followup-v3/src/components/ui/index.ts
git commit -m "feat(fe-followup-v3): add EmptyState component with default/search/error variants"
```

---

## Task 5 — Install dipendenze per DataTable + form helper

**Step 1: installare**

Run:
```bash
cd /Users/s.zanetti/dev/tecma/business/tecma-digital-platform/followup-3.0/fe-followup-v3
npm install @tanstack/react-table@^8 react-hook-form@^7 @hookform/resolvers@^3
```

**Step 2: verificare package.json**

Run: `grep -E '(tanstack/react-table|react-hook-form|hookform/resolvers)' fe-followup-v3/package.json`
Expected: 3 match.

**Step 3: typecheck + commit**

```bash
npm --prefix fe-followup-v3 run typecheck
git add fe-followup-v3/package.json fe-followup-v3/package-lock.json
git commit -m "chore(fe-followup-v3): add @tanstack/react-table, react-hook-form, @hookform/resolvers"
```

---

## Task 6 — `<DataTable>` — core (column def + sort)

**Files:**
- Create: `fe-followup-v3/src/components/ui/data-table.tsx`
- Create: `fe-followup-v3/src/components/ui/data-table.test.tsx`

**Step 1: test core**

`fe-followup-v3/src/components/ui/data-table.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DataTable, type DataTableColumn } from "./data-table";

interface Row { id: string; name: string; age: number; }

const rows: Row[] = [
  { id: "1", name: "Bianchi", age: 30 },
  { id: "2", name: "Rossi", age: 45 },
  { id: "3", name: "Verdi", age: 22 },
];

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Nome", accessor: (r) => r.name, sortable: true },
  { id: "age", header: "Età", accessor: (r) => r.age, sortable: true },
];

describe("DataTable — core", () => {
  it("renders header + rows", () => {
    render(<DataTable columns={columns} data={rows} getRowId={(r) => r.id} />);
    expect(screen.getByText("Nome")).toBeInTheDocument();
    expect(screen.getByText("Bianchi")).toBeInTheDocument();
    expect(screen.getByText("Rossi")).toBeInTheDocument();
    expect(screen.getByText("Verdi")).toBeInTheDocument();
  });

  it("fires onSortChange when header clicked", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        sorting={{ enabled: true, onSortChange }}
      />,
    );
    fireEvent.click(screen.getByText("Nome"));
    expect(onSortChange).toHaveBeenCalledWith({ id: "name", direction: "asc" });
  });

  it("toggles sort direction on second click", () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        sorting={{
          enabled: true,
          onSortChange,
          currentSort: { id: "name", direction: "asc" },
        }}
      />,
    );
    fireEvent.click(screen.getByText("Nome"));
    expect(onSortChange).toHaveBeenCalledWith({ id: "name", direction: "desc" });
  });

  it("does not sort when column sortable is false", () => {
    const onSortChange = vi.fn();
    const nonSortCols: DataTableColumn<Row>[] = [
      { id: "name", header: "Nome", accessor: (r) => r.name },
    ];
    render(
      <DataTable
        columns={nonSortCols}
        data={rows}
        getRowId={(r) => r.id}
        sorting={{ enabled: true, onSortChange }}
      />,
    );
    fireEvent.click(screen.getByText("Nome"));
    expect(onSortChange).not.toHaveBeenCalled();
  });
});
```

**Step 2: run — fail**

Run: `npm --prefix fe-followup-v3 run test:unit -- src/components/ui/data-table.test.tsx`
Expected: FAIL module not found.

**Step 3: implementazione core (senza selection / pagination, quelli arrivano in 7-8)**

`fe-followup-v3/src/components/ui/data-table.tsx`:

```tsx
import * as React from "react";
import { cn } from "../../lib/utils";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./table";

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

export interface SortState {
  id: string;
  direction: "asc" | "desc";
}

export interface DataTableSorting {
  enabled: boolean;
  currentSort?: SortState;
  onSortChange?: (sort: SortState) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  sorting?: DataTableSorting;
  className?: string;
}

function toggleDirection(dir: "asc" | "desc"): "asc" | "desc" {
  return dir === "asc" ? "desc" : "asc";
}

export function DataTable<T>({ columns, data, getRowId, sorting, className }: DataTableProps<T>) {
  const handleHeaderClick = (col: DataTableColumn<T>) => {
    if (!sorting?.enabled || !col.sortable || !sorting.onSortChange) return;
    const current = sorting.currentSort;
    if (!current || current.id !== col.id) {
      sorting.onSortChange({ id: col.id, direction: "asc" });
    } else {
      sorting.onSortChange({ id: col.id, direction: toggleDirection(current.direction) });
    }
  };

  const renderSortIcon = (col: DataTableColumn<T>) => {
    if (!sorting?.enabled || !col.sortable) return null;
    const current = sorting.currentSort;
    if (!current || current.id !== col.id) {
      return <ChevronsUpDown className="ml-1 inline h-3.5 w-3.5 opacity-50" aria-hidden="true" />;
    }
    return current.direction === "asc" ? (
      <ChevronUp className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
    ) : (
      <ChevronDown className="ml-1 inline h-3.5 w-3.5" aria-hidden="true" />
    );
  };

  return (
    <Table className={className}>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.id}
              className={cn(
                sorting?.enabled && col.sortable && "cursor-pointer select-none hover:bg-muted/50",
                col.headerClassName,
              )}
              onClick={() => handleHeaderClick(col)}
            >
              {col.header}
              {renderSortIcon(col)}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={getRowId(row)}>
            {columns.map((col) => (
              <TableCell key={col.id} className={col.className}>
                {col.accessor(row)}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

**Step 4: verify table primitives exist**

Run: `grep -E "^export (const|function)" fe-followup-v3/src/components/ui/table.tsx`
Expected: exports `Table`, `TableHeader`, `TableBody`, `TableHead`, `TableRow`, `TableCell` — se nomi diversi, adeguare import in data-table.tsx.

**Step 5: run test — pass**

Run: `npm --prefix fe-followup-v3 run test:unit -- src/components/ui/data-table.test.tsx`
Expected: 4 passed.

**Step 6: commit**

```bash
git add fe-followup-v3/src/components/ui/data-table.tsx fe-followup-v3/src/components/ui/data-table.test.tsx
git commit -m "feat(fe-followup-v3): add DataTable core with sortable columns"
```

---

## Task 7 — `<DataTable>` — selection + bulk actions bar

**Files:**
- Modify: `fe-followup-v3/src/components/ui/data-table.tsx`
- Modify: `fe-followup-v3/src/components/ui/data-table.test.tsx`

**Step 1: append test**

```tsx
describe("DataTable — selection", () => {
  it("renders checkbox column when selection enabled", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        selection={{ enabled: true, selectedIds: [], onSelectionChange: () => {} }}
      />,
    );
    const checkboxes = screen.getAllByRole("checkbox");
    // 1 header + 3 rows
    expect(checkboxes.length).toBe(4);
  });

  it("selects row via checkbox", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        selection={{ enabled: true, selectedIds: [], onSelectionChange }}
      />,
    );
    const rowCheckbox = screen.getAllByRole("checkbox")[1];
    fireEvent.click(rowCheckbox);
    expect(onSelectionChange).toHaveBeenCalledWith(["1"]);
  });

  it("select-all toggles all row ids", () => {
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        selection={{ enabled: true, selectedIds: [], onSelectionChange }}
      />,
    );
    const header = screen.getAllByRole("checkbox")[0];
    fireEvent.click(header);
    expect(onSelectionChange).toHaveBeenCalledWith(["1", "2", "3"]);
  });

  it("renders bulk actions bar when rows selected", () => {
    const action = <button>Elimina</button>;
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        selection={{ enabled: true, selectedIds: ["1", "2"], onSelectionChange: () => {} }}
        bulkActions={action}
      />,
    );
    expect(screen.getByText(/2 selezionat/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elimina" })).toBeInTheDocument();
  });
});
```

**Step 2: run — 4 new fail**

Run: `npm --prefix fe-followup-v3 run test:unit -- src/components/ui/data-table.test.tsx`

**Step 3: estendere componente**

Aggiungere all'interfaccia `DataTableProps<T>`:

```tsx
export interface DataTableSelection {
  enabled: boolean;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

// in DataTableProps<T>
selection?: DataTableSelection;
bulkActions?: React.ReactNode;
```

Modificare `DataTable`:

```tsx
export function DataTable<T>({
  columns, data, getRowId, sorting, selection, bulkActions, className,
}: DataTableProps<T>) {
  const allIds = React.useMemo(() => data.map(getRowId), [data, getRowId]);
  const allSelected = selection?.enabled && selection.selectedIds.length > 0 && selection.selectedIds.length === allIds.length;
  const someSelected = selection?.enabled && selection.selectedIds.length > 0 && !allSelected;

  const toggleAll = () => {
    if (!selection) return;
    selection.onSelectionChange(allSelected ? [] : allIds);
  };

  const toggleRow = (id: string) => {
    if (!selection) return;
    const isSelected = selection.selectedIds.includes(id);
    selection.onSelectionChange(
      isSelected ? selection.selectedIds.filter((x) => x !== id) : [...selection.selectedIds, id],
    );
  };

  // ... sorting logic invariata

  return (
    <div className="space-y-2">
      {selection?.enabled && selection.selectedIds.length > 0 && bulkActions && (
        <div className="flex items-center justify-between rounded-md border bg-muted/50 px-3 py-2">
          <span className="text-sm">{selection.selectedIds.length} selezionati</span>
          <div>{bulkActions}</div>
        </div>
      )}
      <Table className={className}>
        <TableHeader>
          <TableRow>
            {selection?.enabled && (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  aria-label="Seleziona tutti"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = !!someSelected; }}
                  onChange={toggleAll}
                />
              </TableHead>
            )}
            {columns.map((col) => ( /* come prima */ ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const id = getRowId(row);
            const isSelected = selection?.selectedIds.includes(id) ?? false;
            return (
              <TableRow key={id} data-state={isSelected ? "selected" : undefined}>
                {selection?.enabled && (
                  <TableCell className="w-10">
                    <input
                      type="checkbox"
                      aria-label={`Seleziona riga ${id}`}
                      checked={isSelected}
                      onChange={() => toggleRow(id)}
                    />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell key={col.id} className={col.className}>
                    {col.accessor(row)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

**Step 4: run — pass**

Run: `npm --prefix fe-followup-v3 run test:unit -- src/components/ui/data-table.test.tsx`
Expected: 8 passed.

**Step 5: commit**

```bash
git add fe-followup-v3/src/components/ui/data-table.tsx fe-followup-v3/src/components/ui/data-table.test.tsx
git commit -m "feat(fe-followup-v3): add row selection + bulk actions bar to DataTable"
```

---

## Task 8 — `<DataTable>` — loading, empty, pagination

**Files:**
- Modify: `fe-followup-v3/src/components/ui/data-table.tsx`
- Modify: `fe-followup-v3/src/components/ui/data-table.test.tsx`

**Step 1: append test**

```tsx
import { SkeletonTable } from "./skeleton";
import { EmptyState } from "./empty-state";

describe("DataTable — loading & empty", () => {
  it("renders SkeletonTable when loading", () => {
    render(
      <DataTable columns={columns} data={[]} getRowId={(r) => r.id} loading />,
    );
    // SkeletonTable renders skel-cell elements
    expect(document.querySelector('[data-testid="skel-cell"]')).toBeInTheDocument();
  });

  it("renders empty slot when data is empty and not loading", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        getRowId={(r) => r.id}
        empty={<EmptyState title="Nessuna riga" />}
      />,
    );
    expect(screen.getByText("Nessuna riga")).toBeInTheDocument();
  });

  it("does not render empty slot when loading", () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        getRowId={(r) => r.id}
        loading
        empty={<EmptyState title="Nessuna riga" />}
      />,
    );
    expect(screen.queryByText("Nessuna riga")).not.toBeInTheDocument();
  });
});

describe("DataTable — pagination", () => {
  it("renders pagination footer when pagination provided", () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        pagination={{
          page: 1,
          pageSize: 10,
          totalRows: 25,
          onPageChange,
        }}
      />,
    );
    expect(screen.getByText(/pagina 1 di 3/i)).toBeInTheDocument();
  });

  it("calls onPageChange when next clicked", () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        pagination={{ page: 1, pageSize: 10, totalRows: 25, onPageChange }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /successiva/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("disables previous on first page", () => {
    render(
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(r) => r.id}
        pagination={{ page: 1, pageSize: 10, totalRows: 25, onPageChange: () => {} }}
      />,
    );
    expect(screen.getByRole("button", { name: /precedente/i })).toBeDisabled();
  });
});
```

**Step 2: run — fail**

Expected: 6 nuovi test falliscono.

**Step 3: estendere componente**

Aggiungere tipi + logica:

```tsx
import { SkeletonTable } from "./skeleton";
import { Button } from "./button";

export interface DataTablePagination {
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}

// in DataTableProps<T>
loading?: boolean;
empty?: React.ReactNode;
pagination?: DataTablePagination;
```

Nel rendering, sostituire la sezione table con:

```tsx
const isEmpty = !loading && data.length === 0;
const totalPages = pagination ? Math.max(1, Math.ceil(pagination.totalRows / pagination.pageSize)) : 1;

return (
  <div className="space-y-2">
    {/* bulk bar come prima */}

    {loading ? (
      <SkeletonTable rows={5} cols={columns.length + (selection?.enabled ? 1 : 0)} showHeader />
    ) : isEmpty && empty ? (
      <div className="py-6">{empty}</div>
    ) : (
      <Table className={className}>
        {/* ... come prima ... */}
      </Table>
    )}

    {pagination && !loading && (
      <div className="flex items-center justify-between border-t pt-2 text-sm">
        <span className="text-muted-foreground">
          Pagina {pagination.page} di {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
          >
            Precedente
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= totalPages}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
          >
            Successiva
          </Button>
        </div>
      </div>
    )}
  </div>
);
```

**Step 4: run — pass**

Expected: 14 test totali passati.

**Step 5: export barrel**

Modify `index.ts`: aggiungere `export * from "./data-table";`.

**Step 6: commit**

```bash
git add fe-followup-v3/src/components/ui/data-table.tsx fe-followup-v3/src/components/ui/data-table.test.tsx fe-followup-v3/src/components/ui/index.ts
git commit -m "feat(fe-followup-v3): add DataTable loading/empty/pagination support"
```

---

## Task 9 — Form helper `useZodForm` + wrapper

**Files:**
- Create: `fe-followup-v3/src/lib/forms/useZodForm.ts`
- Create: `fe-followup-v3/src/lib/forms/useZodForm.test.ts`
- Create: `fe-followup-v3/src/lib/forms/ZodFormField.tsx`
- Create: `fe-followup-v3/src/lib/forms/ZodFormField.test.tsx`
- Create: `fe-followup-v3/src/lib/forms/index.ts`

**Step 1: test `useZodForm`**

`useZodForm.test.ts`:

```ts
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { useZodForm } from "./useZodForm";

describe("useZodForm", () => {
  const schema = z.object({
    email: z.string().email(),
    age: z.number().int().min(18),
  });

  it("initializes with default values", () => {
    const { result } = renderHook(() =>
      useZodForm({ schema, defaultValues: { email: "a@b.co", age: 21 } }),
    );
    expect(result.current.getValues("email")).toBe("a@b.co");
    expect(result.current.getValues("age")).toBe(21);
  });

  it("validates on submit and populates errors", async () => {
    const { result } = renderHook(() =>
      useZodForm({ schema, defaultValues: { email: "bad", age: 10 } }),
    );
    await act(async () => {
      await result.current.trigger();
    });
    expect(result.current.formState.errors.email).toBeDefined();
    expect(result.current.formState.errors.age).toBeDefined();
  });
});
```

**Step 2: run — fail**

**Step 3: implementazione**

```ts
import { useForm, type UseFormProps, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z, ZodSchema } from "zod";

export interface UseZodFormOptions<S extends ZodSchema>
  extends Omit<UseFormProps<z.infer<S>>, "resolver"> {
  schema: S;
}

export function useZodForm<S extends ZodSchema>(
  options: UseZodFormOptions<S>,
): UseFormReturn<z.infer<S>> {
  const { schema, ...rest } = options;
  return useForm<z.infer<S>>({
    ...rest,
    resolver: zodResolver(schema),
  });
}
```

**Step 4: test + implementazione `ZodFormField`**

Test (`ZodFormField.test.tsx`):

```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { z } from "zod";
import { useZodForm } from "./useZodForm";
import { ZodFormField } from "./ZodFormField";

function Harness({ error }: { error?: string }) {
  const form = useZodForm({
    schema: z.object({ name: z.string().min(3) }),
    defaultValues: { name: "" },
  });
  if (error) {
    form.setError("name", { message: error });
  }
  return (
    <ZodFormField
      form={form}
      name="name"
      label="Nome"
      render={({ field, id, describedBy }) => (
        <input id={id} aria-describedby={describedBy} {...field} />
      )}
    />
  );
}

describe("ZodFormField", () => {
  it("renders label linked to input via id", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Nome");
    expect(input).toBeInTheDocument();
  });

  it("renders error message with aria-describedby wired", () => {
    render(<Harness error="Troppo corto" />);
    const input = screen.getByLabelText("Nome") as HTMLInputElement;
    const errorId = input.getAttribute("aria-describedby");
    expect(errorId).toBeTruthy();
    expect(document.getElementById(errorId!)?.textContent).toBe("Troppo corto");
  });
});
```

Implementazione (`ZodFormField.tsx`):

```tsx
import * as React from "react";
import type { Controller, FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { Controller as ControllerImpl } from "react-hook-form";
import { cn } from "../utils";

export interface ZodFormFieldRenderProps {
  field: {
    name: string;
    value: unknown;
    onChange: (...event: unknown[]) => void;
    onBlur: () => void;
    ref: React.Ref<unknown>;
  };
  id: string;
  describedBy?: string;
  invalid: boolean;
}

export interface ZodFormFieldProps<TForm extends FieldValues> {
  form: UseFormReturn<TForm>;
  name: FieldPath<TForm>;
  label: string;
  description?: string;
  render: (props: ZodFormFieldRenderProps) => React.ReactNode;
  className?: string;
}

export function ZodFormField<TForm extends FieldValues>({
  form, name, label, description, render, className,
}: ZodFormFieldProps<TForm>) {
  const reactId = React.useId();
  const id = `${reactId}-${name}`;
  const descId = description ? `${id}-desc` : undefined;
  const error = form.formState.errors[name]?.message as string | undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [descId, errId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {description && (
        <p id={descId} className="text-xs text-muted-foreground">{description}</p>
      )}
      <ControllerImpl
        control={form.control}
        name={name}
        render={({ field }) => render({ field: field as ZodFormFieldRenderProps["field"], id, describedBy, invalid: !!error })}
      />
      {error && (
        <p id={errId} role="alert" className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
```

**Step 5: barrel**

`fe-followup-v3/src/lib/forms/index.ts`:

```ts
export { useZodForm } from "./useZodForm";
export type { UseZodFormOptions } from "./useZodForm";
export { ZodFormField } from "./ZodFormField";
export type { ZodFormFieldProps, ZodFormFieldRenderProps } from "./ZodFormField";
```

**Step 6: run + typecheck**

Run:
```bash
npm --prefix fe-followup-v3 run test:unit -- src/lib/forms
npm --prefix fe-followup-v3 run typecheck
```
Expected: all pass.

**Step 7: commit**

```bash
git add fe-followup-v3/src/lib/forms
git commit -m "feat(fe-followup-v3): add useZodForm hook + ZodFormField wrapper (infra only, no consumer yet)"
```

---

## Task 10 — Pagina demo `/dev/ds-preview`

**Files:**
- Create: `fe-followup-v3/src/dev/DsPreviewPage.tsx`
- Modify: `fe-followup-v3/src/core/config/routes.ts` — aggiungere route `/dev/ds-preview` solo se `import.meta.env.DEV`

**Step 1: leggere routes attuali**

Run: `head -40 fe-followup-v3/src/core/config/routes.ts` per capire il formato.

**Step 2: pagina demo**

`DsPreviewPage.tsx`:

```tsx
import * as React from "react";
import { Users, Search, AlertTriangle } from "lucide-react";
import { z } from "zod";
import {
  Skeleton, SkeletonTable, SkeletonCard, SkeletonList,
  EmptyState,
  DataTable, type DataTableColumn,
  Button, Card,
} from "../components/ui";
import { useZodForm, ZodFormField } from "../lib/forms";

interface Row { id: string; name: string; email: string; status: string; }
const sampleRows: Row[] = [
  { id: "1", name: "Bianchi", email: "b@x.co", status: "attivo" },
  { id: "2", name: "Rossi", email: "r@x.co", status: "prospect" },
  { id: "3", name: "Verdi", email: "v@x.co", status: "attivo" },
];

export default function DsPreviewPage() {
  const [sort, setSort] = React.useState<{ id: string; direction: "asc" | "desc" } | undefined>();
  const [selected, setSelected] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [showEmpty, setShowEmpty] = React.useState(false);

  const columns: DataTableColumn<Row>[] = [
    { id: "name", header: "Nome", accessor: (r) => r.name, sortable: true },
    { id: "email", header: "Email", accessor: (r) => r.email, sortable: true },
    { id: "status", header: "Stato", accessor: (r) => r.status },
  ];

  const form = useZodForm({
    schema: z.object({
      email: z.string().email("Email non valida"),
      name: z.string().min(3, "Minimo 3 caratteri"),
    }),
    defaultValues: { email: "", name: "" },
  });

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-semibold">DS Preview — W0 Foundation</h1>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Skeleton</h2>
        <Skeleton className="h-4 w-64" />
        <SkeletonCard />
        <SkeletonList rows={3} />
        <SkeletonTable rows={3} cols={4} showHeader />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">EmptyState</h2>
        <EmptyState icon={Users} title="Nessun cliente" description="Aggiungi il primo per iniziare" action={<Button>Aggiungi</Button>} />
        <EmptyState icon={Search} title="Nessun risultato" variant="search" />
        <EmptyState icon={AlertTriangle} title="Errore di caricamento" variant="error" description="Riprova tra qualche secondo." />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">DataTable</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setLoading((v) => !v)}>toggle loading</Button>
          <Button size="sm" onClick={() => setShowEmpty((v) => !v)}>toggle empty</Button>
        </div>
        <DataTable
          columns={columns}
          data={showEmpty ? [] : sampleRows}
          getRowId={(r) => r.id}
          loading={loading}
          sorting={{ enabled: true, currentSort: sort, onSortChange: setSort }}
          selection={{ enabled: true, selectedIds: selected, onSelectionChange: setSelected }}
          bulkActions={<Button size="sm" variant="destructive">Elimina selezionati</Button>}
          pagination={{ page, pageSize: 3, totalRows: 9, onPageChange: setPage }}
          empty={<EmptyState title="Nessuna riga" variant="search" />}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">useZodForm + ZodFormField</h2>
        <Card className="space-y-3 p-4">
          <ZodFormField
            form={form}
            name="name"
            label="Nome"
            render={({ field, id, describedBy, invalid }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className="w-full rounded border px-2 py-1"
                value={field.value as string}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <ZodFormField
            form={form}
            name="email"
            label="Email"
            render={({ field, id, describedBy, invalid }) => (
              <input
                id={id}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                className="w-full rounded border px-2 py-1"
                value={field.value as string}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />
          <Button onClick={form.handleSubmit((data) => alert(JSON.stringify(data)))}>
            Submit
          </Button>
        </Card>
      </section>
    </div>
  );
}
```

**Step 3: aggiungere route dev-only**

In `fe-followup-v3/src/core/config/routes.ts` aggiungere (path da adeguare al formato esistente del file):

```ts
// Route disponibile solo in dev build (import.meta.env.DEV)
{
  path: "/dev/ds-preview",
  element: React.lazy(() => import("../../dev/DsPreviewPage")),
  devOnly: true,
},
```

Nota: se il router non supporta `devOnly`, filtrare la route a livello di aggregator con `if (import.meta.env.DEV)`.

**Step 4: verificare in dev**

Run:
```bash
npm --prefix fe-followup-v3 run dev
# apri http://localhost:<porta>/dev/ds-preview
```
Expected: pagina carica, tutte le sezioni visibili, interazioni funzionano (sort, selection, pagination, toggle loading/empty, form validation inline).

**Step 5: typecheck + build**

Run:
```bash
npm --prefix fe-followup-v3 run typecheck
npm --prefix fe-followup-v3 run build
```
Expected: entrambi puliti.

**Step 6: commit**

```bash
git add fe-followup-v3/src/dev/DsPreviewPage.tsx fe-followup-v3/src/core/config/routes.ts
git commit -m "feat(fe-followup-v3): add /dev/ds-preview showcase page for W0 DS primitives"
```

---

## Task 11 — Verifica finale W0 (no regressions)

**Step 1: full test suite core**

Run: `npm --prefix fe-followup-v3 run test:run:ci`
Expected: all pass (inclusi test preesistenti).

**Step 2: lint core**

Run: `npm --prefix fe-followup-v3 run test:lint:core`
Expected: 0 errors.

**Step 3: panel-guard + detail-architecture checks**

Run:
```bash
npm --prefix fe-followup-v3 run check:panels
npm --prefix fe-followup-v3 run check:detail-architecture
```
Expected: pass.

**Step 4: build finale**

Run: `npm --prefix fe-followup-v3 run build`
Expected: build finale pulita.

**Step 5: aggiorna design doc con esito W0**

Append a `docs/plans/2026-04-22-followup3-go-live-design.md` una sezione "Wave 0 — outcome" con data chiusura, commit SHA chiave, eventuali deviazioni dal design.

**Step 6: commit finale W0**

```bash
git add docs/plans/2026-04-22-followup3-go-live-design.md
git commit -m "docs(followup-3.0): mark W0 Foundation DS as completed"
```

---

## Riepilogo deliverable W0

| Artefatto | Path |
|---|---|
| Skeleton primitive | `fe-followup-v3/src/components/ui/skeleton.tsx` |
| EmptyState primitive | `fe-followup-v3/src/components/ui/empty-state.tsx` |
| DataTable primitive | `fe-followup-v3/src/components/ui/data-table.tsx` |
| useZodForm hook | `fe-followup-v3/src/lib/forms/useZodForm.ts` |
| ZodFormField wrapper | `fe-followup-v3/src/lib/forms/ZodFormField.tsx` |
| Fix fallback token | `fe-followup-v3/tailwind.theme.fallback.js` |
| DS preview page | `fe-followup-v3/src/dev/DsPreviewPage.tsx` |

Nuove dipendenze npm: `@tanstack/react-table`, `react-hook-form`, `@hookform/resolvers`.

**Nessun consumer applicativo modificato in W0.** I componenti `ClientsListSection`, `RequestsBoardSection`, form legacy restano invariati e saranno migrati in W1.
