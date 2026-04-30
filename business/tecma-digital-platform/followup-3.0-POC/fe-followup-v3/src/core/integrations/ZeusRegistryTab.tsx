import { useCallback, useEffect, useState } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Download, RefreshCw, Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Alert } from "../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "../../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { followupApi } from "../../api/followupApi";
import { useToast } from "../../contexts/ToastContext";

type TurnRow = Awaited<ReturnType<typeof followupApi.listZeusTurns>>["data"][number];
type Stats = Awaited<ReturnType<typeof followupApi.getZeusTurnsStats>>["data"];

type FilterState = {
  q: string;
  channel: "all" | "voice" | "whatsapp" | "email" | "chat";
  direction: "all" | "in" | "out";
  dateFrom: string;
  dateTo: string;
};

const initialFilters: FilterState = {
  q: "",
  channel: "all",
  direction: "all",
  dateFrom: "",
  dateTo: ""
};

function channelLabel(ch: TurnRow["channel"]): string {
  switch (ch) {
    case "chat":
      return "Chat / ingest";
    case "voice":
      return "Voce";
    case "whatsapp":
      return "WhatsApp";
    case "email":
      return "Email";
    default:
      return ch;
  }
}

function escapeCsvCell(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function ZeusRegistryTab({ workspaceId, readOnly: _readOnly }: { workspaceId: string; readOnly?: boolean }) {
  void _readOnly;
  const { toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<FilterState>(initialFilters);
  const [applied, setApplied] = useState<FilterState>(initialFilters);
  const [page, setPage] = useState(1);
  const perPage = 25;

  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<TurnRow[]>([]);
  const [pagination, setPagination] = useState<Awaited<ReturnType<typeof followupApi.listZeusTurns>>["paginationInfo"] | null>(
    null
  );

  const load = useCallback(() => {
    if (!workspaceId) return;
    setLoading(true);
    const statParams =
      applied.dateFrom || applied.dateTo
        ? { dateFrom: applied.dateFrom || undefined, dateTo: applied.dateTo || undefined }
        : undefined;
    Promise.all([
      followupApi.getZeusTurnsStats(workspaceId, statParams),
      followupApi.listZeusTurns(workspaceId, {
        page,
        perPage,
        q: applied.q.trim() || undefined,
        channel: applied.channel,
        direction: applied.direction,
        dateFrom: applied.dateFrom || undefined,
        dateTo: applied.dateTo || undefined,
        sortOrder: -1
      })
    ])
      .then(([s, list]) => {
        setStats(s.data);
        setRows(list.data);
        setPagination(list.paginationInfo);
      })
      .catch(() => toastError("Impossibile caricare il registro ZEUS"))
      .finally(() => setLoading(false));
  }, [workspaceId, page, perPage, applied, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = () => {
    setApplied({ ...draft });
    setPage(1);
  };

  const exportCsv = () => {
    const header = ["id", "createdAt", "channel", "direction", "charCount", "wordCount", "externalId", "text"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.id,
          r.createdAt,
          r.channel,
          r.direction,
          String(r.charCount),
          String(r.wordCount),
          r.externalId ?? "",
          escapeCsvCell(r.text)
        ].join(",")
      )
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zeus-turns-${workspaceId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <Alert variant="info" title="Registro conversazioni e metriche">
        <span className="text-sm">
          Qui trovi tutto ciò che è entrato/uscito da ZEUS (voce trascritta, WhatsApp, email, chat). Usa i filtri e il CSV per
          costruire dataset per fine-tuning o revisione qualità. Le &quot;coppie&quot; sono stimate (in→out consecutivi, stesso
          canale, entro 10 minuti).
        </span>
      </Alert>

      {loading && !stats ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : stats ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
              <BarChart3 className="h-4 w-4" />
              Turni totali (filtro date)
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.totalTurns}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Ingresso medio</p>
            <p className="mt-2 text-sm text-foreground">
              {stats.inbound.count ? (
                <>
                  <span className="font-semibold tabular-nums">{stats.inbound.avgChars}</span> caratteri,{" "}
                  <span className="font-semibold tabular-nums">{stats.inbound.avgWords}</span> parole
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stats.inbound.count} messaggi in</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Uscita media (ZEUS)</p>
            <p className="mt-2 text-sm text-foreground">
              {stats.outbound.count ? (
                <>
                  <span className="font-semibold tabular-nums">{stats.outbound.avgChars}</span> caratteri,{" "}
                  <span className="font-semibold tabular-nums">{stats.outbound.avgWords}</span> parole
                </>
              ) : (
                "—"
              )}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{stats.outbound.count} messaggi out</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Coppie conversazione (stima)</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{stats.estimatedConversationPairs}</p>
          </div>
        </div>
      ) : null}

      {stats && Object.keys(stats.byChannel).length > 0 ? (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
          <span className="font-medium text-foreground">Per canale: </span>
          {(["voice", "whatsapp", "email", "chat"] as const)
            .map((c) => (stats.byChannel[c] ? `${channelLabel(c)}: ${stats.byChannel[c]}` : null))
            .filter(Boolean)
            .join(" · ") || "—"}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-4 space-y-4">
        <h3 className="text-sm font-medium">Filtri e ricerca</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground">Testo (contiene)</label>
            <div className="flex gap-2 mt-1">
              <Input
                value={draft.q}
                onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                placeholder="Cerca nel contenuto…"
                className="text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyFilters();
                }}
              />
              <Button type="button" variant="secondary" size="icon" onClick={applyFilters} title="Cerca">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Canale</label>
            <Select
              value={draft.channel}
              onValueChange={(v) => setDraft((d) => ({ ...d, channel: v as FilterState["channel"] }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tutti</SelectItem>
                <SelectItem value="voice">Voce</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="chat">Chat / ingest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Direzione</label>
            <Select
              value={draft.direction}
              onValueChange={(v) => setDraft((d) => ({ ...d, direction: v as FilterState["direction"] }))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entrambe</SelectItem>
                <SelectItem value="in">In (utente)</SelectItem>
                <SelectItem value="out">Out (ZEUS)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Da data</label>
            <Input
              type="date"
              value={draft.dateFrom}
              onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">A data</label>
            <Input
              type="date"
              value={draft.dateTo}
              onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value }))}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={applyFilters} disabled={loading}>
            Applica filtri
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Aggiorna
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Esporta pagina CSV
          </Button>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-medium mb-2">Messaggi</h3>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="p-2 font-medium whitespace-nowrap">Quando</th>
                <th className="p-2 font-medium">Canale</th>
                <th className="p-2 font-medium">Dir</th>
                <th className="p-2 font-medium">Lunghezza</th>
                <th className="p-2 font-medium min-w-[200px]">Anteprima</th>
                <th className="p-2 font-medium">Dettaglio</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-4 text-muted-foreground text-center">
                    Caricamento…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-muted-foreground text-center">
                    Nessun messaggio con questi filtri.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/80 align-top">
                    <td className="p-2 whitespace-nowrap text-xs">{row.createdAt}</td>
                    <td className="p-2 text-xs">{channelLabel(row.channel)}</td>
                    <td className="p-2">{row.direction}</td>
                    <td className="p-2 text-xs tabular-nums">
                      {row.charCount} cc / {row.wordCount} parole
                    </td>
                    <td className="p-2 max-w-md text-xs text-muted-foreground line-clamp-2">{row.text}</td>
                    <td className="p-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button type="button" variant="ghost" size="sm">
                            Apri
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>
                              {channelLabel(row.channel)} — {row.direction === "in" ? "Ingresso" : "Risposta ZEUS"}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2 text-sm">
                            <p className="text-xs text-muted-foreground">{row.createdAt}</p>
                            {row.externalId ? (
                              <p className="text-xs">
                                ID esterno: <code className="rounded bg-muted px-1">{row.externalId}</code>
                              </p>
                            ) : null}
                            <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-foreground text-sm">
                              {row.text}
                            </pre>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
            <span>
              Pagina {pagination.page} di {pagination.totalPages} ({pagination.totalDocs} turni)
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
