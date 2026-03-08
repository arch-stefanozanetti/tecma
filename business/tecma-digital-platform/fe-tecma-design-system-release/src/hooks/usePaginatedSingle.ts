import { useState, useEffect, useRef, useCallback } from 'react';

export interface PaginatedItemsParams {
  page: number;
  perPage: number;
  sortField?: string | null;
  sortOrder?: number | null;
  searchText?: string;
}

export function usePaginatedSingleItems<T>(
  fetchFn: (params: PaginatedItemsParams, signal?: AbortSignal) => Promise<T[]>,
  perPage: number,
  searchText: string,
  isOpen: boolean,
  hasMore?: boolean,
) {
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchFnRef = useRef(fetchFn);
  const hasMoreRef = useRef(hasMore);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    fetchFnRef.current = fetchFn;
  }, [fetchFn]);

  useEffect(() => {
    setPage(1);
  }, [searchText]);

  useEffect(() => {
    if (!isOpen) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    fetchFnRef
      .current({ page, perPage, searchText }, abortController.signal)
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError(`Error fetching data: ${err.message}`);
        }
      })
      .finally(() => {
        setLoading(false);
      });

    return () => {
      abortController.abort();
    };
  }, [page, perPage, searchText, isOpen]);

  const loadMore = useCallback(() => {
    if (hasMoreRef.current && !loading) {
      setPage((prev) => prev + 1);
    }
  }, [loading]);

  return { loading, error, loadMore };
}
