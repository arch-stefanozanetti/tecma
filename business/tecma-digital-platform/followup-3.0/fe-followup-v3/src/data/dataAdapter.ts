import { followupApi } from "../api/followupApi";
import type { ApartmentRow, ClientRow, ListQuery, PaginatedResponse } from "../types/domain";
import { mockApartments, mockClients, mockCockpitFeed } from "./mockData";
import type { CockpitFeedItem, DataAdapter, QuickActionPayload } from "./types";

const paginate = <T,>(rows: T[], query: ListQuery): PaginatedResponse<T> => {
  const page = Math.max(1, query.page || 1);
  const perPage = Math.max(1, query.perPage || 25);
  const start = (page - 1) * perPage;
  const data = rows.slice(start, start + perPage);
  return {
    data,
    pagination: {
      page,
      perPage,
      total: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / perPage))
    }
  };
};

const searchFilter = <T,>(rows: T[], query: string, keys: Array<keyof T>) => {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) => keys.some((key) => String(row[key] ?? "").toLowerCase().includes(needle)));
};

const extractArrayFilter = (filters: Record<string, unknown> | undefined, key: string): string[] => {
  const value = filters?.[key];
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
};

const parseDate = (input: unknown): number | null => {
  if (typeof input !== "string" || !input) return null;
  const timestamp = new Date(input).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const filterClientsMock = (query: ListQuery): ClientRow[] => {
  const scoped = mockClients.filter((row) => query.projectIds.length === 0 || query.projectIds.includes(row.projectId));
  const searched = searchFilter(scoped as ClientRow[], query.searchText ?? "", [
    "firstName",
    "lastName",
    "fullName",
    "email",
    "phone",
    "city",
    "projectId",
  ]);
  const status = extractArrayFilter(query.filters, "status");
  const source = extractArrayFilter(query.filters, "source");
  const city = extractArrayFilter(query.filters, "city");
  const dateFrom = parseDate(query.filters?.dateFrom);
  const dateTo = parseDate(query.filters?.dateTo);
  const onlyMyHome = Boolean(query.filters?.onlyMyHome);

  return searched.filter((row) => {
    const rowTime = new Date(row.updatedAt).getTime();
    if (status.length > 0 && !status.includes(row.status)) return false;
    if (source.length > 0 && !source.includes(row.source ?? "")) return false;
    if (city.length > 0 && !city.includes(row.city ?? "")) return false;
    if (onlyMyHome && !row.myhomeVersion) return false;
    if (dateFrom !== null && rowTime < dateFrom) return false;
    if (dateTo !== null && rowTime > dateTo) return false;
    return true;
  });
};

const filterApartmentsMock = (query: ListQuery): ApartmentRow[] => {
  const scoped = mockApartments.filter((row) => query.projectIds.length === 0 || query.projectIds.includes(row.projectId));
  const searched = searchFilter(scoped as ApartmentRow[], query.searchText ?? "", ["name", "code", "projectId", "status", "mode"]);
  const status = extractArrayFilter(query.filters, "status");
  const mode = extractArrayFilter(query.filters, "mode");

  return searched.filter((row) => {
    if (status.length > 0 && !status.includes(row.status)) return false;
    if (mode.length > 0 && !mode.includes(row.mode)) return false;
    return true;
  });
};

const createMockAdapter = (): DataAdapter => ({
  getCockpitFeed: async () => ({
    items: mockCockpitFeed,
    kpis: {
      pipelineValue: 2840000,
      clientsHot: 19,
      openActions: 32,
      conversionRisk: 7
    }
  }),
  getClients: async (query) => paginate(filterClientsMock(query), query),
  getApartments: async (query) => paginate(filterApartmentsMock(query), query),
  runQuickAction: async (payload: QuickActionPayload) => ({ ok: true, message: `Azione mock eseguita: ${payload.intent}` })
});

const createRestAdapter = (): DataAdapter => ({
  getCockpitFeed: async ({ workspaceId, projectIds }) => {
    const [clientsResp, apartmentsResp] = await Promise.all([
      followupApi.clients.queryClients({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 200,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      }),
      followupApi.apartments.queryApartments({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 200,
        searchText: "",
        sort: { field: "updatedAt", direction: -1 }
      })
    ]);

    const items: CockpitFeedItem[] = [
      {
        id: "live-risk",
        title: `${clientsResp.data.filter((c) => c.status === "lead").length} lead da consolidare`,
        summary: "Lead non ancora convertiti in prospect/client.",
        category: "risk",
        priority: "high",
        cta: "Apri lista clienti"
      },
      {
        id: "live-opp",
        title: `${apartmentsResp.data.filter((a) => a.status === "AVAILABLE").length} unita disponibili`,
        summary: "Opportunita aperte in vendita/affitto.",
        category: "opportunity",
        priority: "medium",
        cta: "Apri lista appartamenti"
      }
    ];

    return {
      items,
      kpis: {
        pipelineValue: clientsResp.data.length * 25000,
        clientsHot: clientsResp.data.filter((c) => c.status !== "lead").length,
        openActions: Math.max(4, clientsResp.data.length / 3),
        conversionRisk: clientsResp.data.filter((c) => c.status === "lead").length
      }
    };
  },
  getClients: (query) => followupApi.clients.queryClients(query),
  getApartments: (query) => followupApi.apartments.queryApartments(query),
  runQuickAction: async (payload: QuickActionPayload) => ({ ok: true, message: `Azione inviata: ${payload.intent}` })
});

const mode = (import.meta.env.VITE_DATA_MODE || "mock").toLowerCase();

export const dataAdapter: DataAdapter = mode === "rest" ? createRestAdapter() : createMockAdapter();
