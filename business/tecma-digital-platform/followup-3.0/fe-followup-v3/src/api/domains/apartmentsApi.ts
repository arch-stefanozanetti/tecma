import { getJson, patchJson, postJson, putJson } from "../http";
import type { ApartmentCreateInput, ApartmentRow, ListQuery, PaginatedResponse, RequestRow } from "../../types/domain";

export const apartmentsApi = {
  queryApartments: (query: ListQuery) => postJson<PaginatedResponse<ApartmentRow>>("/apartments/query", query),
  createApartment: (payload: ApartmentCreateInput) =>
    postJson<{ apartmentId: string; apartment: ApartmentRow }>("/apartments", payload),
  updateApartment: (apartmentId: string, payload: Partial<ApartmentCreateInput>) =>
    patchJson<{ apartment: ApartmentRow }>(`/apartments/${apartmentId}`, payload),
  getApartmentById: (id: string, workspaceId: string) =>
    getJson<{ apartment: ApartmentRow }>(`/apartments/${id}?workspaceId=${encodeURIComponent(workspaceId)}`),
  getApartmentRequests: (apartmentId: string, workspaceId: string, projectIds: string[], page = 1, perPage = 50) =>
    getJson<PaginatedResponse<RequestRow>>(
      `/apartments/${apartmentId}/requests?workspaceId=${encodeURIComponent(workspaceId)}&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}&page=${page}&perPage=${perPage}`
    ),
  getApartmentPrices: (id: string, workspaceId: string) =>
    getJson<{
      current: { source: string; amount: number; currency: string; mode: string; validFrom?: string; validTo?: string; deposit?: number } | null;
      salePrices: Array<{ _id: string; price: number; currency: string; validFrom: string; validTo?: string }>;
      monthlyRents: Array<{ _id: string; pricePerMonth: number; deposit?: number; currency: string; validFrom: string; validTo?: string }>;
    }>(`/apartments/${id}/prices?workspaceId=${encodeURIComponent(workspaceId)}`),
  getApartmentInventory: (id: string, workspaceId: string) =>
    getJson<{ inventory: unknown; lock: { requestId: string; type: string } | null; effectiveStatus: string }>(
      `/apartments/${id}/inventory?workspaceId=${encodeURIComponent(workspaceId)}`
    ),
  updateApartmentInventory: (id: string, payload: { workspaceId: string; inventoryStatus?: "available" | "locked" | "reserved" | "sold" }) =>
    patchJson(`/apartments/${id}/inventory`, payload),
  createApartmentSalePrice: (
    apartmentId: string,
    body: { workspaceId: string; price: number; currency?: string; validFrom?: string; validTo?: string }
  ) =>
    postJson<{ _id: string; unitId: string; price: number; currency: string; validFrom: string; validTo?: string }>(
      `/apartments/${apartmentId}/prices/sale`,
      body
    ),
  createApartmentMonthlyRent: (
    apartmentId: string,
    body: {
      workspaceId: string;
      pricePerMonth: number;
      deposit?: number;
      currency?: string;
      validFrom?: string;
      validTo?: string;
    }
  ) =>
    postJson<{
      _id: string;
      unitId: string;
      pricePerMonth: number;
      deposit?: number;
      currency: string;
      validFrom: string;
      validTo?: string;
    }>(`/apartments/${apartmentId}/prices/monthly-rent`, body),
  updateApartmentSalePrice: (apartmentId: string, priceId: string, body: { validTo?: string; price?: number }) =>
    patchJson<{ _id: string; unitId: string; price: number; currency: string; validFrom: string; validTo?: string }>(
      `/apartments/${apartmentId}/prices/sale/${priceId}`,
      body
    ),
  updateApartmentMonthlyRent: (
    apartmentId: string,
    rentId: string,
    body: { validTo?: string; pricePerMonth?: number; deposit?: number }
  ) =>
    patchJson<{
      _id: string;
      unitId: string;
      pricePerMonth: number;
      deposit?: number;
      currency: string;
      validFrom: string;
      validTo?: string;
    }>(`/apartments/${apartmentId}/prices/monthly-rent/${rentId}`, body),
  getApartmentPriceCalendar: (apartmentId: string, workspaceId: string, from: string, to: string) =>
    getJson<Array<{ _id: string; unitId: string; date: string; price: number; minStay?: number; availability?: string }>>(
      `/apartments/${apartmentId}/prices/calendar?workspaceId=${encodeURIComponent(workspaceId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    ),
  upsertApartmentPriceCalendar: (
    id: string,
    workspaceId: string,
    payload: { date: string; price: number; minStay?: number; availability?: "available" | "blocked" | "reserved" }
  ) =>
    putJson<{ ok: true }>(
      `/apartments/${id}/prices/calendar?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
};
