import { getJson, patchJson, postJson } from "../http";
import type {
  AdditionalInfoRow,
  ClientCreateInput,
  ClientRow,
  ClientUpdateInput,
  ListQuery,
  PaginatedResponse,
  RequestRow,
} from "../../types/domain";

export const clientsApi = {
  queryClients: (query: ListQuery) => postJson<PaginatedResponse<ClientRow>>("/clients/query", query),
  createClient: (payload: ClientCreateInput) => postJson<{ client: ClientRow }>("/clients", payload),
  updateClient: (clientId: string, payload: ClientUpdateInput) =>
    patchJson<{ client: ClientRow }>(`/clients/${clientId}`, payload),
  getClientById: (clientId: string) => getJson<{ client: ClientRow }>(`/clients/${clientId}`),
  createClientAction: (clientId: string, type: "mail_received" | "mail_sent" | "call_completed" | "meeting_scheduled") =>
    postJson<{ action: { _id: string; type: string; at: string } }>(`/clients/${clientId}/actions`, { type }),
  getClientRequests: (clientId: string, workspaceId: string, projectIds: string[], page = 1, perPage = 50) =>
    getJson<PaginatedResponse<RequestRow>>(
      `/clients/${clientId}/requests?workspaceId=${encodeURIComponent(workspaceId)}&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}&page=${page}&perPage=${perPage}`
    ),
  listAdditionalInfos: (workspaceId: string) =>
    getJson<{ data: AdditionalInfoRow[] }>(`/workspaces/${encodeURIComponent(workspaceId)}/additional-infos`),
};
