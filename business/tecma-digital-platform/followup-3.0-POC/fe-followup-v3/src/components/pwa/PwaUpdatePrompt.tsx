import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "../ui/button";

const PWA_NEED_REFRESH_EVENT = "pwa-need-refresh";

declare global {
  interface Window {
    __pwa_updateSW?: (reload?: boolean) => Promise<void>;
  }
}

export const PwaUpdatePrompt = () => {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    const handler = () => setNeedRefresh(true);
    window.addEventListener(PWA_NEED_REFRESH_EVENT, handler);
    return () => window.removeEventListener(PWA_NEED_REFRESH_EVENT, handler);
  }, []);

  const handleReload = () => {
    window.__pwa_updateSW?.(true);
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-ui border border-border bg-card p-3 shadow-dropdown lg:bottom-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Nuova versione disponibile</p>
        </div>
        <Button size="sm" onClick={handleReload}>
          Ricarica
        </Button>
      </div>
    </div>
  );
};
