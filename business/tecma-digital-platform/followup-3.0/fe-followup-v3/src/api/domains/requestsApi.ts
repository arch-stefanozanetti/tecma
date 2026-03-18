import { deleteJson, getJson, patchJson, postJson } from "../http";
import type {
  ApartmentRow,
  ClientRow,
  ListQuery,
  PaginatedResponse,
  RequestActionRow,
  RequestActionType,
  RequestCreateInput,
  RequestRow,
  RequestTransitionRow,
} from "../../types/domain";

export const requestsApi = {
  queryRequests: (query: ListQuery) => postJson<PaginatedResponse<RequestRow>>("/requests/query", query),
  getRequestById: (id: string) => getJson<{ request: RequestRow }>(`/requests/${id}`),
  getRequestTransitions: (requestId: string) =>
    getJson<{ transitions: RequestTransitionRow[] }>(`/requests/${requestId}/transitions`),
  revertRequestStatus: (requestId: string, transitionId: string) =>
    postJson<{ request: RequestRow }>(`/requests/${requestId}/revert`, { transitionId }),
  getRequestActions: (workspaceId: string, requestId?: string) =>
    getJson<{ actions: RequestActionRow[] }>(
      `/requests/actions?workspaceId=${encodeURIComponent(workspaceId)}${requestId ? `&requestId=${encodeURIComponent(requestId)}` : ""}`
    ),
  createRequestAction: (payload: {
    workspaceId: string;
    requestIds: string[];
    type: RequestActionType;
    title?: string;
    description?: string;
  }) => postJson<{ action: RequestActionRow }>("/requests/actions", payload),
  updateRequestAction: (
    actionId: string,
    payload: { requestIds?: string[]; type?: RequestActionType; title?: string; description?: string }
  ) => patchJson<{ action: RequestActionRow }>(`/requests/actions/${actionId}`, payload),
  deleteRequestAction: (actionId: string) => deleteJson<{ deleted: boolean }>(`/requests/actions/${actionId}`),
  createRequest: (payload: RequestCreateInput) => postJson<{ request: RequestRow }>("/requests", payload),
  updateRequestStatus: (requestId: string, payload: { status: string; reason?: string }) =>
    patchJson<{ request: RequestRow }>(`/requests/${requestId}/status`, payload),
  queryClientsLite: (workspaceId: string, projectIds: string[]) =>
    postJson<{ data: Array<Pick<ClientRow, "_id" | "fullName" | "email" | "projectId">> }>("/clients/lite/query", {
      workspaceId,
      projectIds,
    }),
  queryApartments: (query: ListQuery) => postJson<PaginatedResponse<ApartmentRow>>("/apartments/query", query),
};
