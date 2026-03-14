/**
 * Matrice prezzi e disponibilità per backoffice: unità × date.
 * Aggrega da queryApartments + price-calendar + inventory.
 */
import { queryApartments } from "../apartments/apartments.service.js";
import { listPriceCalendarByUnitAndRange } from "../price-calendar/price-calendar.service.js";
import { getInventoryByUnitId } from "../inventory/inventory.service.js";
import { getActiveLockForApartment } from "../workflow/apartment-lock.service.js";

export interface PriceAvailabilityUnit {
  unitId: string;
  code: string;
  name: string;
  mode?: "RENT" | "SELL";
}

export interface PriceAvailabilityCell {
  price?: number;
  availability?: "available" | "blocked" | "reserved" | "locked" | "sold";
  minStay?: number;
}

export interface PriceAvailabilityMatrixResult {
  units: PriceAvailabilityUnit[];
  dates: string[];
  cells: Record<string, Record<string, PriceAvailabilityCell>>;
}

function generateDateRange(fromDate: string, toDate: string): string[] {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const dates: string[] = [];
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);
  while (d <= end) {
    dates.push(d.toISOString().split("T")[0]);
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

export const getPriceAvailabilityMatrix = async (
  workspaceId: string,
  projectIds: string[],
  fromDate: string,
  toDate: string
): Promise<PriceAvailabilityMatrixResult> => {
  if (!workspaceId?.trim() || !projectIds?.length || !fromDate?.trim() || !toDate?.trim()) {
    return { units: [], dates: [], cells: {} };
  }

  const dates = generateDateRange(fromDate, toDate);
  if (dates.length === 0) return { units: [], dates, cells: {} };

  const apartmentsRes = await queryApartments({
    workspaceId,
    projectIds,
    page: 1,
    perPage: 200,
    searchText: "",
    filters: {},
  });

  const data = apartmentsRes.data ?? [];
  const units: PriceAvailabilityUnit[] = data.map((row) => ({
    unitId: String(row._id ?? ""),
    code: row.code ?? "",
    name: row.name ?? row.code ?? "",
    mode: row.mode,
  }));

  const unitIds = units.map((u) => u.unitId).filter((id) => id.length > 0);
  const [calendarResults, inventoryResults, lockResults] = await Promise.all([
    Promise.all(unitIds.map((unitId) => listPriceCalendarByUnitAndRange(unitId, fromDate, toDate))),
    Promise.all(unitIds.map((unitId) => getInventoryByUnitId(unitId))),
    Promise.all(unitIds.map((unitId) => getActiveLockForApartment(unitId))),
  ]);

  const cells: Record<string, Record<string, PriceAvailabilityCell>> = {};

  unitIds.forEach((unitId, idx) => {
    const calendarRows = calendarResults[idx] ?? [];
    const inventory = inventoryResults[idx];
    const lock = lockResults[idx];

    const defaultAvailability: PriceAvailabilityCell["availability"] = lock
      ? "locked"
      : inventory?.inventoryStatus === "sold"
        ? "sold"
        : inventory?.inventoryStatus === "reserved"
          ? "reserved"
          : "available";

    const byDate: Record<string, PriceAvailabilityCell> = {};
    dates.forEach((date) => {
      const row = calendarRows.find((r) => r.date === date);
      const availability = row?.availability
        ? (row.availability as PriceAvailabilityCell["availability"])
        : defaultAvailability;
      byDate[date] = {
        price: row?.price,
        availability,
        minStay: row?.minStay,
      };
    });
    cells[unitId] = byDate;
  });

  return { units, dates, cells };
};
