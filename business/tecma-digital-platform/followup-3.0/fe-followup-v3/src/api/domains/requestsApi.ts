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
  getRequestById: (id: string, workspaceId: string, projectIds?: string[]) =>
    getJson<{ request: RequestRow }>(
      workspaceId
        ? `/requests/${id}?workspaceId=${encodeURIComponent(workspaceId)}${projectIds?.length ? `&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}` : ""}`
        : `/requests/${id}`
    ),
  getRequestTransitions: (requestId: string, workspaceId: string, projectIds?: string[]) =>
    getJson<{ transitions: RequestTransitionRow[] }>(
      workspaceId
        ? `/requests/${requestId}/transitions?workspaceId=${encodeURIComponent(workspaceId)}${projectIds?.length ? `&projectIds=${projectIds.map((p) => encodeURIComponent(p)).join(",")}` : ""}`
        : `/requests/${requestId}/transitions`
    ),
  revertRequestStatus: (
    requestId: string,
    transitionId: string,
    workspaceId: string,
    projectIds?: string[]
  ) =>
    postJson<{ request: RequestRow }>(`/requests/${requestId}/revert`, {
      transitionId,
      workspaceId,
      ...(projectIds?.length ? { projectIds } : {}),
    }),
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
    workspaceId: string,
    payload: { requestIds?: string[]; type?: RequestActionType; title?: string; description?: string }
  ) =>
    patchJson<{ action: RequestActionRow }>(
      `/requests/actions/${actionId}?workspaceId=${encodeURIComponent(workspaceId)}`,
      payload
    ),
  deleteRequestAction: (actionId: string, workspaceId: string) =>
    deleteJson<{ deleted: boolean }>(`/requests/actions/${actionId}?workspaceId=${encodeURIComponent(workspaceId)}`),
  createRequest: (payload: RequestCreateInput) => postJson<{ request: RequestRow }>("/requests", payload),
  updateRequestStatus: (
    requestId: string,
    payload: { status: string; reason?: string; workspaceId: string; projectIds?: string[] }
  ) => patchJson<{ request: RequestRow }>(`/requests/${requestId}/status`, payload),
  queryClientsLite: (workspaceId: string, projectIds: string[]) =>
    postJson<{ data: Array<Pick<ClientRow, "_id" | "fullName" | "email" | "projectId">> }>("/clients/lite/query", {
      workspaceId,
      projectIds,
    }),
  queryApartments: (query: ListQuery) => postJson<PaginatedResponse<ApartmentRow>>("/apartments/query", query),
};
