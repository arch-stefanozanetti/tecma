/**
 * Hook per caricare un'entità (cliente, appartamento) e la lista di richieste/trattative collegate.
 *
 * **Dependency array del primo useEffect:** `loadEntity` (e `getProjectIdsFromEntity`) non sono
 * inclusi di proposito. Includerli causerebbe re-run continui se il chiamante passa funzioni
 * create inline instabile. Passa `loadEntity` con **useCallback** e dipendenze corrette
 * (es. `workspaceId` se la GET richiede `?workspaceId=`). L'effetto dipende da `entityId`,
 * `workspaceId` e `loadEntity`.
 */
import type { Dispatch, SetStateAction } from "react";
import { useEffect, useState, useCallback } from "react";
import { followupApi } from "../../api/followupApi";
import type { RequestRow } from "../../types/domain";

export interface UseDetailDataResult<TEntity> {
  entity: TEntity | null;
  setEntity: Dispatch<SetStateAction<TEntity | null>>;
  loading: boolean;
  error: string | null;
  requests: RequestRow[];
  setRequests: Dispatch<SetStateAction<RequestRow[]>>;
  requestsLoading: boolean;
  reloadRequests: () => void;
}

export interface UseDetailDataOptions<TEntity> {
  entityId: string | undefined;
  workspaceId: string | undefined;
  selectedProjectIds: string[];
  loadEntity: (id: string) => Promise<TEntity | null>;
  getProjectIdsFromEntity: (entity: TEntity) => string[];
  requestFilterKey: string;
  notFoundMessage: string;
}

export function useDetailData<TEntity>({
  entityId,
  workspaceId,
  selectedProjectIds,
  loadEntity,
  getProjectIdsFromEntity,
  requestFilterKey,
  notFoundMessage,
}: UseDetailDataOptions<TEntity>): UseDetailDataResult<TEntity> {
  const [entity, setEntity] = useState<TEntity | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsVersion, setRequestsVersion] = useState(0);

  useEffect(() => {
    if (!entityId) {
      setEntity(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (!workspaceId) {
      setEntity(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    loadEntity(entityId)
      .then((loaded) => {
        if (cancelled) return;
        setEntity(loaded);
      })
      .catch((e) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Unknown error";
        setError(/not found/i.test(message) ? notFoundMessage : message);
        setEntity(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, workspaceId, loadEntity]);

  const selectedProjectIdsKey = selectedProjectIds.join(",");

  useEffect(() => {
    if (!entityId || !entity || !workspaceId || selectedProjectIds.length === 0) return;
    const projectIds = getProjectIdsFromEntity(entity);
    if (projectIds.length === 0) return;
    let cancelled = false;
    setRequestsLoading(true);
    followupApi
      .queryRequests({
        workspaceId,
        projectIds,
        page: 1,
        perPage: 50,
        filters: { [requestFilterKey]: entityId },
      })
      .then((r) => {
        if (cancelled) return;
        setRequests(r.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setRequests([]);
      })
      .finally(() => {
        if (!cancelled) setRequestsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityId, entity, workspaceId, selectedProjectIdsKey, requestsVersion]);

  const reloadRequests = useCallback(() => {
    setRequestsVersion((v) => v + 1);
  }, []);

  return {
    entity,
    setEntity,
    loading,
    error,
    requests,
    setRequests,
    requestsLoading,
    reloadRequests,
  };
}
