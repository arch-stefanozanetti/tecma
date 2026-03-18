import { useEffect, useState, useCallback } from "react";
import { followupApi } from "../../api/followupApi";
import type { ClientRow, RequestRow } from "../../types/domain";

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
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    followupApi
      .getClientById(clientId)
      .then((r) => setClient(r.client))
      .catch((err) => {
        const msg = err?.message ?? "Errore nel caricamento";
        const is404 =
          /not found/i.test(String(msg)) ||
          (typeof (err as { statusCode?: number })?.statusCode === "number" &&
            (err as { statusCode: number }).statusCode === 404);
        setError(is404 ? "Cliente non trovato" : msg);
        setClient(null);
      })
      .finally(() => setLoading(false));
  }, [clientId]);

  const reloadRequests = useCallback(() => {
    if (!clientId || !client || !workspaceId || selectedProjectIds.length === 0) return;
    const projectIds = client.projectId ? [client.projectId] : selectedProjectIds;
    setRequestsLoading(true);
    followupApi
      .queryRequests({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 50,
        filters: { clientId },
      })
      .then((r) => setRequests(r.data ?? []))
      .catch(() => setRequests([]))
      .finally(() => setRequestsLoading(false));
  }, [clientId, client, workspaceId, selectedProjectIds.length]);

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
