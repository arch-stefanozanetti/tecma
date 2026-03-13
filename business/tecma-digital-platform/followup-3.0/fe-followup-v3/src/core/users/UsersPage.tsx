/**
 * Pagina User (solo admin): elenco utenti con visibilità e associazioni.
 * Sheet dettaglio utente: gestione progetti visibili per workspace.
 */
import { useCallback, useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { UserWithVisibilityRow } from "../../types/domain";
import { useWorkspace } from "../../auth/projectScope";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";

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
  const { isAdmin } = useWorkspace();
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
      window.alert(e instanceof Error ? e.message : "Errore aggiunta progetto");
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
      window.alert(e instanceof Error ? e.message : "Errore rimozione progetto");
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
      window.alert(e instanceof Error ? e.message : "Errore rimozione assegnazione");
    } finally {
      setSavingAssignment(null);
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
      window.alert(e instanceof Error ? e.message : "Errore aggiunta assegnazione");
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

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
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
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left font-semibold p-3">Email</th>
                <th className="text-left font-semibold p-3">Ruolo globale</th>
                <th className="text-left font-semibold p-3">Workspace e ruoli</th>
                <th className="text-left font-semibold p-3">Progetti (legacy)</th>
                <th className="text-left font-semibold p-3 w-24">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email} className="border-b border-border last:border-0 hover:bg-muted/20">
                  <td className="p-3 font-medium text-foreground">{u.email}</td>
                  <td className="p-3">
                    {u.isAdmin ? (
                      <Badge variant="default">Admin</Badge>
                    ) : u.role ? (
                      <span className="text-muted-foreground">{u.role}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    {u.workspaces.length === 0 ? (
                      <span className="text-muted-foreground">Nessuno</span>
                    ) : (
                      <ul className="flex flex-wrap gap-1">
                        {u.workspaces.map((w) => (
                          <li key={w.workspaceId}>
                            <Badge variant="outline" className="font-normal">
                              {w.workspaceName} ({w.role})
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="p-3">
                    {u.projectIds.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span className="text-muted-foreground">{u.projectIds.length} progetto/i</span>
                    )}
                  </td>
                  <td className="p-3">
                    <Button variant="outline" size="sm" onClick={() => openUserDetail(u)}>
                      Gestisci
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={!!selectedUser} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Dettaglio utente: {selectedUser?.email ?? ""}</SheetTitle>
          </SheetHeader>
          {selectedUser && (
            <div className="mt-4 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Workspace e ruoli</h3>
                {selectedUser.workspaces.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nessun workspace.</p>
                ) : (
                  <ul className="flex flex-wrap gap-1">
                    {selectedUser.workspaces.map((w) => (
                      <li key={w.workspaceId}>
                        <Badge variant="outline">{w.workspaceName} ({w.role})</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-3">
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
                                    className="h-7 text-muted-foreground hover:text-destructive"
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
                                  className="h-7 text-muted-foreground hover:text-destructive"
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
