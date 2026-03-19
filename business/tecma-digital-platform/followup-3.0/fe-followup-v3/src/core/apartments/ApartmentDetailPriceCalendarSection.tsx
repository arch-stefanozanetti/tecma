import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { PriceAvailabilityGrid, type MatrixUnit, type MatrixCell } from "../prices/PriceAvailabilityGrid";
import { followupApi } from "../../api/followupApi";

export interface ApartmentDetailPriceCalendarSectionProps {
  workspaceId: string | undefined;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  loading: boolean;
  error: string | null;
  matrixUnits: MatrixUnit[];
  matrixDates: string[];
  matrixCells: Record<string, Record<string, MatrixCell>>;
  onLoadMatrix: () => void;
}

export function ApartmentDetailPriceCalendarSection({
  workspaceId,
  from,
  to,
  onFromChange,
  onToChange,
  loading,
  error,
  matrixUnits,
  matrixDates,
  matrixCells,
  onLoadMatrix,
}: ApartmentDetailPriceCalendarSectionProps) {
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:col-span-2">
      <h2 className="text-sm font-semibold text-foreground">Prezzi per data</h2>
      <p className="text-xs text-muted-foreground">
        Calendario prezzi e disponibilità (short stay). Scegli il periodo, carica la griglia e clicca su una cella per
        modificare prezzo e disponibilità.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Da</label>
          <Input type="date" className="h-8 w-36" value={from} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onFromChange(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-medium text-foreground block mb-1">A</label>
          <Input type="date" className="h-8 w-36" value={to} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onToChange(e.target.value)} />
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onLoadMatrix} disabled={loading}>
          {loading ? "Caricamento..." : "Carica calendario"}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && matrixUnits.length === 0 ? (
        <p className="text-sm text-muted-foreground">Caricamento calendario...</p>
      ) : matrixUnits.length > 0 ? (
        <div className="space-y-3">
          <PriceAvailabilityGrid
            units={matrixUnits}
            dates={matrixDates}
            cells={matrixCells}
            onSave={async (unitId, date, payload) => {
              if (!workspaceId) return;
              await followupApi.upsertApartmentPriceCalendar(unitId, workspaceId, { date, ...payload });
            }}
            onRefresh={onLoadMatrix}
            showLegend
            compact={false}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nessun dato calendario per questo periodo. Verifica le date o riprova.
        </p>
      )}
    </div>
  );
}
