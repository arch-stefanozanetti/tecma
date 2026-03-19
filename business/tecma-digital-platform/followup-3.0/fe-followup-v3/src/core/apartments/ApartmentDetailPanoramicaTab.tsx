import { followupApi } from "../../api/followupApi";
import type { ApartmentRow } from "../../types/domain";
import ApartmentDetailPanoramica from "./ApartmentDetailPanoramica";
import { ApartmentDetailPriceCalendarSection } from "./ApartmentDetailPriceCalendarSection";
import { ApartmentDetailPriceDrawers } from "./ApartmentDetailPriceDrawers";
import type { MatrixUnit, MatrixCell } from "../prices/PriceAvailabilityGrid";

export interface ApartmentDetailPanoramicaTabProps {
  apartment: ApartmentRow;
  prices: {
    current: { source: string; amount: number; currency: string; mode: string; validFrom?: string; validTo?: string; deposit?: number } | null;
    salePrices: Array<{ _id: string; price: number; currency: string; validFrom: string; validTo?: string }>;
    monthlyRents: Array<{ _id: string; pricePerMonth: number; deposit?: number; currency: string; validFrom: string; validTo?: string }>;
  } | null;
  inventory: { effectiveStatus: string; lock: { requestId: string; type: string } | null } | null;
  apartmentId: string | undefined;
  workspaceId: string | undefined;
  onEditApartment: () => void;
  refetchPrices: () => void;
  priceCalendar: {
    priceCalendarFrom: string;
    setPriceCalendarFrom: (v: string) => void;
    priceCalendarTo: string;
    setPriceCalendarTo: (v: string) => void;
    priceCalendarLoading: boolean;
    priceCalendarError: string | null;
    matrixUnits: MatrixUnit[];
    matrixDates: string[];
    matrixCells: Record<string, Record<string, MatrixCell>>;
    loadPriceMatrix: () => void;
  };
  addSalePriceOpen: boolean;
  setAddSalePriceOpen: (v: boolean) => void;
  addSalePriceForm: { price: string; currency: string; validFrom: string; validTo: string };
  setAddSalePriceForm: React.Dispatch<React.SetStateAction<{ price: string; currency: string; validFrom: string; validTo: string }>>;
  addMonthlyRentOpen: boolean;
  setAddMonthlyRentOpen: (v: boolean) => void;
  addMonthlyRentForm: { pricePerMonth: string; deposit: string; currency: string; validFrom: string; validTo: string };
  setAddMonthlyRentForm: React.Dispatch<React.SetStateAction<{ pricePerMonth: string; deposit: string; currency: string; validFrom: string; validTo: string }>>;
  addPriceSaving: boolean;
  setAddPriceSaving: (v: boolean) => void;
  addPriceError: string | null;
  setAddPriceError: (v: string | null) => void;
  editSalePriceOpen: boolean;
  setEditSalePriceOpen: (v: boolean) => void;
  editSalePriceId: string | null;
  setEditSalePriceId: (v: string | null) => void;
  editSalePriceForm: { price: string; validTo: string };
  setEditSalePriceForm: React.Dispatch<React.SetStateAction<{ price: string; validTo: string }>>;
  editMonthlyRentOpen: boolean;
  setEditMonthlyRentOpen: (v: boolean) => void;
  editMonthlyRentId: string | null;
  setEditMonthlyRentId: (v: string | null) => void;
  editMonthlyRentForm: { pricePerMonth: string; deposit: string; validTo: string };
  setEditMonthlyRentForm: React.Dispatch<React.SetStateAction<{ pricePerMonth: string; deposit: string; validTo: string }>>;
  editPriceSaving: boolean;
  setEditPriceSaving: (v: boolean) => void;
  editPriceError: string | null;
  setEditPriceError: (v: string | null) => void;
}

export function ApartmentDetailPanoramicaTab(props: ApartmentDetailPanoramicaTabProps) {
  const {
    apartment,
    prices,
    inventory,
    apartmentId,
    workspaceId,
    onEditApartment,
    refetchPrices,
    priceCalendar,
    addSalePriceOpen,
    setAddSalePriceOpen,
    addSalePriceForm,
    setAddSalePriceForm,
    addMonthlyRentOpen,
    setAddMonthlyRentOpen,
    addMonthlyRentForm,
    setAddMonthlyRentForm,
    addPriceSaving,
    setAddPriceSaving,
    addPriceError,
    setAddPriceError,
    editSalePriceOpen,
    setEditSalePriceOpen,
    editSalePriceId,
    setEditSalePriceId,
    editSalePriceForm,
    setEditSalePriceForm,
    editMonthlyRentOpen,
    setEditMonthlyRentOpen,
    editMonthlyRentId,
    setEditMonthlyRentId,
    editMonthlyRentForm,
    setEditMonthlyRentForm,
    editPriceSaving,
    setEditPriceSaving,
    editPriceError,
    setEditPriceError,
  } = props;

  return (
    <section className="grid gap-6 sm:grid-cols-2">
      <ApartmentDetailPanoramica
        apartment={apartment}
        prices={prices}
        inventory={inventory}
        onEditApartment={onEditApartment}
        refetchPrices={refetchPrices}
        apartmentId={apartmentId}
        onOpenAddSalePrice={() => {
          setAddSalePriceOpen(true);
          setAddPriceError(null);
          setAddSalePriceForm({ price: "", currency: "EUR", validFrom: "", validTo: "" });
        }}
        onOpenAddMonthlyRent={() => {
          setAddMonthlyRentOpen(true);
          setAddPriceError(null);
          setAddMonthlyRentForm({ pricePerMonth: "", deposit: "", currency: "EUR", validFrom: "", validTo: "" });
        }}
        onEditSalePrice={(s) => {
          setEditSalePriceId(s._id);
          setEditSalePriceForm({ price: String(s.price), validTo: s.validTo ? s.validTo.split("T")[0] : "" });
          setEditSalePriceOpen(true);
          setEditPriceError(null);
        }}
        onEditMonthlyRent={(r) => {
          setEditMonthlyRentId(r._id);
          setEditMonthlyRentForm({
            pricePerMonth: String(r.pricePerMonth),
            deposit: r.deposit != null ? String(r.deposit) : "",
            validTo: r.validTo ? r.validTo.split("T")[0] : "",
          });
          setEditMonthlyRentOpen(true);
          setEditPriceError(null);
        }}
        onCloseSalePricePeriod={async (s) => {
          if (!apartmentId) return;
          setEditPriceSaving(true);
          setEditPriceError(null);
          try {
            await followupApi.apartments.updateApartmentSalePrice(apartmentId, s._id, {
              validTo: new Date().toISOString().split("T")[0],
            });
            refetchPrices();
          } catch (err) {
            setEditPriceError(err instanceof Error ? err.message : "Errore");
          } finally {
            setEditPriceSaving(false);
          }
        }}
        onCloseMonthlyRentPeriod={async (r) => {
          if (!apartmentId) return;
          setEditPriceSaving(true);
          setEditPriceError(null);
          try {
            await followupApi.apartments.updateApartmentMonthlyRent(apartmentId, r._id, {
              validTo: new Date().toISOString().split("T")[0],
            });
            refetchPrices();
          } catch (err) {
            setEditPriceError(err instanceof Error ? err.message : "Errore");
          } finally {
            setEditPriceSaving(false);
          }
        }}
        editPriceSaving={editPriceSaving}
      />
      {apartment?.mode === "RENT" && (
        <ApartmentDetailPriceCalendarSection
          workspaceId={workspaceId}
          from={priceCalendar.priceCalendarFrom}
          to={priceCalendar.priceCalendarTo}
          onFromChange={priceCalendar.setPriceCalendarFrom}
          onToChange={priceCalendar.setPriceCalendarTo}
          loading={priceCalendar.priceCalendarLoading}
          error={priceCalendar.priceCalendarError}
          matrixUnits={priceCalendar.matrixUnits}
          matrixDates={priceCalendar.matrixDates}
          matrixCells={priceCalendar.matrixCells}
          onLoadMatrix={priceCalendar.loadPriceMatrix}
        />
      )}
      <ApartmentDetailPriceDrawers
        apartmentId={apartmentId}
        workspaceId={workspaceId}
        refetchPrices={refetchPrices}
        addSalePriceOpen={addSalePriceOpen}
        setAddSalePriceOpen={setAddSalePriceOpen}
        addSalePriceForm={addSalePriceForm}
        setAddSalePriceForm={setAddSalePriceForm}
        addMonthlyRentOpen={addMonthlyRentOpen}
        setAddMonthlyRentOpen={setAddMonthlyRentOpen}
        addMonthlyRentForm={addMonthlyRentForm}
        setAddMonthlyRentForm={setAddMonthlyRentForm}
        addPriceSaving={addPriceSaving}
        setAddPriceSaving={setAddPriceSaving}
        addPriceError={addPriceError}
        setAddPriceError={setAddPriceError}
        editSalePriceOpen={editSalePriceOpen}
        setEditSalePriceOpen={setEditSalePriceOpen}
        editSalePriceId={editSalePriceId}
        setEditSalePriceId={setEditSalePriceId}
        editSalePriceForm={editSalePriceForm}
        setEditSalePriceForm={setEditSalePriceForm}
        editMonthlyRentOpen={editMonthlyRentOpen}
        setEditMonthlyRentOpen={setEditMonthlyRentOpen}
        editMonthlyRentId={editMonthlyRentId}
        setEditMonthlyRentId={setEditMonthlyRentId}
        editMonthlyRentForm={editMonthlyRentForm}
        setEditMonthlyRentForm={setEditMonthlyRentForm}
        editPriceSaving={editPriceSaving}
        setEditPriceSaving={setEditPriceSaving}
        editPriceError={editPriceError}
        setEditPriceError={setEditPriceError}
      />
    </section>
  );
}
