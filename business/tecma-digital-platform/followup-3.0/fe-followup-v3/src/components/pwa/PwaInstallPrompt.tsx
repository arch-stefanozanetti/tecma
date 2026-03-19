import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { Button } from "../ui/button";

const PWA_INSTALL_DISMISSED_KEY = "pwa-install-dismissed";
const PWA_INSTALL_DISMISS_DAYS = 7;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function getDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(PWA_INSTALL_DISMISSED_KEY);
    if (raw == null) return null;
    const ts = parseInt(raw, 10);
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

function shouldShowAfterDismiss(): boolean {
  const dismissedAt = getDismissedAt();
  if (dismissedAt == null) return true;
  const elapsed = Date.now() - dismissedAt;
  return elapsed > PWA_INSTALL_DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (!shouldShowAfterDismiss()) return;

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(PWA_INSTALL_DISMISSED_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  if (isStandalone()) return null;
  if (!shouldShowAfterDismiss()) return null;
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
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Dopo
            </Button>
          </div>
        </div>
        <button
          type="button"
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={handleDismiss}
          aria-label="Chiudi prompt installazione"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

