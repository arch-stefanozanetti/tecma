import { useState, useEffect, useRef, useCallback } from 'react';
import { PaginatedItemsParams } from './usePaginatedSingle';

export function usePaginatedItems<T>(
  fetchFn: (params: PaginatedItemsParams, signal?: AbortSignal) => Promise<T[]>,
  perPage: number,
  searchText: string,
  isOpen: boolean,
) {
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset page and items when searchText changes
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
    
    fetchFn({ page, perPage, searchText }, abortController.signal)
      .then((fetched) => {
        setHasMore(fetched.length >= perPage);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setError('Error fetching data: ' + err.message);
          setHasMore(false);
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
    if (hasMore) {
      setPage((prev) => prev + 1);
    }
  }, [hasMore]);

  return { hasMore, loading, error, loadMore };
}
