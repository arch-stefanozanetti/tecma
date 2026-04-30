import { useCallback, useEffect, useMemo, useState } from "react";
import type { ListQuery, PaginatedResponse } from "../../types/domain";

interface UsePaginatedListOptions<T> {
  loader: (query: ListQuery) => Promise<PaginatedResponse<T>>;
  workspaceId: string;
  projectIds: string[];
  defaultSortField: string;
  filters?: Record<string, unknown>;
  /** Default 25 */
  defaultPerPage?: number;
  /** Se false, non esegue il load (es. quando workspaceId/projectIds non sono pronti). Default true. */
  enabled?: boolean;
}

export const usePaginatedList = <T,>({
  loader,
  workspaceId,
  projectIds,
  defaultSortField,
  filters,
  defaultPerPage = 25,
  enabled = true
}: UsePaginatedListOptions<T>) => {
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(defaultPerPage);
  const [data, setData] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchKey, setRefetchKey] = useState(0);

  const query = useMemo<ListQuery>(
    () => ({
      workspaceId,
      projectIds,
      page,
      perPage,
      searchText,
      sort: { field: defaultSortField, direction: -1 },
      filters
    }),
    [workspaceId, projectIds, page, perPage, searchText, defaultSortField, filters]
  );

  useEffect(() => {
    if (!enabled) return;
    let ignore = false;
    setIsLoading(true);
    setError(null);

    loader(query)
      .then((result) => {
        if (ignore) return;
        setData(result.data);
        setTotal(result.pagination.total);
      })
      .catch((e) => {
        if (ignore) return;
        setError(e instanceof Error ? e.message : "Unknown error");
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [loader, query, enabled, refetchKey]);

  const refetch = useCallback(() => setRefetchKey((k) => k + 1), []);

  return {
    data,
    total,
    page,
    setPage,
    searchText,
    setSearchText,
    isLoading,
    error,
    refetch,
  };
};
