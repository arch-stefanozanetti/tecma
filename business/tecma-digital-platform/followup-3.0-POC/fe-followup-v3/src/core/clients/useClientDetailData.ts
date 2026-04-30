import { useCallback } from "react";
import { followupApi } from "../../api/followupApi";
import type { ClientRow, RequestRow } from "../../types/domain";
import { useDetailData } from "../shared/useDetailData";

export interface UseClientDetailDataResult {
  client: ClientRow | null;
  setClient: React.Dispatch<React.SetStateAction<ClientRow | null>>;
  loading: boolean;
  error: string | null;
  requests: RequestRow[];
  setRequests: React.Dispatch<React.SetStateAction<RequestRow[]>>;
  requestsLoading: boolean;
  reloadRequests: () => void;
}

export function useClientDetailData(
  clientId: string | undefined,
  workspaceId: string | undefined,
  selectedProjectIds: string[]
): UseClientDetailDataResult {
  const loadEntity = useCallback(
    (id: string) =>
      workspaceId
        ? followupApi.clients.getClientById(id, workspaceId).then((r) => r.client ?? null)
        : Promise.resolve(null),
    [workspaceId]
  );
  const result = useDetailData<ClientRow>({
    entityId: clientId,
    workspaceId,
    selectedProjectIds,
    loadEntity,
    getProjectIdsFromEntity: (client) =>
      client.projectId ? [client.projectId] : selectedProjectIds,
    requestFilterKey: "clientId",
    notFoundMessage: "Cliente non trovato",
  });
  return {
    client: result.entity,
    setClient: result.setEntity,
    loading: result.loading,
    error: result.error,
    requests: result.requests,
    setRequests: result.setRequests,
    requestsLoading: result.requestsLoading,
    reloadRequests: result.reloadRequests,
  };
}
