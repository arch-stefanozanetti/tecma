import posthog from "posthog-js";

let initialized = false;

/** Inizializza PostHog una sola volta (no autocapture / pageview automatici). */
export function initProductTelemetry(): void {
  if (initialized || typeof window === "undefined") return;
  const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY?.trim();
  if (!key) return;
  const host = import.meta.env.VITE_PUBLIC_POSTHOG_HOST?.trim() || "https://eu.i.posthog.com";
  posthog.init(key, {
    api_host: host,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export function isProductTelemetryConfigured(): boolean {
  return Boolean(import.meta.env.VITE_PUBLIC_POSTHOG_KEY?.trim());
}
