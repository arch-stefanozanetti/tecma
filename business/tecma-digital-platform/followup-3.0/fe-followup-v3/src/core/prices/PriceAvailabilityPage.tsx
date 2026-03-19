/**
 * Pannello prezzi e disponibilità: griglia appartamenti × date, stile backoffice.
 * Clic su cella apre drawer per modificare prezzo e disponibilità per quella data.
 */
import { useCallback, useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import { useWorkspace } from "../../auth/projectScope";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { PriceAvailabilityGrid, type MatrixUnit, type MatrixCell } from "./PriceAvailabilityGrid";

const toYMD = (d: Date) => d.toISOString().split("T")[0];

export const PriceAvailabilityPage = () => {
  const { workspaceId, selectedProjectIds } = useWorkspace();
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toYMD(d);
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(0);
    return toYMD(d);
  });
  const [units, setUnits] = useState<MatrixUnit[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [cells, setCells] = useState<Record<string, Record<string, MatrixCell>>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!workspaceId || selectedProjectIds.length === 0 || !dateFrom || !dateTo) return;
    setLoading(true);
    setError(null);
    followupApi
      .getPriceAvailabilityMatrix(workspaceId, selectedProjectIds, dateFrom, dateTo)
      .then((res) => {
        setUnits(res.units ?? []);
        setDates(res.dates ?? []);
        setCells(res.cells ?? {});
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Errore caricamento matrice");
        setUnits([]);
        setDates([]);
        setCells({});
      })
      .finally(() => setLoading(false));
  }, [workspaceId, selectedProjectIds, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(
    async (
      unitId: string,
      date: string,
      payload: { price: number; minStay?: number; availability?: "available" | "blocked" | "reserved" }
    ) => {
      if (!workspaceId) return;
      await followupApi.upsertApartmentPriceCalendar(unitId, workspaceId, { date, ...payload });
    },
    [workspaceId]
  );

  return (
    <div className="min-h-full bg-background font-body text-foreground">
      <div className="mx-auto max-w-[1600px] space-y-6 p-6">
        <header className="space-y-1">
          <h1 className="text-xl font-semibold text-foreground">Prezzi e disponibilità</h1>
          <p className="text-sm text-muted-foreground">
            Calendario listini e disponibilità per data. Clicca su una cella per modificare prezzo e disponibilità (affitto breve / short stay).
          </p>
        </header>

        <div className="flex flex-wrap items-end gap-4 rounded-lg border border-border bg-card p-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">Da</label>
            <Input
              type="date"
              className="w-40"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">A</label>
            <Input
              type="date"
              className="w-40"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="min-h-11" onClick={load} disabled={loading}>
            {loading ? "Caricamento..." : "Carica"}
          </Button>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {loading && units.length === 0 ? (
          <p className="text-sm text-muted-foreground">Caricamento...</p>
        ) : units.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nessun appartamento nel periodo selezionato. Verifica filtri progetto e date.</p>
        ) : (
          <div className="space-y-4">
            {dates.length > 5 && (
              <p className="text-xs text-muted-foreground md:hidden">Scorri orizzontalmente per vedere tutte le date.</p>
            )}
            <PriceAvailabilityGrid
              units={units}
              dates={dates}
              cells={cells}
              onSave={handleSave}
              onRefresh={load}
              showLegend
              compact={false}
            />
          </div>
        )}
      </div>
    </div>
  );
};
