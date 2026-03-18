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
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apartmentId) return;
    setLoading(true);
    setError(null);
    followupApi
      .getApartmentById(apartmentId)
      .then((r) => setApartment(r.apartment))
      .catch((err) => {
        const msg = err?.message ?? "Errore nel caricamento";
        const is404 =
          /not found/i.test(String(msg)) ||
          (typeof (err as { statusCode?: number })?.statusCode === "number" &&
            (err as { statusCode: number }).statusCode === 404);
        setError(is404 ? "Appartamento non trovato" : msg);
        setApartment(null);
      })
      .finally(() => setLoading(false));
  }, [apartmentId]);

  const reloadRequests = useCallback(() => {
    if (!apartmentId || !apartment || !workspaceId || selectedProjectIds.length === 0) return;
    setRequestsLoading(true);
    followupApi
      .queryRequests({
        workspaceId,
        projectIds: [apartment.projectId],
        page: 1,
        perPage: 50,
        filters: { apartmentId },
      })
      .then((r) => setRequests(r.data ?? []))
      .catch(() => setRequests([]))
      .finally(() => setRequestsLoading(false));
  }, [apartmentId, apartment, workspaceId, selectedProjectIds.length]);

  useEffect(() => {
    reloadRequests();
  }, [reloadRequests]);

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
