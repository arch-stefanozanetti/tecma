import { useEffect, useState, useCallback } from "react";
import { followupApi } from "../../api/followupApi";
import type { ApartmentRow, RequestRow } from "../../types/domain";

export interface UseApartmentDetailDataResult {
  apartment: ApartmentRow | null;
  setApartment: React.Dispatch<React.SetStateAction<ApartmentRow | null>>;
  loading: boolean;
  error: string | null;
  requests: RequestRow[];
  setRequests: React.Dispatch<React.SetStateAction<RequestRow[]>>;
  requestsLoading: boolean;
  reloadRequests: () => void;
}

export function useApartmentDetailData(
  apartmentId: string | undefined,
  workspaceId: string | undefined,
  selectedProjectIds: string[]
): UseApartmentDetailDataResult {
  const [apartment, setApartment] = useState<ApartmentRow | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsVersion, setRequestsVersion] = useState(0);

  // Caricamento appartamento: effetto con dipendenza solo da apartmentId (stabile)
  useEffect(() => {
    if (!apartmentId) {
      setApartment(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setLoading(true);
    followupApi
      .getApartmentById(apartmentId)
      .then((response) => {
        if (cancelled) return;
        setApartment(response.apartment ?? null);
      })
      .catch((e) => {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Unknown error";
        setError(/not found/i.test(message) ? "Appartamento non trovato" : message);
        setApartment(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apartmentId]);

  // Chiave stabile per selectedProjectIds: evita re-run quando useWorkspace restituisce nuovo array a ogni render
  const selectedProjectIdsKey = selectedProjectIds.join(",");

  // Caricamento richieste: effetto con dipendenze su dati reali + version per reload manuale
  useEffect(() => {
    if (!apartmentId || !apartment || !workspaceId || selectedProjectIds.length === 0) return;
    const projectId = apartment.projectId ?? selectedProjectIds[0];
    if (!projectId) return;
    setRequestsLoading(true);
    followupApi
      .queryRequests({
        workspaceId,
        projectIds: [projectId],
        page: 1,
        perPage: 50,
        filters: { apartmentId },
      })
      .then((r) => setRequests(r.data ?? []))
      .catch(() => setRequests([]))
      .finally(() => setRequestsLoading(false));
  }, [apartmentId, apartment, workspaceId, selectedProjectIdsKey, requestsVersion]);

  const reloadRequests = useCallback(() => {
    setRequestsVersion((v) => v + 1);
  }, []);

  return {
    apartment,
    setApartment,
    loading,
    error,
    requests,
    setRequests,
    requestsLoading,
    reloadRequests,
  };
}
