/**
 * Calendario disponibilità / listini (matrice) embeddato in Appartamenti → Affitto.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { followupApi } from "../../api/followupApi";
import { Button } from "../../components/ui/button";
import { DateInput } from "../../components/ui/date-input";
import { Input } from "../../components/ui/input";
import { PriceAvailabilityGrid, type MatrixUnit } from "../prices/PriceAvailabilityGrid";

const toYMD = (d: Date) => d.toISOString().split("T")[0];

export type ApartmentsRentAvailabilityCalendarProps = {
  workspaceId: string;
  projectIds: string[];
  canCreateRequest: boolean;
  onOpenRequest: (requestId: string) => void;
  onNewNegotiation: (payload: { apartmentId: string; projectId: string }) => void;
};

export function ApartmentsRentAvailabilityCalendar({
  workspaceId,
  projectIds,
  canCreateRequest,
  onOpenRequest,
  onNewNegotiation,
}: ApartmentsRentAvailabilityCalendarProps) {
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
  const [cells, setCells] = useState<Record<string, Record<string, { price?: number; availability?: string; minStay?: number }>>>(
    {}
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unitSearch, setUnitSearch] = useState("");

  const load = useCallback(() => {
    if (!workspaceId || projectIds.length === 0 || !dateFrom || !dateTo) return;
    setLoading(true);
    setError(null);
    followupApi
      .getPriceAvailabilityMatrix(workspaceId, projectIds, dateFrom, dateTo, { onlyRent: true })
      .then((res) => {
        setUnits((res.units ?? []) as MatrixUnit[]);
        setDates(res.dates ?? []);
        setCells(res.cells ?? {});
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Errore caricamento calendario");
        setUnits([]);
        setDates([]);
        setCells({});
      })
      .finally(() => setLoading(false));
  }, [workspaceId, projectIds, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredUnits = useMemo(() => {
    const q = unitSearch.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) => u.code.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q))
    );
  }, [units, unitSearch]);

  const handleSave = useCallback(
    async (
      unitId: string,
      date: string,
      payload: { price: number; minStay?: number; availability?: "available" | "blocked" | "reserved" }
    ) => {
      await followupApi.upsertApartmentPriceCalendar(unitId, workspaceId, { date, ...payload });
    },
    [workspaceId]
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Disponibilità, blocchi e listini per unità in affitto. Stesso dato della sezione Prezzi e disponibilità.
      </p>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">Da</label>
          <DateInput
            aria-label="Calendario affitti da"
            className="w-40 min-w-[10rem]"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-foreground">A</label>
          <DateInput
            aria-label="Calendario affitti a"
            className="w-40 min-w-[10rem]"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" className="min-h-11" type="button" onClick={load} disabled={loading}>
          {loading ? "Caricamento..." : "Carica"}
        </Button>
      </div>

      <div className="max-w-md">
        <label className="mb-1 block text-xs font-medium text-foreground">Filtra unità (codice o nome)</label>
        <Input
          className="min-h-11 rounded-lg border-border"
          placeholder="Es. A-12 o piano…"
          value={unitSearch}
          onChange={(e) => setUnitSearch(e.target.value)}
          aria-label="Filtra appartamenti nel calendario"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loading && units.length === 0 ? (
        <p className="text-sm text-muted-foreground">Caricamento calendario…</p>
      ) : filteredUnits.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {units.length === 0
            ? "Nessuna unità in affitto nel periodo. Verifica progetti e date."
            : "Nessuna unità corrisponde al filtro."}
        </p>
      ) : (
        <PriceAvailabilityGrid
          units={filteredUnits}
          dates={dates}
          cells={cells}
          onSave={handleSave}
          onRefresh={load}
          showLegend
          compact
          onOpenRentRequest={onOpenRequest}
          onNewRentNegotiation={
            canCreateRequest
              ? (u) => {
                  const projectId = u.projectId?.trim();
                  if (!projectId) return;
                  onNewNegotiation({ apartmentId: u.unitId, projectId });
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
