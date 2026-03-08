import { useCallback, useState } from "react";

/**
 * Hook per azioni async singole (login, submit form, "carica progetti", salvataggio).
 * Evita di ripetere useState(loading/error) in ogni componente.
 *
 * @param asyncFn - Funzione async da eseguire (può avere argomenti).
 * @returns run(...args) per eseguire, data, error, isLoading, reset.
 */
export function useAsync<T, Args extends unknown[]>(
  asyncFn: (...args: Args) => Promise<T>
): {
  run: (...args: Args) => Promise<T | undefined>;
  data: T | undefined;
  error: string | null;
  isLoading: boolean;
  reset: () => void;
} {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const run = useCallback(
    async (...args: Args): Promise<T | undefined> => {
      setError(null);
      setIsLoading(true);
      try {
        const result = await asyncFn(...args);
        setData(result);
        return result;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        setError(message);
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(null);
    setIsLoading(false);
  }, []);

  return { run, data, error, isLoading, reset };
}
