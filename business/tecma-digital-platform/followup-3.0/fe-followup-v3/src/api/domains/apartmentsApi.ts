import { getJson, patchJson, postJson, putJson } from "../http";
import type { ApartmentCreateInput, ApartmentRow, ListQuery, PaginatedResponse, RequestRow } from "../../types/domain";

export const apartmentsApi = {
  queryApartments: (query: ListQuery) => postJson<PaginatedResponse<ApartmentRow>>("/apartments/query", query),
  updateApartment: (apartmentId: string, payload: Partial<ApartmentCreateInput>) =>
    patchJson<{ apartment: ApartmentRow }>(`/apartments/${apartmentId}`, payload),
  getApartmentRequests: (apartmentId: string, workspaceId: string, projectIds: string[], page = 1, perPage = 50) =>
    getJson<PaginatedResponse<RequestRow>>(
      `/apartments/${apartmentId}/requests?workspaceId=${encodeURIComponent(workspaceId)}&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}&page=${page}&perPage=${perPage}`
    ),
  getApartmentById: (id: string) => getJson<{ apartment: ApartmentRow }>(`/apartments/${id}`),
  getApartmentPrices: (id: string) =>
    getJson<{ current: unknown; salePrices: unknown[]; monthlyRents: unknown[] }>(`/apartments/${id}/prices`),
  getApartmentInventory: (id: string) =>
    getJson<{ inventory: unknown; lock: unknown; effectiveStatus: string }>(`/apartments/${id}/inventory`),
  updateApartmentInventory: (id: string, payload: { workspaceId: string; inventoryStatus?: "available" | "locked" | "reserved" | "sold" }) =>
    patchJson(`/apartments/${id}/inventory`, payload),
  upsertApartmentPriceCalendar: (id: string, payload: { date: string; price: number; minStay?: number; availability?: "available" | "blocked" | "reserved" }) =>
    putJson<{ ok: true }>(`/apartments/${id}/prices/calendar`, payload),
};
