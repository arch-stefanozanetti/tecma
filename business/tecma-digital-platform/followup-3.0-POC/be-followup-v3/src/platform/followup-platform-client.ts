/**
 * Typed client minimale per consumer esterni delle Platform API.
 * Pensato per mini-app/siti che devono riusare listing + KPI.
 */
export interface PlatformClientOptions {
  baseUrl: string;
  apiKey: string;
  fetchImpl?: typeof fetch;
}

export interface PlatformListingsQuery {
  projectIds?: string[];
  page?: number;
  perPage?: number;
  searchText?: string;
  status?: string;
  mode?: "rent" | "sell";
}

export interface PlatformKpiSummaryQuery {
  dateFrom?: string;
  dateTo?: string;
}

const createRequest = (opts: PlatformClientOptions) => {
  const fetchFn = opts.fetchImpl ?? fetch;
  const request = async <T>(path: string, body?: unknown): Promise<T> => {
    const res = await fetchFn(`${opts.baseUrl.replace(/\/$/, "")}/v1${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "content-type": "application/json",
        "x-api-key": opts.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Platform API ${res.status}: ${text || res.statusText}`);
    }
    return (await res.json()) as T;
  };
  return request;
};

export const createFollowupPlatformClient = (opts: PlatformClientOptions) => {
  const request = createRequest(opts);
  return {
    getCapabilities: () =>
      request<{ ok: true; workspaceId: string; projectIds: string[]; consumer: string; endpoints: string[] }>(
        "/platform/capabilities"
      ),
    queryListings: (query: PlatformListingsQuery) => request<{ data: Array<Record<string, unknown>>; pagination: Record<string, unknown> }>(
      "/platform/listings/query",
      query
    ),
    getKpiSummary: (query: PlatformKpiSummaryQuery = {}) =>
      request<{ data: Array<{ metric: string; value: number; unit: string }> }>("/platform/reports/kpi-summary", query),
  };
};

