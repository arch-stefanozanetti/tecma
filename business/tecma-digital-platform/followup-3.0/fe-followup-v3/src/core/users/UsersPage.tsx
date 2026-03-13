/**
 * Pagina User (solo admin): elenco utenti con visibilità e associazioni.
 */
import { useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { UserWithVisibilityRow } from "../../types/domain";
import { useWorkspace } from "../../auth/projectScope";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";

export const UsersPage = () => {
  const { isAdmin } = useWorkspace();
  const [users, setUsers] = useState<UserWithVisibilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          Elenco utenti con visibilità e associazioni: ruolo globale, workspace e ruoli, progetti (legacy).
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
