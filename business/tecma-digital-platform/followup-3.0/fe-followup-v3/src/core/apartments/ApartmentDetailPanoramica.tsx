import { Link } from "react-router-dom";
import type { ApartmentRow } from "../../types/domain";
import { Button } from "../../components/ui/button";
import { formatDate } from "../../lib/formatDate";
import {
  STATUS_LABEL,
  MODE_LABEL,
  getPriceDisplay,
  getInventoryStatusLabel,
  type PanoramicaPrices,
} from "./apartmentDetailConstants";

export type PanoramicaInventory = {
  effectiveStatus: string;
  lock: { requestId: string; type: string } | null;
} | null;

export interface ApartmentDetailPanoramicaProps {
  apartment: ApartmentRow;
  prices: PanoramicaPrices | null;
  inventory: PanoramicaInventory;
  onEditApartment: () => void;
  refetchPrices: () => void;
  apartmentId: string | undefined;
  onOpenAddSalePrice: () => void;
  onOpenAddMonthlyRent: () => void;
  onEditSalePrice: (s: { _id: string; price: number; currency: string; validFrom: string; validTo?: string }) => void;
  onEditMonthlyRent: (r: {
    _id: string;
    pricePerMonth: number;
    deposit?: number;
    currency: string;
    validFrom: string;
    validTo?: string;
  }) => void;
  onCloseSalePricePeriod: (s: { _id: string }) => Promise<void>;
  onCloseMonthlyRentPeriod: (r: { _id: string }) => Promise<void>;
  editPriceSaving: boolean;
}

export default function ApartmentDetailPanoramica({
  apartment,
  prices,
  inventory,
  onEditApartment,
  refetchPrices,
  apartmentId,
  onOpenAddSalePrice,
  onOpenAddMonthlyRent,
  onEditSalePrice,
  onEditMonthlyRent,
  onCloseSalePricePeriod,
  onCloseMonthlyRentPeriod,
  editPriceSaving,
}: ApartmentDetailPanoramicaProps): JSX.Element {
  const priceDisplay = getPriceDisplay(apartment, prices);
  const inventoryStatusLabel = getInventoryStatusLabel(inventory);

  return (
    <>
      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Dettaglio</h2>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Codice</span>
            <p className="font-mono font-medium text-foreground">{apartment.code}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Nome</span>
            <p className="font-medium text-foreground">{apartment.name || "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Superficie</span>
            <p className="font-medium text-foreground">
              {apartment.surfaceMq != null ? `${apartment.surfaceMq} m²` : "—"}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Prezzo</span>
            <p className="font-medium text-foreground">{priceDisplay}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Disponibilità</span>
            <p className="font-medium text-foreground">{inventoryStatusLabel}</p>
            {inventory?.lock && (
              <Link to={`/requests/${inventory.lock.requestId}`} className="text-xs text-primary hover:underline">
                Trattativa #{inventory.lock.requestId.slice(-6)}
              </Link>
            )}
          </div>
          {apartment.floor != null && (
            <div>
              <span className="text-muted-foreground">Piano</span>
              <p className="font-medium text-foreground">{apartment.floor}</p>
            </div>
          )}
          {apartment.building?.name && (
            <div>
              <span className="text-muted-foreground">Edificio</span>
              <p className="font-medium text-foreground">{apartment.building.name}</p>
            </div>
          )}
          {apartment.building?.address && (
            <div>
              <span className="text-muted-foreground">Indirizzo</span>
              <p className="font-medium text-foreground">{apartment.building.address}</p>
            </div>
          )}
          {apartment.plan?.typology?.name && (
            <div>
              <span className="text-muted-foreground">Tipologia</span>
              <p className="font-medium text-foreground">{apartment.plan.typology.name}</p>
            </div>
          )}
          {apartment.plan?.mainFeatures && (
            <div>
              <span className="text-muted-foreground">Caratteristiche</span>
              <p className="font-medium text-foreground">
                {[
                  apartment.plan.mainFeatures.rooms != null && `${apartment.plan.mainFeatures.rooms} vani`,
                  apartment.plan.mainFeatures.bedroom != null && `${apartment.plan.mainFeatures.bedroom} camere`,
                  apartment.plan.mainFeatures.bathroom != null && `${apartment.plan.mainFeatures.bathroom} bagni`,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            </div>
          )}
          {apartment.sides && apartment.sides.length > 0 && (
            <div>
              <span className="text-muted-foreground">Lati</span>
              <p className="font-medium text-foreground">
                {apartment.sides.map((s) => s.name).filter(Boolean).join(", ") || "—"}
              </p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Progetto</span>
            <p className="font-mono text-xs text-foreground">{apartment.projectId}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">Disponibilità</h2>
        <p className="text-xs text-muted-foreground">
          Stato dell'unità: Disponibile, Riservato, Venduto, Affittato. Puoi modificarlo per aggiornare la visibilità.
        </p>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-muted-foreground">Stato</span>
            <p className="font-medium text-foreground">{STATUS_LABEL[apartment.status]}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Modalità</span>
            <p className="font-medium text-foreground">{MODE_LABEL[apartment.mode]}</p>
          </div>
          {inventory && (
            <div>
              <span className="text-muted-foreground">Stato inventory</span>
              <p className="font-medium text-foreground">{inventoryStatusLabel}</p>
            </div>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={onEditApartment}>
          Modifica stato
        </Button>
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:col-span-2">
        <h2 className="text-sm font-semibold text-foreground">Storico prezzi</h2>
        <div className="flex flex-wrap gap-4 mb-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenAddSalePrice();
            }}
          >
            Aggiungi prezzo vendita
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenAddMonthlyRent();
            }}
          >
            Aggiungi canone mensile
          </Button>
        </div>
        <div className="flex flex-wrap gap-6">
          {prices?.salePrices && prices.salePrices.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground mb-1">Vendita</p>
              <ul className="space-y-1 text-sm">
                {prices.salePrices.slice(0, 10).map((s) => (
                  <li key={s._id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {formatDate(s.validFrom)} – {s.validTo ? formatDate(s.validTo) : "oggi"}
                    </span>
                    <span className="font-medium">
                      {new Intl.NumberFormat("it-IT", {
                        style: "currency",
                        currency: s.currency,
                        minimumFractionDigits: 0,
                      }).format(s.price)}
                    </span>
                    <div className="flex gap-1">
                      {!s.validTo && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => apartmentId && onCloseSalePricePeriod(s)}
                          disabled={editPriceSaving}
                        >
                          Chiudi periodo
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onEditSalePrice(s)}
                      >
                        Modifica
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nessun prezzo vendita.</p>
          )}
          {prices?.monthlyRents && prices.monthlyRents.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground mb-1">Affitto</p>
              <ul className="space-y-1 text-sm">
                {prices.monthlyRents.slice(0, 10).map((r) => (
                  <li key={r._id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {formatDate(r.validFrom)} – {r.validTo ? formatDate(r.validTo) : "oggi"}
                    </span>
                    <span className="font-medium">
                      {new Intl.NumberFormat("it-IT", {
                        style: "currency",
                        currency: r.currency,
                        minimumFractionDigits: 0,
                      }).format(r.pricePerMonth)}
                      /mese
                    </span>
                    <div className="flex gap-1">
                      {!r.validTo && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => apartmentId && onCloseMonthlyRentPeriod(r)}
                          disabled={editPriceSaving}
                        >
                          Chiudi periodo
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onEditMonthlyRent(r)}
                      >
                        Modifica
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nessun canone mensile.</p>
          )}
        </div>
      </div>
    </>
  );
}
