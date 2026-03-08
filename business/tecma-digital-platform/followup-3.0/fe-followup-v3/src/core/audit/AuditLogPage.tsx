/**
 * Pagina Audit log: tabella filtrata per workspace, progetto, entità, attore, date. Export CSV.
 * Solo admin.
 */
import { useCallback, useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

const ENTITY_TYPES = ["client", "apartment", "request", "association", "calendar_event"] as const;
const ACTIONS = [
  "client.created",
  "client.updated",
  "apartment.created",
  "apartment.updated",
  "request.created",
  "request.status_changed",
  "association.created",
  "association.deleted",
] as const;

const formatDate = (s: string) => {
  try {
    const d = new Date(s);
    return d.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "medium" });
  } catch {
    return s;
  }
};

export const AuditLogPage = () => {
  const { workspaceId } = useWorkspace();
  const [data, setData] = useState<Array<{
    _id: string;
    at: string;
    action: string;
    entityType: string;
    entityId: string;
    actor: { type: string; userId?: string; email?: string };
    payload?: Record<string, unknown>;
  }>>([]);
  const [pagination, setPagination] = useState({ page: 1, perPage: 25, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    projectId: "",
    entityType: "",
    entityId: "",
    actorUserId: "",
    action: "",
    dateFrom: "",
    dateTo: "",
  });

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const res = await followupApi.queryAuditLog({
        workspaceId,
        projectId: filters.projectId || undefined,
        entityType: filters.entityType || undefined,
        entityId: filters.entityId || undefined,
        actorUserId: filters.actorUserId || undefined,
        action: filters.action || undefined,
        dateFrom: filters.dateFrom || undefined,
        dateTo: filters.dateTo || undefined,
        page: pagination.page,
        perPage: pagination.perPage,
      });
      setData(res.data ?? []);
      setPagination(res.pagination ?? { page: 1, perPage: 25, total: 0, totalPages: 0 });
    } catch (e) {
      console.error(e);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, filters, pagination.page, pagination.perPage]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExportCsv = () => {
    const headers = ["Data", "Azione", "Entità", "ID", "Attore", "Dettagli"];
    const rows = data.map((r) => [
      formatDate(r.at),
      r.action,
      r.entityType,
      r.entityId,
      r.actor?.email ?? r.actor?.userId ?? r.actor?.type ?? "",
      JSON.stringify(r.payload ?? {}),
    ]);
    const csv = [headers.join(","), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${workspaceId}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-full bg-app font-body text-foreground">
      <div className="px-5 pb-10 pt-8 lg:px-20">
        <h1 className="text-2xl font-semibold text-foreground">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tracciamento CRUD su clienti, appartamenti, richieste, associazioni.
        </p>

        <div className="mt-6 flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Progetto</label>
            <Input
              value={filters.projectId}
              onChange={(e) => setFilters((f) => ({ ...f, projectId: e.target.value }))}
              placeholder="ID progetto"
              className="w-40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo entità</label>
            <select
              value={filters.entityType}
              onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm w-36"
            >
              <option value="">Tutti</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Azione</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm w-48"
            >
              <option value="">Tutte</option>
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Da data</label>
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              className="w-36"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">A data</label>
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              className="w-36"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button onClick={() => setPagination((p) => ({ ...p, page: 1 }))}>Applica</Button>
            <Button variant="outline" onClick={handleExportCsv} disabled={data.length === 0}>
              Export CSV
            </Button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          {loading ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Caricamento…</div>
          ) : data.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Nessun evento.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium">Data</th>
                  <th className="px-4 py-2 text-left font-medium">Azione</th>
                  <th className="px-4 py-2 text-left font-medium">Entità</th>
                  <th className="px-4 py-2 text-left font-medium">ID</th>
                  <th className="px-4 py-2 text-left font-medium">Attore</th>
                  <th className="px-4 py-2 text-left font-medium">Dettagli</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r._id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(r.at)}</td>
                    <td className="px-4 py-2">{r.action}</td>
                    <td className="px-4 py-2">{r.entityType}</td>
                    <td className="px-4 py-2 font-mono text-xs truncate max-w-[120px]" title={r.entityId}>{r.entityId}</td>
                    <td className="px-4 py-2">{r.actor?.email ?? r.actor?.userId ?? r.actor?.type ?? "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate" title={JSON.stringify(r.payload)}>
                      {r.payload ? JSON.stringify(r.payload) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Pagina {pagination.page} di {pagination.totalPages} ({pagination.total} totali)
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
              >
                Precedente
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
              >
                Successiva
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
