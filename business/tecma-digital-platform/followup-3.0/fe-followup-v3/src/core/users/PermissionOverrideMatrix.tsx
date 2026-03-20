import { Checkbox } from "../../components/ui/checkbox";

export type PermissionCatalogGroup = {
  module: string;
  label: string;
  permissions: Array<{ id: string; label: string; action: string }>;
};

function arraysEqualSorted(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

export function permissionOverrideDraftDirty(draft: string[], saved: string[] | undefined): boolean {
  return !arraysEqualSorted(draft, saved ?? []);
}

type Props = {
  groups: PermissionCatalogGroup[] | null;
  loading?: boolean;
  loadError?: string | null;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

/**
 * Matrice permessi da GET /rbac/permission-catalog — allineata a `buildPermissionCatalog()` in
 * `be-followup-v3/src/core/rbac/permissions.ts` (stessa forma `groups` modulo × azioni).
 */
export function PermissionOverrideMatrix({
  groups,
  loading,
  loadError,
  selectedIds,
  onChange,
  disabled,
}: Props) {
  const set = new Set(selectedIds);

  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    onChange([...next].sort((a, b) => a.localeCompare(b)));
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Caricamento catalogo permessi…</p>;
  }
  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>;
  }
  if (!groups?.length) {
    return <p className="text-sm text-muted-foreground">Nessun permesso disponibile.</p>;
  }

  return (
    <div className="space-y-3 max-h-[min(420px,55vh)] overflow-y-auto pr-1">
      {groups.map((g) => {
        const n = g.permissions.length;
        const sel = g.permissions.filter((p) => set.has(p.id)).length;
        return (
          <details key={g.module} className="rounded-md border border-border bg-muted/20 px-2 py-1">
            <summary className="cursor-pointer select-none py-2 text-sm font-medium text-foreground">
              {g.label}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({sel}/{n})
              </span>
            </summary>
            <ul className="space-y-2 pb-3 pl-1">
              {g.permissions.map((p) => {
                const fieldId = `perm-${p.id.replace(/\./g, "-")}`;
                return (
                <li key={p.id} className="flex items-start gap-2">
                  <Checkbox
                    id={fieldId}
                    checked={set.has(p.id)}
                    disabled={disabled}
                    onCheckedChange={(c) => toggle(p.id, c === true)}
                    aria-label={p.label}
                  />
                  <label htmlFor={fieldId} className="text-sm leading-tight text-foreground cursor-pointer">
                    <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                    <span className="block text-foreground">{p.label}</span>
                  </label>
                </li>
              );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
