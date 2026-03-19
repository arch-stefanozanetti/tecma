import { followupApi } from "../../api/followupApi";
import type { ApartmentRow, RequestRow } from "../../types/domain";
import { useDetailData } from "../shared/useDetailData";

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
  const result = useDetailData<ApartmentRow>({
    entityId: apartmentId,
    workspaceId,
    selectedProjectIds,
    loadEntity: (id) => followupApi.apartments.getApartmentById(id).then((r) => r.apartment ?? null),
    getProjectIdsFromEntity: (apartment) =>
      [apartment.projectId ?? selectedProjectIds[0]].filter(Boolean),
    requestFilterKey: "apartmentId",
    notFoundMessage: "Appartamento non trovato",
  });
  return {
    apartment: result.entity,
    setApartment: result.setEntity,
    loading: result.loading,
    error: result.error,
    requests: result.requests,
    setRequests: result.setRequests,
    requestsLoading: result.requestsLoading,
    reloadRequests: result.reloadRequests,
  };
}
