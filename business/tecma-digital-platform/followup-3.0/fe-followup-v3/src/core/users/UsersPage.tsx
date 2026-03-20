/**
 * Pagina User (solo admin): elenco utenti con visibilità e associazioni.
 * Sheet dettaglio utente: gestione progetti visibili per workspace.
 */
import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import type { UserWithVisibilityRow, WorkspaceRow, WorkspaceUserRole } from "../../types/domain";
import { getMaxWorkspaceRole } from "../../constants/workspaceRoles";
import { useWorkspaceRoles } from "../../hooks/useWorkspaceRoles";
import { useWorkspace } from "../../auth/projectScope";
import { useToast } from "../../contexts/ToastContext";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Checkbox } from "../../components/ui/checkbox";
import { Input } from "../../components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  PermissionOverrideMatrix,
  permissionOverrideDraftDirty,
  type PermissionCatalogGroup,
} from "./PermissionOverrideMatrix";

function flattenCatalogPermissionIds(groups: PermissionCatalogGroup[] | null): string[] {
  if (!groups?.length) return [];
  return groups
    .flatMap((g) => g.permissions.map((p) => p.id))
    .sort((a, b) => a.localeCompare(b));
}

interface WorkspaceProjectOption {
  projectId: string;
  displayName?: string;
  name?: string;
}

interface EntityAssignmentRow {
  _id: string;
  workspaceId: string;
  entityType: string;
  entityId: string;
  userId: string;
}

export const UsersPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useWorkspace();
  const { toastError } = useToast();
  const [users, setUsers] = useState<UserWithVisibilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserWithVisibilityRow | null>(null);
  const [userProjectIdsByWorkspace, setUserProjectIdsByWorkspace] = useState<Record<string, string[]>>({});
  const [workspaceProjectsByWorkspace, setWorkspaceProjectsByWorkspace] = useState<Record<string, WorkspaceProjectOption[]>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingProject, setSavingProject] = useState<string | null>(null);
  const [addSelectValueByWorkspace, setAddSelectValueByWorkspace] = useState<Record<string, string>>({});
  const [entityAssignmentsByWorkspace, setEntityAssignmentsByWorkspace] = useState<Record<string, EntityAssignmentRow[]>>({});
  const [savingAssignment, setSavingAssignment] = useState<string | null>(null);
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [addUserWorkspaceId, setAddUserWorkspaceId] = useState("");
  const [addUserEmail, setAddUserEmail] = useState("");
  const [addUserRole, setAddUserRole] = useState<WorkspaceUserRole>("collaborator");
  const [addUserSaving, setAddUserSaving] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);
  /** invite = nuovo utente con email set-password; existing = solo membership workspace */
  const [addUserMode, setAddUserMode] = useState<"invite" | "existing">("invite");
  const [workspaceProjectsForInvite, setWorkspaceProjectsForInvite] = useState<
    Array<{ projectId: string; displayName?: string; name?: string }>
  >([]);
  /** Progetti da associare alla membership (invito: almeno uno; esistente: opzionale). */
  const [inviteSelectedProjectIds, setInviteSelectedProjectIds] = useState<string[]>([]);
  const [addUserWizardStep, setAddUserWizardStep] = useState<1 | 2 | 3 | 4>(1);
  const [roleEffectivePreview, setRoleEffectivePreview] = useState<string[] | null>(null);
  const [roleEffectiveLoading, setRoleEffectiveLoading] = useState(false);
  const [loadingWorkspaceProjects, setLoadingWorkspaceProjects] = useState(false);
  const [savingRoleWorkspaceId, setSavingRoleWorkspaceId] = useState<string | null>(null);
  const [permissionCatalogGroups, setPermissionCatalogGroups] = useState<PermissionCatalogGroup[] | null>(null);
  const [permissionCatalogLoading, setPermissionCatalogLoading] = useState(false);
  const [permissionCatalogError, setPermissionCatalogError] = useState<string | null>(null);
  const [detailOverrideDraft, setDetailOverrideDraft] = useState<string[]>([]);
  const [savingPermissionsOverride, setSavingPermissionsOverride] = useState(false);
  const [addUserOverrideDraft, setAddUserOverrideDraft] = useState<string[]>([]);

  const { roles: workspaceRoles, getRoleLabel } = useWorkspaceRoles();

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    setPermissionCatalogLoading(true);
    setPermissionCatalogError(null);
    followupApi
      .getPermissionCatalog()
      .then((res) => {
        if (!cancelled) setPermissionCatalogGroups(res.data?.groups ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setPermissionCatalogGroups(null);
          setPermissionCatalogError("Impossibile caricare il catalogo permessi (serve users.read).");
        }
      })
      .finally(() => {
        if (!cancelled) setPermissionCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (selectedUser) {
      setDetailOverrideDraft([...(selectedUser.permissions_override ?? [])].sort((a, b) => a.localeCompare(b)));
    } else {
      setDetailOverrideDraft([]);
    }
  }, [selectedUser]);

  const load = () => {
    setLoading(true);
    setError(null);
    followupApi
      .listUsersWithVisibility()
      .then((res) => setUsers(res.users ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : "Errore caricamento utenti"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const state = location.state as { openAddUser?: boolean } | null;
    if (state?.openAddUser) {
      setAddUserOpen(true);
      setAddUserError(null);
      setAddUserEmail("");
      setAddUserWorkspaceId("");
      setAddUserRole("collaborator");
      setAddUserMode("invite");
      setAddUserOverrideDraft([]);
      setWorkspaceProjectsForInvite([]);
      setInviteSelectedProjectIds([]);
      setAddUserWizardStep(1);
      setRoleEffectivePreview(null);
      followupApi.listWorkspaces().then((list) => setWorkspaces(Array.isArray(list) ? list : [])).catch(() => setWorkspaces([]));
      navigate(location.pathname + location.search, { replace: true, state: {} });
    }
  }, []);

  useEffect(() => {
    if (!addUserOpen || !addUserWorkspaceId) {
      if (!addUserWorkspaceId) {
        setWorkspaceProjectsForInvite([]);
        setInviteSelectedProjectIds([]);
      }
      return;
    }
    setLoadingWorkspaceProjects(true);
    followupApi
      .listWorkspaceProjects(addUserWorkspaceId)
      .then((r) => {
        const rows = (r.data ?? []) as Array<{ projectId: string; displayName?: string; name?: string }>;
        setWorkspaceProjectsForInvite(rows);
      })
      .catch(() => {
        setWorkspaceProjectsForInvite([]);
      })
      .finally(() => setLoadingWorkspaceProjects(false));
  }, [addUserOpen, addUserWorkspaceId]);

  useEffect(() => {
    if (addUserWorkspaceId) setInviteSelectedProjectIds([]);
  }, [addUserWorkspaceId]);

  useEffect(() => {
    if (!addUserOpen || addUserMode !== "invite" || workspaceProjectsForInvite.length === 0) return;
    setInviteSelectedProjectIds((prev) => (prev.length > 0 ? prev : [workspaceProjectsForInvite[0].projectId]));
  }, [addUserOpen, addUserMode, workspaceProjectsForInvite]);

  useEffect(() => {
    if (addUserMode === "existing") setInviteSelectedProjectIds([]);
  }, [addUserMode]);

  useEffect(() => {
    if (!addUserOpen) return;
    let cancelled = false;
    setRoleEffectiveLoading(true);
    followupApi
      .getRoleEffectivePermissions(addUserRole)
      .then((res) => {
        if (!cancelled) setRoleEffectivePreview(res.data?.permissions ?? null);
      })
      .catch(() => {
        if (!cancelled) setRoleEffectivePreview(null);
      })
      .finally(() => {
        if (!cancelled) setRoleEffectiveLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [addUserOpen, addUserRole]);

  const toggleInviteProject = (projectId: string, checked: boolean) => {
    setInviteSelectedProjectIds((prev) => {
      if (checked) return [...new Set([...prev, projectId])];
      return prev.filter((id) => id !== projectId);
    });
  };

  const applyRolePresetToAddUserOverrides = () => {
    const allCatalog = flattenCatalogPermissionIds(permissionCatalogGroups);
    if (!roleEffectivePreview?.length) return;
    if (roleEffectivePreview.includes("*")) {
      setAddUserOverrideDraft([...allCatalog]);
      return;
    }
    const catalogSet = new Set(allCatalog);
    setAddUserOverrideDraft(
      roleEffectivePreview.filter((p) => catalogSet.has(p)).sort((a, b) => a.localeCompare(b))
    );
  };

  const workspaceNameForWizard =
    workspaces.find((w) => w._id === addUserWorkspaceId)?.name || addUserWorkspaceId || "—";

  const canGoWizardStep2 = Boolean(addUserWorkspaceId);
  const canGoWizardStep3 =
    addUserMode === "existing" ||
    (workspaceProjectsForInvite.length > 0 && inviteSelectedProjectIds.length > 0 && !loadingWorkspaceProjects);
  const canGoWizardStep4 = addUserEmail.trim().length > 0 && Boolean(addUserRole);

  const loadUserDetail = useCallback((user: UserWithVisibilityRow) => {
    if (!user.workspaces.length) {
      setUserProjectIdsByWorkspace({});
      setWorkspaceProjectsByWorkspace({});
      setEntityAssignmentsByWorkspace({});
      return;
    }
    setDetailLoading(true);
    const userId = user.email;
    Promise.all(
      user.workspaces.map((w) =>
        Promise.all([
          followupApi.listWorkspaceUserProjects(w.workspaceId, userId).then((r) => ({ wsId: w.workspaceId, ids: r.data ?? [] })),
          followupApi.listWorkspaceProjects(w.workspaceId).then((r) => {
            const rows = r.data ?? [];
            return {
              wsId: w.workspaceId,
              projects: rows.map((p: { projectId?: string; displayName?: string; name?: string }) => ({
                projectId: p.projectId ?? "",
                displayName: p.displayName,
                name: p.name,
              })),
            };
          }),
          followupApi.listEntityAssignmentsByUser(w.workspaceId, userId).then((r) => ({
            wsId: w.workspaceId,
            assignments: (r.data ?? []) as EntityAssignmentRow[],
          })),
        ])
      )
    ).then((triples) => {
      const idsByWs: Record<string, string[]> = {};
      const projsByWs: Record<string, WorkspaceProjectOption[]> = {};
      const assignmentsByWs: Record<string, EntityAssignmentRow[]> = {};
      triples.forEach(([userProjs, wsProjs, assignRes]) => {
        idsByWs[(userProjs as { wsId: string; ids: string[] }).wsId] = (userProjs as { wsId: string; ids: string[] }).ids;
        projsByWs[(wsProjs as { wsId: string; projects: WorkspaceProjectOption[] }).wsId] = (wsProjs as { wsId: string; projects: WorkspaceProjectOption[] }).projects;
        const a = assignRes as { wsId: string; assignments: EntityAssignmentRow[] };
        assignmentsByWs[a.wsId] = a.assignments;
      });
      setUserProjectIdsByWorkspace(idsByWs);
      setWorkspaceProjectsByWorkspace(projsByWs);
      setEntityAssignmentsByWorkspace(assignmentsByWs);
    }).finally(() => setDetailLoading(false));
  }, []);

  const openUserDetail = (user: UserWithVisibilityRow) => {
    setSelectedUser(user);
    setUserProjectIdsByWorkspace({});
    setWorkspaceProjectsByWorkspace({});
    loadUserDetail(user);
  };

  const addProject = async (workspaceId: string, projectId: string) => {
    if (!selectedUser) return;
    setSavingProject(`${workspaceId}-${projectId}`);
    setAddSelectValueByWorkspace((prev) => ({ ...prev, [workspaceId]: "" }));
    try {
      await followupApi.addWorkspaceUserProject(workspaceId, selectedUser.email, projectId);
      setUserProjectIdsByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: [...(prev[workspaceId] ?? []), projectId],
      }));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore aggiunta progetto");
    } finally {
      setSavingProject(null);
    }
  };

  const removeProject = async (workspaceId: string, projectId: string) => {
    if (!selectedUser) return;
    setSavingProject(`${workspaceId}-${projectId}`);
    try {
      await followupApi.removeWorkspaceUserProject(workspaceId, selectedUser.email, projectId);
      setUserProjectIdsByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: (prev[workspaceId] ?? []).filter((id) => id !== projectId),
      }));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore rimozione progetto");
    } finally {
      setSavingProject(null);
    }
  };

  const removeAssignment = async (workspaceId: string, entityType: "client" | "apartment", entityId: string) => {
    if (!selectedUser) return;
    const key = `${workspaceId}-${entityType}-${entityId}`;
    setSavingAssignment(key);
    try {
      await followupApi.unassignEntity(workspaceId, entityType, entityId, selectedUser.email);
      setEntityAssignmentsByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: (prev[workspaceId] ?? []).filter(
          (a) => !(a.entityType === entityType && a.entityId === entityId)
        ),
      }));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore rimozione assegnazione");
    } finally {
      setSavingAssignment(null);
    }
  };

  const saveDetailPermissionOverrides = async () => {
    if (!selectedUser?.userId) return;
    setSavingPermissionsOverride(true);
    try {
      await followupApi.patchAdminUser(selectedUser.userId, { permissions_override: detailOverrideDraft });
      setSelectedUser((u) =>
        u ? { ...u, permissions_override: [...detailOverrideDraft] } : null
      );
      load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore salvataggio permessi");
    } finally {
      setSavingPermissionsOverride(false);
    }
  };

  const addAssignment = async (workspaceId: string, entityType: "client" | "apartment", entityId: string) => {
    if (!selectedUser || !entityId.trim()) return;
    const key = `${workspaceId}-${entityType}-${entityId}`;
    setSavingAssignment(key);
    try {
      await followupApi.assignEntity(workspaceId, entityType, entityId.trim(), selectedUser.email);
      setEntityAssignmentsByWorkspace((prev) => ({
        ...prev,
        [workspaceId]: [
          ...(prev[workspaceId] ?? []),
          {
            _id: "",
            workspaceId,
            entityType,
            entityId: entityId.trim(),
            userId: selectedUser.email,
          },
        ],
      }));
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Errore aggiunta assegnazione");
    } finally {
      setSavingAssignment(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">Solo gli amministratori possono visualizzare la pagina Utenti.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Utenti</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Elenco utenti con visibilità e associazioni. Usa &quot;Gestisci&quot; per configurare i progetti visibili per workspace.
        </p>
      </div>

      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          className="min-h-11"
          onClick={() => {
            setAddUserOpen(true);
            setAddUserError(null);
            setAddUserEmail("");
            setAddUserWorkspaceId("");
            setAddUserRole("collaborator");
            setAddUserMode("invite");
            setAddUserOverrideDraft([]);
            setWorkspaceProjectsForInvite([]);
            setInviteSelectedProjectIds([]);
            setAddUserWizardStep(1);
            setRoleEffectivePreview(null);
            followupApi.listWorkspaces().then((list) => setWorkspaces(Array.isArray(list) ? list : [])).catch(() => setWorkspaces([]));
          }}
        >
          Aggiungi utente (a workspace)
        </Button>
        <Button variant="outline" size="sm" className="min-h-11" onClick={load} disabled={loading}>
          Ricarica
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nessun utente trovato.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <button
              key={u.email}
              type="button"
              onClick={() => openUserDetail(u)}
              className="glass-panel rounded-ui flex flex-col items-start gap-2 p-4 text-left transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <div className="flex w-full items-center gap-2">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
                  {(u.email[0] ?? "?").toUpperCase()}
                </div>
                <span className="truncate font-medium text-foreground">{u.email}</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {u.workspaces.length === 0 ? (
                  <span className="text-xs text-muted-foreground">Nessun workspace</span>
                ) : (
                  u.workspaces.map((w) => (
                    <Badge
                      key={w.workspaceId}
                      variant={w.role === "admin" || w.role === "owner" ? "default" : "outline"}
                      className="font-normal"
                    >
                      {w.workspaceName} ({w.role})
                    </Badge>
                  ))
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <Sheet
        open={addUserOpen}
        onOpenChange={(open) => {
          setAddUserOpen(open);
          if (!open) setAddUserWizardStep(1);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Aggiungi utente a workspace</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            <p className="text-xs text-muted-foreground">
              Passo {addUserWizardStep} di 4 — workspace, progetti, anagrafica e ruolo, permessi opzionali.
            </p>

            {addUserWizardStep === 1 && (
              <>
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Tipo</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setAddUserMode("invite");
                        setAddUserError(null);
                      }}
                      className={`rounded-ui border px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                        addUserMode === "invite"
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      Invita via email (nuovo utente)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAddUserMode("existing");
                        setAddUserError(null);
                      }}
                      className={`rounded-ui border px-3 py-2.5 text-left text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring ${
                        addUserMode === "existing"
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      Già registrato (solo accesso al workspace)
                    </button>
                  </div>
                </div>
                {addUserMode === "invite" && (
                  <p className="text-xs text-muted-foreground rounded-md bg-muted/50 p-2">
                    L&apos;utente riceve un&apos;email con link per impostare la password. Serve almeno un progetto nel
                    workspace e almeno uno selezionato al passo successivo.
                  </p>
                )}
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Workspace</label>
                  <Select value={addUserWorkspaceId} onValueChange={setAddUserWorkspaceId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleziona workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((w) => (
                        <SelectItem key={w._id} value={w._id}>
                          {w.name || w._id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {addUserWizardStep === 2 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Progetti</h3>
                <p className="text-xs text-muted-foreground">
                  {addUserMode === "invite"
                    ? "Seleziona uno o più progetti. Il primo viene usato nell’email di invito; tutti vengono associati alla membership."
                    : "Opzionale: se selezioni progetti, l’utente li vede in elenco ristretto; senza selezione vede tutti i progetti del workspace."}
                </p>
                {loadingWorkspaceProjects ? (
                  <p className="text-sm text-muted-foreground">Caricamento progetti…</p>
                ) : workspaceProjectsForInvite.length === 0 ? (
                  <p className="text-sm text-destructive">
                    Nessun progetto su questo workspace. Per gli inviti associa almeno un progetto al workspace.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-[min(320px,40vh)] overflow-y-auto pr-1">
                    {workspaceProjectsForInvite.map((p) => {
                      const fieldId = `wiz-proj-${p.projectId}`;
                      return (
                        <li key={p.projectId} className="flex items-start gap-2 rounded-md border border-border/60 bg-muted/20 px-2 py-2">
                          <Checkbox
                            id={fieldId}
                            checked={inviteSelectedProjectIds.includes(p.projectId)}
                            onCheckedChange={(c) => toggleInviteProject(p.projectId, c === true)}
                            disabled={addUserSaving}
                            aria-label={p.displayName ?? p.name ?? p.projectId}
                          />
                          <label htmlFor={fieldId} className="text-sm leading-tight text-foreground cursor-pointer">
                            {p.displayName ?? p.name ?? p.projectId}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}

            {addUserWizardStep === 3 && (
              <>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">Email</label>
                  <Input
                    type="email"
                    value={addUserEmail}
                    onChange={(e) => setAddUserEmail(e.target.value.trim().toLowerCase())}
                    placeholder="es. mario.rossi@azienda.it"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground block mb-1">
                    Ruolo nel workspace{addUserMode === "invite" ? " (dopo l&apos;attivazione)" : ""}
                  </label>
                  <Select value={addUserRole} onValueChange={(v) => setAddUserRole(v as WorkspaceUserRole)}>
                    <SelectTrigger className="w-full">
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
                </div>
              </>
            )}

            {addUserWizardStep === 4 && (
              <>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm space-y-1">
                  <p>
                    <span className="text-muted-foreground">Workspace:</span> {workspaceNameForWizard}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Tipo:</span>{" "}
                    {addUserMode === "invite" ? "Invito email" : "Utente già registrato"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Progetti:</span>{" "}
                    {inviteSelectedProjectIds.length === 0
                      ? "Nessun vincolo (tutti i progetti)"
                      : `${inviteSelectedProjectIds.length} selezionati`}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Email:</span> {addUserEmail.trim() || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Ruolo:</span> {getRoleLabel(addUserRole)}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 px-3 py-2 space-y-2">
                  <p className="text-sm font-medium text-foreground">Preset dal ruolo (anteprima server)</p>
                  {roleEffectiveLoading ? (
                    <p className="text-xs text-muted-foreground">Caricamento permessi effettivi…</p>
                  ) : roleEffectivePreview?.includes("*") ? (
                    <p className="text-xs text-muted-foreground">
                      Ruolo con accesso completo. Il pulsante sotto seleziona tutte le voci presenti nel catalogo permessi.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {(roleEffectivePreview?.length ?? 0)} permessi dal ruolo (GET /rbac/roles/…/effective-permissions). Puoi
                      copiarli negli override opzionali.
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={roleEffectiveLoading || !roleEffectivePreview?.length || addUserSaving}
                    onClick={applyRolePresetToAddUserOverrides}
                  >
                    Applica preset ruolo agli override
                  </Button>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">Permessi aggiuntivi (opzionale)</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    Si sommano ai permessi del ruolo workspace. Salvati dopo la creazione / aggiunta al workspace.
                  </p>
                  <PermissionOverrideMatrix
                    groups={permissionCatalogGroups}
                    loading={permissionCatalogLoading}
                    loadError={permissionCatalogError}
                    selectedIds={addUserOverrideDraft}
                    onChange={setAddUserOverrideDraft}
                    disabled={addUserSaving}
                  />
                </div>
              </>
            )}

            {addUserError && <p className="text-sm text-destructive">{addUserError}</p>}
            <div className="flex flex-wrap gap-2 pt-2">
              {addUserWizardStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={addUserSaving}
                  onClick={() => setAddUserWizardStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
                >
                  Indietro
                </Button>
              )}
              {addUserWizardStep < 4 && (
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={
                    addUserSaving ||
                    (addUserWizardStep === 1 && !canGoWizardStep2) ||
                    (addUserWizardStep === 2 && !canGoWizardStep3) ||
                    (addUserWizardStep === 3 && !canGoWizardStep4)
                  }
                  onClick={() => {
                    if (addUserWizardStep === 1 && !canGoWizardStep2) return;
                    if (addUserWizardStep === 2 && !canGoWizardStep3) return;
                    if (addUserWizardStep === 3 && !canGoWizardStep4) return;
                    setAddUserWizardStep((s) => (s < 4 ? ((s + 1) as 1 | 2 | 3 | 4) : s));
                  }}
                >
                  Avanti
                </Button>
              )}
              {addUserWizardStep === 4 && (
                <Button
                  className="min-h-11"
                  disabled={
                    !addUserWorkspaceId ||
                    !addUserEmail.trim() ||
                    addUserSaving ||
                    (addUserMode === "invite" &&
                      (workspaceProjectsForInvite.length === 0 ||
                        inviteSelectedProjectIds.length === 0 ||
                        loadingWorkspaceProjects))
                  }
                  onClick={async () => {
                    setAddUserSaving(true);
                    setAddUserError(null);
                    const email = addUserEmail.trim();
                    const primaryProjectId = inviteSelectedProjectIds[0] ?? "";
                    try {
                      const applyOverridesIfAny = async (mongoUserId: string | null | undefined) => {
                        if (addUserOverrideDraft.length === 0 || !mongoUserId) return;
                        await followupApi.patchAdminUser(mongoUserId, {
                          permissions_override: addUserOverrideDraft,
                        });
                      };
                      const attachProjects = async () => {
                        for (const pid of inviteSelectedProjectIds) {
                          await followupApi.addWorkspaceUserProject(addUserWorkspaceId, email, pid);
                        }
                      };
                      if (addUserMode === "invite") {
                        const dup = users.some((u) => u.email.toLowerCase() === email.toLowerCase());
                        if (dup) {
                          setAddUserError(
                            'Questa email è già in elenco. Usa "Già registrato" oppure un\'altra email.'
                          );
                          setAddUserSaving(false);
                          return;
                        }
                        const proj = workspaceProjectsForInvite.find((p) => p.projectId === primaryProjectId);
                        const projectName = proj?.displayName ?? proj?.name ?? primaryProjectId;
                        const { userId: invitedMongoId } = await followupApi.inviteUser({
                          email,
                          projectId: primaryProjectId,
                          projectName,
                          roleLabel: getRoleLabel(addUserRole),
                        });
                        try {
                          await followupApi.addWorkspaceUser(addUserWorkspaceId, { userId: email, role: addUserRole });
                          await attachProjects();
                        } catch (e2) {
                          setAddUserError(
                            `Invito inviato, ma aggiunta al workspace fallita: ${e2 instanceof Error ? e2.message : "errore"}. Aggiungi l'utente al workspace dopo l'attivazione.`
                          );
                          await applyOverridesIfAny(invitedMongoId);
                          load();
                          return;
                        }
                        await applyOverridesIfAny(invitedMongoId);
                      } else {
                        await followupApi.addWorkspaceUser(addUserWorkspaceId, { userId: email, role: addUserRole });
                        await attachProjects();
                        if (addUserOverrideDraft.length > 0) {
                          const fresh = await followupApi.listUsersWithVisibility();
                          const row = fresh.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
                          if (row?.userId) {
                            await followupApi.patchAdminUser(row.userId, {
                              permissions_override: addUserOverrideDraft,
                            });
                          }
                        }
                      }
                      load();
                      setAddUserOpen(false);
                      setAddUserOverrideDraft([]);
                      setAddUserWizardStep(1);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "Errore";
                      setAddUserError(msg.includes("409") || msg.toLowerCase().includes("già") ? msg : msg);
                    } finally {
                      setAddUserSaving(false);
                    }
                  }}
                >
                  {addUserSaving ? "Invio…" : addUserMode === "invite" ? "Invita e aggiungi al workspace" : "Aggiungi"}
                </Button>
              )}
              <Button
                variant="outline"
                className="min-h-11"
                disabled={addUserSaving}
                onClick={() => {
                  setAddUserOpen(false);
                  setAddUserWizardStep(1);
                }}
              >
                Annulla
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Dettaglio e permessi</SheetTitle>
          </SheetHeader>
          {selectedUser && (
            <div className="mt-4 space-y-6">
              <div className="rounded-ui border border-border bg-muted/30 px-3 py-2">
                <p className="font-medium text-foreground">{selectedUser.email}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedUser.workspaces.length} workspace · ruolo max:{" "}
                  {getMaxWorkspaceRole(selectedUser.workspaces.map((w) => w.role))}
                </p>
              </div>

              <div className="glass-panel rounded-ui space-y-3 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Ruolo per workspace</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Il ruolo determina i permessi dell&apos;utente in quel workspace.
                  </p>
                </div>
                {selectedUser.workspaces.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun workspace.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedUser.workspaces.map((w) => (
                      <li key={w.workspaceId} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2">
                        <span className="text-sm font-medium text-foreground">{w.workspaceName}</span>
                        <Select
                          value={w.role}
                          onValueChange={async (newRole) => {
                            setSavingRoleWorkspaceId(w.workspaceId);
                            try {
                              await followupApi.updateWorkspaceUser(w.workspaceId, selectedUser.email, { role: newRole as WorkspaceUserRole });
                              setSelectedUser((u) => (u ? { ...u, workspaces: u.workspaces.map((x) => (x.workspaceId === w.workspaceId ? { ...x, role: newRole } : x)) } : null));
                              load();
                            } catch {
                              toastError("Errore aggiornamento ruolo");
                            } finally {
                              setSavingRoleWorkspaceId(null);
                            }
                          }}
                          disabled={savingRoleWorkspaceId !== null}
                        >
                          <SelectTrigger className="w-36 h-8">
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
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="glass-panel rounded-ui space-y-3 p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Permessi aggiuntivi (override)</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Si sommano ai permessi derivati dai ruoli workspace. Serve un profilo utente in{" "}
                    <span className="font-mono text-[11px]">tz_users</span> (id Mongo).
                  </p>
                </div>
                {!selectedUser.userId ? (
                  <p className="text-sm text-muted-foreground">
                    Profilo non presente: gli override non sono disponibili per questo record (solo membership o email
                    senza account).
                  </p>
                ) : (
                  <>
                    <PermissionOverrideMatrix
                      groups={permissionCatalogGroups}
                      loading={permissionCatalogLoading}
                      loadError={permissionCatalogError}
                      selectedIds={detailOverrideDraft}
                      onChange={setDetailOverrideDraft}
                      disabled={savingPermissionsOverride}
                    />
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        size="sm"
                        className="min-h-11"
                        disabled={
                          savingPermissionsOverride ||
                          !permissionOverrideDraftDirty(detailOverrideDraft, selectedUser.permissions_override)
                        }
                        onClick={saveDetailPermissionOverrides}
                      >
                        {savingPermissionsOverride ? "Salvataggio…" : "Salva permessi aggiuntivi"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={
                          savingPermissionsOverride ||
                          !permissionOverrideDraftDirty(detailOverrideDraft, selectedUser.permissions_override)
                        }
                        onClick={() =>
                          setDetailOverrideDraft(
                            [...(selectedUser.permissions_override ?? [])].sort((a, b) => a.localeCompare(b))
                          )
                        }
                      >
                        Annulla modifiche
                      </Button>
                    </div>
                  </>
                )}
              </div>

              <div className="glass-panel rounded-ui space-y-3 p-4">
                <h3 className="text-sm font-semibold text-foreground">Progetti visibili</h3>
                <p className="text-xs text-muted-foreground">
                  Se nessun progetto è associato per un workspace, l’utente vede tutti i progetti del workspace.
                </p>
                {detailLoading ? (
                  <p className="text-sm text-muted-foreground">Caricamento progetti...</p>
                ) : (
                  selectedUser.workspaces.map((w) => {
                    const projectIds = userProjectIdsByWorkspace[w.workspaceId] ?? [];
                    const allProjects = workspaceProjectsByWorkspace[w.workspaceId] ?? [];
                    const availableToAdd = allProjects.filter((p) => !projectIds.includes(p.projectId));
                    return (
                      <div key={w.workspaceId} className="mb-6">
                        <h4 className="text-sm font-medium text-foreground mb-2">
                          Progetti visibili – {w.workspaceName}
                        </h4>
                        <ul className="space-y-1 mb-2">
                          {projectIds.length === 0 ? (
                            <li className="text-sm text-muted-foreground">Tutti i progetti del workspace</li>
                          ) : (
                            projectIds.map((pid) => {
                              const proj = allProjects.find((p) => p.projectId === pid);
                              const label = proj?.displayName ?? proj?.name ?? pid;
                              return (
                                <li key={pid} className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm">
                                  <span>{label}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="min-h-11 text-muted-foreground hover:text-destructive"
                                    disabled={savingProject !== null}
                                    onClick={() => removeProject(w.workspaceId, pid)}
                                  >
                                    Rimuovi
                                  </Button>
                                </li>
                              );
                            })
                          )}
                        </ul>
                        {availableToAdd.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Select
                              value={addSelectValueByWorkspace[w.workspaceId] ?? ""}
                              onValueChange={(projectId) => {
                                if (projectId) addProject(w.workspaceId, projectId);
                              }}
                            >
                              <SelectTrigger className="w-56">
                                <SelectValue placeholder="Aggiungi progetto" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableToAdd.map((p) => (
                                  <SelectItem key={p.projectId} value={p.projectId}>
                                    {p.displayName ?? p.name ?? p.projectId}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Clienti / Appartamenti assegnati</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Assegnazioni per workspace. Per assegnare altri clienti o appartamenti usa la scheda Cliente o Appartamento.
                </p>
                {detailLoading ? (
                  <p className="text-sm text-muted-foreground">Caricamento...</p>
                ) : (
                  selectedUser.workspaces.map((w) => {
                    const assignments = entityAssignmentsByWorkspace[w.workspaceId] ?? [];
                    return (
                      <div key={w.workspaceId} className="mb-4">
                        <h4 className="text-sm font-medium text-foreground mb-1.5">{w.workspaceName}</h4>
                        {assignments.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nessuna assegnazione</p>
                        ) : (
                          <ul className="space-y-1">
                            {assignments.map((a) => (
                              <li
                                key={a._id || `${a.entityType}-${a.entityId}`}
                                className="flex items-center justify-between rounded-md bg-muted/50 px-2 py-1.5 text-sm"
                              >
                                <span>
                                  {a.entityType === "client" ? "Cliente" : "Appartamento"}: {a.entityId}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="min-h-11 text-muted-foreground hover:text-destructive"
                                  disabled={savingAssignment !== null}
                                  onClick={() =>
                                    removeAssignment(
                                      w.workspaceId,
                                      a.entityType as "client" | "apartment",
                                      a.entityId
                                    )
                                  }
                                >
                                  Rimuovi
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};
