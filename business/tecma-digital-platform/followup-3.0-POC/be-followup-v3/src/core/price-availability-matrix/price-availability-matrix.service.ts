/**
 * Matrice prezzi e disponibilità per backoffice: unità × date.
 * Aggrega da queryApartments + price-calendar + inventory.
 */
import { queryApartments } from "../apartments/apartments.service.js";
import { listPriceCalendarByUnitAndRange } from "../price-calendar/price-calendar.service.js";
import { getInventoryByUnitId } from "../inventory/inventory.service.js";
import { getActiveLockForApartment } from "../workflow/apartment-lock.service.js";
import {
  getOpenRentRequestBadgesByApartmentIds,
  type OpenRentRequestBadge,
} from "../requests/requests.service.js";

export interface PriceAvailabilityUnit {
  unitId: string;
  projectId: string;
  code: string;
  name: string;
  mode?: "RENT" | "SELL";
  openRentRequest?: OpenRentRequestBadge;
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

export type GetPriceAvailabilityMatrixOptions = {
  /** Se valorizzato, la matrice include solo queste unità (subset della query). */
  unitIds?: string[];
  /** Se true, solo unità in modalità affitto (viste calendario affitti / listini rent). */
  onlyRentMode?: boolean;
};

export const getPriceAvailabilityMatrix = async (
  workspaceId: string,
  projectIds: string[],
  fromDate: string,
  toDate: string,
  options?: GetPriceAvailabilityMatrixOptions
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
    filters: options?.onlyRentMode === true ? { mode: ["RENT"] } : {},
  });

  const data = apartmentsRes.data ?? [];
  const allowIds =
    options?.unitIds && options.unitIds.length > 0
      ? new Set(options.unitIds.map((id) => id.trim()).filter(Boolean))
      : null;

  let units: PriceAvailabilityUnit[] = data
    .filter((row) => {
      if (!allowIds) return true;
      const id = String(row._id ?? "");
      return allowIds.has(id);
    })
    .map((row) => ({
      unitId: String(row._id ?? ""),
      projectId: String(row.projectId ?? ""),
      code: row.code ?? "",
      name: row.name ?? row.code ?? "",
      mode: row.mode,
    }));

  const rentBadges = await getOpenRentRequestBadgesByApartmentIds(
    workspaceId,
    projectIds,
    units.map((u) => u.unitId)
  );
  units = units.map((u) => {
    const b = rentBadges[u.unitId];
    if (!b) return u;
    return {
      ...u,
      openRentRequest: {
        requestId: b.requestId,
        status: b.status,
        clientLabel: b.clientLabel,
      },
    };
  });

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
