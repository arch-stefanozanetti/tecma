import { useCallback, useEffect, useState } from "react";
import { followupApi } from "../../api/followupApi";
import type { MatrixUnit, MatrixCell } from "../prices/PriceAvailabilityGrid";

const defaultFrom = () => {
  const d = new Date();
  return d.toISOString().split("T")[0];
};
const defaultTo = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split("T")[0];
};

export function useApartmentDetailPriceCalendar(
  apartmentId: string | undefined,
  workspaceId: string | undefined,
  projectId: string | undefined,
  mode: string | undefined
) {
  const [priceCalendarFrom, setPriceCalendarFrom] = useState(defaultFrom);
  const [priceCalendarTo, setPriceCalendarTo] = useState(defaultTo);
  const [priceCalendarEntries, setPriceCalendarEntries] = useState<
    Array<{ _id: string; date: string; price: number; minStay?: number; availability?: string }>
  >([]);
  const [priceCalendarLoading, setPriceCalendarLoading] = useState(false);
  const [priceCalendarError, setPriceCalendarError] = useState<string | null>(null);
  const [matrixUnits, setMatrixUnits] = useState<MatrixUnit[]>([]);
  const [matrixDates, setMatrixDates] = useState<string[]>([]);
  const [matrixCells, setMatrixCells] = useState<Record<string, Record<string, MatrixCell>>>({});

  const loadPriceCalendar = useCallback(() => {
    if (!apartmentId || !workspaceId || !priceCalendarFrom || !priceCalendarTo) return;
    setPriceCalendarLoading(true);
    setPriceCalendarError(null);
    followupApi
      .getApartmentPriceCalendar(apartmentId, workspaceId, priceCalendarFrom, priceCalendarTo)
      .then((data) => setPriceCalendarEntries(Array.isArray(data) ? data : []))
      .catch((err) => {
        setPriceCalendarError(err instanceof Error ? err.message : "Errore caricamento calendario");
        setPriceCalendarEntries([]);
      })
      .finally(() => setPriceCalendarLoading(false));
  }, [apartmentId, workspaceId, priceCalendarFrom, priceCalendarTo]);

  const loadPriceMatrix = useCallback(() => {
    if (!workspaceId || !projectId || !apartmentId || !priceCalendarFrom || !priceCalendarTo) return;
    setPriceCalendarLoading(true);
    setPriceCalendarError(null);
    followupApi
      .getPriceAvailabilityMatrix(workspaceId, [projectId], priceCalendarFrom, priceCalendarTo)
      .then((res) => {
        const units = (res.units ?? []).filter((u) => String(u.unitId) === String(apartmentId));
        setMatrixUnits(units);
        setMatrixDates(res.dates ?? []);
        setMatrixCells(res.cells ?? {});
      })
      .catch((err) => {
        setPriceCalendarError(err instanceof Error ? err.message : "Errore caricamento calendario");
        setMatrixUnits([]);
        setMatrixDates([]);
        setMatrixCells({});
      })
      .finally(() => setPriceCalendarLoading(false));
  }, [workspaceId, projectId, apartmentId, priceCalendarFrom, priceCalendarTo]);

  useEffect(() => {
    if (mode !== "RENT" || !workspaceId || !projectId || !apartmentId || !priceCalendarFrom || !priceCalendarTo) return;
    loadPriceMatrix();
  }, [mode, workspaceId, projectId, apartmentId, priceCalendarFrom, priceCalendarTo, loadPriceMatrix]);

  return {
    priceCalendarFrom,
    setPriceCalendarFrom,
    priceCalendarTo,
    setPriceCalendarTo,
    priceCalendarEntries,
    priceCalendarLoading,
    priceCalendarError,
    matrixUnits,
    matrixDates,
    matrixCells,
    loadPriceCalendar,
    loadPriceMatrix,
  };
}
