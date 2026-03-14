/**
 * Griglia calendario prezzi × disponibilità riutilizzabile.
 * Usata in Prezzi e disponibilità (tutti gli appartamenti) e in Scheda appartamento (singola unità).
 */
import { useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerBody,
  DrawerFooter,
  DrawerCloseButton,
} from "../../components/ui/drawer";
import { cn } from "../../lib/utils";

export type AvailabilityKey = "available" | "blocked" | "reserved" | "locked" | "sold";

export const AVAILABILITY_LABELS: Record<AvailabilityKey, string> = {
  available: "Disponibile",
  blocked: "Bloccato",
  reserved: "Riservato",
  locked: "In trattativa",
  sold: "Venduto/Affittato",
};

export const AVAILABILITY_CLASS: Record<AvailabilityKey, string> = {
  available: "bg-emerald-100 text-emerald-800 border-emerald-200",
  blocked: "bg-muted text-muted-foreground border-border",
  reserved: "bg-amber-100 text-amber-800 border-amber-200",
  locked: "bg-red-100 text-red-800 border-red-200",
  sold: "bg-slate-200 text-slate-800 border-slate-300",
};

export interface MatrixUnit {
  unitId: string;
  code: string;
  name: string;
  mode?: string;
}

export interface MatrixCell {
  price?: number;
  availability?: string;
  minStay?: number;
}

export interface PriceAvailabilityGridProps {
  units: MatrixUnit[];
  dates: string[];
  cells: Record<string, Record<string, MatrixCell>>;
  onSave: (
    unitId: string,
    date: string,
    payload: { price: number; minStay?: number; availability?: "available" | "blocked" | "reserved" }
  ) => Promise<void>;
  onRefresh: () => void;
  /** Mostra legenda colori sopra la tabella (default true) */
  showLegend?: boolean;
  /** Layout compatto per embed in scheda (meno padding, legenda compatta) */
  compact?: boolean;
}

export const PriceAvailabilityGrid = ({
  units,
  dates,
  cells,
  onSave,
  onRefresh,
  showLegend = true,
  compact = false,
}: PriceAvailabilityGridProps) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editUnitId, setEditUnitId] = useState("");
  const [editUnitLabel, setEditUnitLabel] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editMinStay, setEditMinStay] = useState("");
  const [editAvailability, setEditAvailability] = useState<"available" | "blocked" | "reserved">("available");
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState<string | null>(null);

  const openDrawer = (unitId: string, unitCode: string, unitName: string, date: string) => {
    const cell = cells[unitId]?.[date];
    setEditUnitId(unitId);
    setEditUnitLabel(unitName || unitCode || unitId);
    setEditDate(date);
    setEditPrice(cell?.price != null ? String(cell.price) : "");
    setEditMinStay(cell?.minStay != null ? String(cell.minStay) : "");
    setEditAvailability(
      cell?.availability === "blocked" || cell?.availability === "reserved" ? cell.availability : "available"
    );
    setDrawerError(null);
    setDrawerOpen(true);
  };

  const handleDrawerSubmit = async () => {
    const price = Number(editPrice);
    if (Number.isNaN(price) || price < 0) {
      setDrawerError("Inserisci un prezzo valido (≥ 0).");
      return;
    }
    setSaving(true);
    setDrawerError(null);
    try {
      await onSave(editUnitId, editDate, {
        price,
        minStay: editMinStay.trim() ? Number(editMinStay) : undefined,
        availability: editAvailability,
      });
      onRefresh();
      setDrawerOpen(false);
    } catch (e) {
      setDrawerError(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (units.length === 0) return null;

  return (
    <>
      {showLegend && (
        <div className={cn("rounded-lg border border-border bg-card p-3", compact && "p-2")}>
          <h2 className={cn("mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground", compact && "mb-1.5 text-[10px]")}>
            Legenda
          </h2>
          <ul className={cn("flex flex-wrap gap-3 text-xs", compact && "gap-2 text-[11px]")}>
            {(Object.keys(AVAILABILITY_LABELS) as AvailabilityKey[]).map((key) => (
              <li key={key} className="flex items-center gap-1.5">
                <span
                  className={cn("inline-block h-4 w-4 rounded border", AVAILABILITY_CLASS[key], compact && "h-3 w-3")}
                  aria-hidden
                />
                <span className="text-muted-foreground">{AVAILABILITY_LABELS[key]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={cn("overflow-x-auto rounded-lg border border-border bg-card", compact && "border-border")}>
        <table className={cn("w-full border-collapse text-sm", compact && "text-xs")}>
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th
                className={cn(
                  "sticky left-0 z-10 min-w-[140px] border-r border-border bg-muted/50 px-3 py-2.5 text-left font-semibold text-foreground",
                  compact && "min-w-[100px] px-2 py-1.5"
                )}
              >
                Appartamento
              </th>
              {dates.map((d) => (
                <th
                  key={d}
                  className={cn(
                    "min-w-[88px] px-2 py-2.5 text-center font-medium text-muted-foreground",
                    compact && "min-w-[64px] px-1 py-1.5"
                  )}
                >
                  {new Date(d + "T12:00:00").toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                  })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.unitId} className="border-b border-border/50 hover:bg-muted/20">
                <td
                  className={cn(
                    "sticky left-0 z-10 border-r border-border bg-background px-3 py-2 font-medium text-foreground",
                    compact && "px-2 py-1.5"
                  )}
                >
                  {u.code}
                  {u.name && u.name !== u.code && (
                    <span className="ml-1 block text-xs font-normal text-muted-foreground">{u.name}</span>
                  )}
                </td>
                {dates.map((date) => {
                  const cell = cells[u.unitId]?.[date];
                  const av = (cell?.availability ?? "available") as AvailabilityKey;
                  const badgeCls = AVAILABILITY_CLASS[av] ?? AVAILABILITY_CLASS.available;
                  return (
                    <td
                      key={date}
                      className={cn(
                        "min-w-[88px] cursor-pointer border-l border-border/50 px-2 py-1.5 text-center align-top transition-colors hover:bg-primary/10",
                        compact && "min-w-[64px] px-1 py-1"
                      )}
                      onClick={() => openDrawer(u.unitId, u.code, u.name, date)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          openDrawer(u.unitId, u.code, u.name, date);
                        }
                      }}
                    >
                      <div
                        className={cn(
                          "text-xs font-medium tabular-nums text-foreground",
                          compact && "text-[11px]"
                        )}
                      >
                        {cell?.price != null && cell.price > 0
                          ? new Intl.NumberFormat("it-IT", {
                              style: "currency",
                              currency: "EUR",
                              maximumFractionDigits: 0,
                            }).format(cell.price)
                          : "—"}
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 rounded px-1 py-0.5 text-[10px] font-medium border",
                          compact && "text-[9px]",
                          badgeCls
                        )}
                      >
                        {AVAILABILITY_LABELS[av]}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent side="right" className="w-full sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Modifica prezzo e disponibilità</DrawerTitle>
            <DrawerCloseButton />
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {editUnitLabel} – {editDate}
              </p>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Prezzo (€)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Min. notti (opzionale)</label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={editMinStay}
                  onChange={(e) => setEditMinStay(e.target.value)}
                  placeholder="—"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-foreground">Disponibilità per questa data</label>
                <Select
                  value={editAvailability}
                  onValueChange={(v) => setEditAvailability(v as "available" | "blocked" | "reserved")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponibile</SelectItem>
                    <SelectItem value="blocked">Bloccato</SelectItem>
                    <SelectItem value="reserved">Riservato</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {drawerError && <p className="text-sm text-destructive">{drawerError}</p>}
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button onClick={handleDrawerSubmit} disabled={saving}>
              {saving ? "Salvataggio..." : "Salva"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
};
