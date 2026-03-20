import { useEffect, useState } from "react";
import { Download, Plus, Share, X } from "lucide-react";
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

function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
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

/** Ritardo prima di aprire automaticamente il dialog nativo di installazione (senza richiedere click). */
const AUTO_PROMPT_DELAY_MS = 1500;

export const PwaInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const showIosInstructions = isIosDevice() && !isStandalone();

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

  // Auto-apri il dialog nativo di installazione quando il browser lo consente (nessuno step da seguire).
  useEffect(() => {
    if (!deferredPrompt || dismissed) return;
    const t = setTimeout(() => {
      deferredPrompt.prompt().catch(() => {
        // Ignora se il browser richiede un gesto utente (es. Chrome in alcuni casi).
      });
    }, AUTO_PROMPT_DELAY_MS);
    return () => clearTimeout(t);
  }, [deferredPrompt, dismissed]);

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

  // Quando il browser espone beforeinstallprompt il dialog nativo viene aperto in automatico (useEffect sopra).
  // Mostriamo un piccolo banner con "Installa" (se l'auto-prompt non parte) e "Dopo".
  if (deferredPrompt && !dismissed) {
    return (
      <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-ui border border-border bg-card p-3 shadow-dropdown lg:bottom-6">
        <div className="flex items-start gap-3">
          <div className="rounded-chrome bg-muted p-2">
            <Download className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Installa Followup</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Se non si è aperta la finestra di installazione, usa il pulsante qui sotto.
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
  }

  if (showIosInstructions && !dismissed) {
    return (
      <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 rounded-ui border border-border bg-card p-3 shadow-dropdown lg:bottom-6">
        <div className="flex items-start gap-3">
          <div className="rounded-chrome bg-muted p-2">
            <Download className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Installa Followup su iOS</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Safari non mostra un popup automatico: tocca
              {" "}
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Share className="h-3.5 w-3.5" />
                Condividi
              </span>
              {" "}
              e poi
              {" "}
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Plus className="h-3.5 w-3.5" />
                Aggiungi a schermata Home
              </span>
              .
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
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
  }

  return null;
};

