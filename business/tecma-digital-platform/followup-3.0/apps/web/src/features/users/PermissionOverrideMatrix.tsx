import type { ChangeEvent } from 'react';

export interface PermissionEntry {
  id: string;
  label: string;
  module: string;
  action: string;
  actionLabel: string;
}

export interface PermissionGroup {
  module: string;
  label: string;
  permissions: PermissionEntry[];
}

export interface PermissionOverrideMatrixProps {
  groups: PermissionGroup[];
  selectedIds: readonly string[];
  basePermissions?: readonly string[];
  onChange: (nextSelectedIds: string[]) => void;
  disabled?: boolean;
}

/**
 * Matrice permessi per UI override: una riga per modulo, checkbox per ogni
 * azione del catalogo. Espone:
 * - `selectedIds`: permessi extra rispetto al ruolo (override).
 * - `basePermissions`: permessi gia derivati dal ruolo (read-only, mostrati come implicit).
 *
 * Una checkbox di override mostra `+` accanto al label se non e gia incluso nei
 * base, e diventa `read-only check` se invece il permesso e coperto dal ruolo.
 */
export const PermissionOverrideMatrix = ({
  groups,
  selectedIds,
  basePermissions = [],
  onChange,
  disabled = false,
}: PermissionOverrideMatrixProps) => {
  const baseSet = new Set(basePermissions);
  const selectedSet = new Set(selectedIds);

  const togglePermission = (id: string, event: ChangeEvent<HTMLInputElement>): void => {
    if (disabled) return;
    const next = new Set(selectedSet);
    if (event.target.checked) next.add(id);
    else next.delete(id);
    onChange([...next]);
  };

  return (
    <div className="space-y-4" role="group" aria-label="Matrice permessi override">
      {groups.map((group) => (
        <fieldset
          key={group.module}
          className="rounded-lg border border-border p-3"
          data-testid={`permission-group-${group.module}`}
        >
          <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {group.label}
          </legend>
          <ul className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
            {group.permissions.map((entry) => {
              const inBase = baseSet.has(entry.id);
              const checked = inBase || selectedSet.has(entry.id);
              return (
                <li key={entry.id} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id={`perm-${entry.id}`}
                    checked={checked}
                    disabled={disabled || inBase}
                    aria-label={entry.label}
                    onChange={(event) => togglePermission(entry.id, event)}
                    className="mt-1 h-4 w-4 rounded border-input"
                    data-testid={`permission-checkbox-${entry.id}`}
                  />
                  <label
                    htmlFor={`perm-${entry.id}`}
                    className="cursor-pointer text-sm text-foreground"
                  >
                    <span>{entry.actionLabel}</span>
                    {inBase ? (
                      <span className="ml-1 text-xs text-emerald-600" aria-hidden="true">
                        ·base
                      </span>
                    ) : null}
                    {!inBase && selectedSet.has(entry.id) ? (
                      <span className="ml-1 text-xs text-primary" aria-hidden="true">
                        +override
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}
      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">Catalogo permessi vuoto.</p>
      ) : null}
    </div>
  );
};

/**
 * Helper per dirty-check del draft override:
 * confronta due liste di id ignorando ordine e duplicati.
 */
export const permissionOverrideDraftDirty = (
  initialIds: readonly string[] | null | undefined,
  draftIds: readonly string[] | null | undefined,
): boolean => {
  const initial = new Set((initialIds ?? []).filter((id) => typeof id === 'string'));
  const draft = new Set((draftIds ?? []).filter((id) => typeof id === 'string'));
  if (initial.size !== draft.size) return true;
  for (const id of initial) {
    if (!draft.has(id)) return true;
  }
  return false;
};
