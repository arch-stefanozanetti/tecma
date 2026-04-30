import { defineConfig, devices } from "@playwright/test";

/**
 * Configurazione Playwright per test E2E su Followup 3.0.
 * Esegui il frontend in locale (npm run dev) poi: npm run test:e2e
 * Oppure usa webServer per avviare automaticamente il dev server.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5177",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer:
    process.env.PLAYWRIGHT_USE_WEBSERVER === "true" || !process.env.CI
      ? {
          command: process.env.PLAYWRIGHT_WEBSERVER_COMMAND ?? "npm run dev",
          url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5177",
          reuseExistingServer: !process.env.CI,
          timeout: 60_000,
        }
      : undefined,
});
