import { useEffect, useState, useCallback } from "react";
import { followupApi } from "../../api/followupApi";
import type { ClientRow, RequestRow } from "../../types/domain";
import { useAsync } from "../shared/useAsync";

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
  const [client, setClient] = useState<ClientRow | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const {
    run: loadClient,
    isLoading: loading,
    error: loadClientError,
  } = useAsync(async (id: string) => {
    const response = await followupApi.getClientById(id);
    return response.client;
  });
  const {
    run: loadRequests,
    isLoading: requestsLoading,
  } = useAsync(async (payload: {
    workspaceId: string;
    projectIds: string[];
    clientId: string;
  }) => followupApi.queryRequests({
    workspaceId: payload.workspaceId,
    projectIds: payload.projectIds,
    page: 1,
    perPage: 50,
    filters: { clientId: payload.clientId },
  }));

  useEffect(() => {
    if (!clientId) return;
    setError(null);
    void loadClient(clientId)
      .then((loadedClient) => {
        if (!loadedClient) {
          setClient(null);
          return;
        }
        setClient(loadedClient);
      });
  }, [clientId, loadClient]);

  useEffect(() => {
    if (!loadClientError) return;
    const is404 = /not found/i.test(loadClientError);
    setError(is404 ? "Cliente non trovato" : loadClientError);
    setClient(null);
  }, [loadClientError]);

  const reloadRequests = useCallback(() => {
    if (!clientId || !client || !workspaceId || selectedProjectIds.length === 0) return;
    const projectIds = client.projectId ? [client.projectId] : selectedProjectIds;
    void loadRequests({
        workspaceId,
        projectIds,
        clientId,
      })
      .then((response) => setRequests(response?.data ?? []))
      .catch(() => setRequests([]));
  }, [clientId, client, workspaceId, selectedProjectIds, loadRequests]);

  useEffect(() => {
    reloadRequests();
  }, [reloadRequests]);

  return {
    client,
    setClient,
    loading,
    error,
    requests,
    setRequests,
    requestsLoading,
    reloadRequests,
  };
}
