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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsVersion, setRequestsVersion] = useState(0);

  // Caricamento cliente: effetto con dipendenza solo da clientId (stabile)
  useEffect(() => {
    if (!clientId) {
      setClient(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    followupApi
      .getClientById(clientId)
      .then((response) => {
        if (cancelled) return;
        setClient(response.client ?? null);
      })
      .catch((e) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Unknown error";
        setError(/not found/i.test(message) ? "Cliente non trovato" : message);
        setClient(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Chiave stabile per selectedProjectIds: evita re-run quando useWorkspace restituisce nuovo array a ogni render
  const selectedProjectIdsKey = selectedProjectIds.join(",");

  // Caricamento richieste: effetto con dipendenze su dati reali + version per reload manuale
  useEffect(() => {
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
  }, [clientId, client, workspaceId, selectedProjectIdsKey, requestsVersion]);

  const reloadRequests = useCallback(() => {
    setRequestsVersion((v) => v + 1);
  }, []);

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
