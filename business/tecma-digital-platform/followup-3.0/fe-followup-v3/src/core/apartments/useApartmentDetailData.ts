import { useEffect, useState, useCallback } from "react";
import { followupApi } from "../../api/followupApi";
import type { ApartmentRow, RequestRow } from "../../types/domain";
import { useAsync } from "../shared/useAsync";

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
  const {
    run: loadApartment,
    isLoading: loading,
    error: loadApartmentError,
  } = useAsync(async (id: string) => {
    const response = await followupApi.getApartmentById(id);
    return response.apartment;
  });
  const {
    run: loadRequests,
    isLoading: requestsLoading,
  } = useAsync(async (payload: {
    workspaceId: string;
    projectId: string;
    apartmentId: string;
  }) => followupApi.queryRequests({
    workspaceId: payload.workspaceId,
    projectIds: [payload.projectId],
    page: 1,
    perPage: 50,
    filters: { apartmentId: payload.apartmentId },
  }));

  useEffect(() => {
    if (!apartmentId) return;
    setError(null);
    void loadApartment(apartmentId).then((loadedApartment) => {
      if (!loadedApartment) {
        setApartment(null);
        return;
      }
      setApartment(loadedApartment);
    });
  }, [apartmentId, loadApartment]);

  useEffect(() => {
    if (!loadApartmentError) return;
    const is404 = /not found/i.test(loadApartmentError);
    setError(is404 ? "Appartamento non trovato" : loadApartmentError);
    setApartment(null);
  }, [loadApartmentError]);

  const reloadRequests = useCallback(() => {
    if (!apartmentId || !apartment || !workspaceId || selectedProjectIds.length === 0) return;
    void loadRequests({
        workspaceId,
        projectId: apartment.projectId,
        apartmentId,
      })
      .then((response) => setRequests(response?.data ?? []))
      .catch(() => setRequests([]));
  }, [apartmentId, apartment, workspaceId, selectedProjectIds, loadRequests]);

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
