import posthog from "posthog-js";
import { initProductTelemetry } from "./initPosthog";

/**
 * Invia un evento prodotto (catalogo `EVENT_CATALOG.md`). No PII nei payload.
 */
export function trackProductEvent(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  if (!import.meta.env.VITE_PUBLIC_POSTHOG_KEY?.trim()) return;
  initProductTelemetry();
  try {
    posthog.capture(event, props);
  } catch {
    // non bloccare UI
  }
}
