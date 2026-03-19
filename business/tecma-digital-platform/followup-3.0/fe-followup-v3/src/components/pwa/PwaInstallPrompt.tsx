import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "../ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-ui border border-border bg-card p-3 shadow-dropdown lg:bottom-6">
      <div className="flex items-start gap-3">
        <div className="rounded-chrome bg-muted p-2">
          <Download className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Installa Followup sul dispositivo</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Accesso rapido per agenti in movimento, esperienza app-like e supporto offline minimale.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await deferredPrompt.prompt();
                const choice = await deferredPrompt.userChoice;
                if (choice.outcome === "accepted") setDeferredPrompt(null);
              }}
            >
              Installa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>
              Dopo
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => setDismissed(true)}
          aria-label="Chiudi prompt installazione"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

