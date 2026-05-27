import { useCallback, useEffect, useMemo, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { UserProjectAccessRow, WorkspaceUserRole } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import {
  PermissionOverrideMatrix,
  type PermissionCatalogGroup,
} from "./PermissionOverrideMatrix";

type WorkspaceProjectOption = {
  projectId: string;
  displayName?: string;
  name?: string;
};

type Props = {
  workspaceId: string;
  userEmail: string;
  workspaceRole: WorkspaceUserRole;
  projects: WorkspaceProjectOption[];
  /** Lista esplicita di projectId in scope; vuota = tutti i progetti del workspace. */
  restrictedProjectIds: string[];
  onAddProject: (projectId: string) => Promise<void>;
  onRemoveProject: (projectId: string) => Promise<void>;
  permissionCatalogGroups: PermissionCatalogGroup[] | null;
  permissionCatalogLoading?: boolean;
  getRoleLabel: (role: string) => string;
  workspaceRoles: Array<{ roleKey: string; label: string }>;
  projectMutationDisabled?: boolean;
};

function mergeEffectivePreview(base: string[], grant: string[], deny: string[]): string[] {
  const set = new Set(base);
  for (const g of grant) set.add(g);
  for (const d of deny) set.delete(d);
  if (base.includes("*") && deny.length === 0) return ["*"];
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function UserProjectAccessPanel({
  workspaceId,
  userEmail,
  workspaceRole,
  projects,
  restrictedProjectIds,
  onAddProject,
  onRemoveProject,
  permissionCatalogGroups,
  permissionCatalogLoading = false,
  getRoleLabel,
  workspaceRoles,
  projectMutationDisabled = false,
}: Props) {
  const [rows, setRows] = useState<UserProjectAccessRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permDialogProjectId, setPermDialogProjectId] = useState<string | null>(null);
  const [grantDraft, setGrantDraft] = useState<string[]>([]);
  const [denyDraft, setDenyDraft] = useState<string[]>([]);
  const [rolePreviewByKey, setRolePreviewByKey] = useState<Record<string, string[]>>({});

  const unrestricted = restrictedProjectIds.length === 0;

  const load = useCallback(async () => {
    if (!workspaceId || !userEmail) return;
    setLoading(true);
    try {
      const res = await followupApi.listUserProjectAccess(workspaceId, userEmail);
      setRows(res.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userEmail]);

  useEffect(() => {
    void load();
  }, [load]);

  const rowFor = (projectId: string): UserProjectAccessRow | undefined =>
    rows.find((r) => r.projectId === projectId);

  const isInScope = (projectId: string): boolean =>
    unrestricted || restrictedProjectIds.includes(projectId);

  const effectiveRole = (projectId: string): string => rowFor(projectId)?.role ?? workspaceRole;

  const loadRolePreview = useCallback(async (roleKey: string) => {
    if (rolePreviewByKey[roleKey]) return;
    try {
      const res = await followupApi.getRoleEffectivePermissions(roleKey);
      setRolePreviewByKey((prev) => ({ ...prev, [roleKey]: res.data?.permissions ?? [] }));
    } catch {
      setRolePreviewByKey((prev) => ({ ...prev, [roleKey]: [] }));
    }
  }, [rolePreviewByKey]);

  useEffect(() => {
    const roles = new Set(projects.map((p) => effectiveRole(p.projectId)));
    for (const r of roles) void loadRolePreview(r);
  }, [projects, rows, workspaceRole, loadRolePreview]);

  const upsertRow = async (projectId: string, patch: Partial<UserProjectAccessRow>) => {
    setSaving(true);
    try {
      await followupApi.putUserProjectAccess(workspaceId, userEmail, projectId, {
        ...(rowFor(projectId) ?? { workspaceId, userId: userEmail, projectId }),
        ...patch,
      });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const toggleInScope = async (projectId: string, checked: boolean) => {
    if (projectMutationDisabled || saving) return;
    if (checked) {
      if (unrestricted || restrictedProjectIds.includes(projectId)) return;
      await onAddProject(projectId);
      return;
    }
    if (unrestricted) {
      const toAdd = projects.filter((p) => p.projectId !== projectId).map((p) => p.projectId);
      for (const pid of toAdd) {
        await onAddProject(pid);
      }
      return;
    }
    await onRemoveProject(projectId);
  };

  const openPermissions = (projectId: string) => {
    const row = rowFor(projectId);
    setGrantDraft([...(row?.permissions_override ?? [])].sort((a, b) => a.localeCompare(b)));
    setDenyDraft([...(row?.permissions_deny ?? [])].sort((a, b) => a.localeCompare(b)));
    setPermDialogProjectId(projectId);
  };

  const savePermissions = async () => {
    if (!permDialogProjectId) return;
    await upsertRow(permDialogProjectId, {
      permissions_override: grantDraft,
      permissions_deny: denyDraft,
    });
    setPermDialogProjectId(null);
  };

  const previewForProject = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of projects) {
      const role = effectiveRole(p.projectId);
      const base = rolePreviewByKey[role] ?? [];
      const row = rowFor(p.projectId);
      const merged = mergeEffectivePreview(base, row?.permissions_override ?? [], row?.permissions_deny ?? []);
      map[p.projectId] =
        merged.length === 0
          ? "—"
          : merged.includes("*")
            ? "Tutti (*)"
            : merged.length > 4
              ? `${merged.slice(0, 4).join(", ")} +${merged.length - 4}`
              : merged.join(", ");
    }
    return map;
  }, [projects, rows, rolePreviewByKey, workspaceRole]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Caricamento matrice accesso…</p>;
  }

  if (projects.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessun progetto nel workspace.</p>;
  }

  const permProject = permDialogProjectId
    ? projects.find((p) => p.projectId === permDialogProjectId)
    : null;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Visibilità e permessi per progetto. Se nessun progetto è ristretto, l&apos;utente vede tutti i progetti del
        workspace.
      </p>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Progetto</th>
              <th className="px-3 py-2 font-medium">In scope</th>
              <th className="px-3 py-2 font-medium">Ruolo</th>
              <th className="px-3 py-2 font-medium">Scope entità</th>
              <th className="px-3 py-2 font-medium">Permessi</th>
              <th className="px-3 py-2 font-medium">Anteprima effettiva</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => {
              const inScope = isInScope(p.projectId);
              const row = rowFor(p.projectId);
              const role = effectiveRole(p.projectId);
              const scope = row?.access_scope ?? "all";
              const grantCount = row?.permissions_override?.length ?? 0;
              const denyCount = row?.permissions_deny?.length ?? 0;
              return (
                <tr key={p.projectId} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{p.displayName || p.name || p.projectId}</td>
                  <td className="px-3 py-2">
                    <Checkbox
                      checked={inScope}
                      disabled={projectMutationDisabled || saving}
                      onCheckedChange={(v) => void toggleInScope(p.projectId, v === true)}
                      aria-label={`In scope ${p.displayName || p.name || p.projectId}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={row?.role ?? workspaceRole}
                      disabled={!inScope || saving}
                      onValueChange={(v) => void upsertRow(p.projectId, { role: v })}
                    >
                      <SelectTrigger className="w-[140px] min-h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaceRoles.map((r) => (
                          <SelectItem key={r.roleKey} value={r.roleKey}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={scope}
                      disabled={!inScope || saving}
                      onValueChange={(v) =>
                        void upsertRow(p.projectId, { access_scope: v === "assigned" ? "assigned" : "all" })
                      }
                    >
                      <SelectTrigger className="w-[160px] min-h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tutti i clienti</SelectItem>
                        <SelectItem value="assigned">Solo assegnati</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-9"
                      disabled={!inScope || saving}
                      onClick={() => openPermissions(p.projectId)}
                    >
                      Grant {grantCount} / Deny {denyCount}
                    </Button>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground" title={previewForProject[p.projectId]}>
                    {getRoleLabel(role)}: {previewForProject[p.projectId] ?? "…"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={permDialogProjectId !== null} onOpenChange={(open) => !open && setPermDialogProjectId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Permessi per progetto</DialogTitle>
            <DialogDescription>
              {permProject?.displayName || permProject?.name || permDialogProjectId} — grant si sommano al ruolo; deny
              revoca permessi anche se il ruolo ha wildcard.
            </DialogDescription>
          </DialogHeader>
          <PermissionOverrideMatrix
            groups={permissionCatalogGroups}
            loading={permissionCatalogLoading}
            loadError={null}
            selectedIds={grantDraft}
            onChange={setGrantDraft}
            disabled={saving}
            mode="grant"
          />
          <PermissionOverrideMatrix
            groups={permissionCatalogGroups}
            loading={permissionCatalogLoading}
            loadError={null}
            selectedIds={denyDraft}
            onChange={setDenyDraft}
            disabled={saving}
            mode="deny"
          />
          <div className="flex gap-2 pt-2">
            <Button size="sm" disabled={saving} onClick={() => void savePermissions()}>
              {saving ? "Salvataggio…" : "Salva permessi progetto"}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setPermDialogProjectId(null)}>
              Annulla
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
