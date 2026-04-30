import { test, expect } from "@playwright/test";

/**
 * Smoke test: verifica che l’app non mostri pagina bianca e che gli elementi principali esistano.
 * Utile dopo modifiche al layout, routing o ErrorBoundary.
 */
test.describe("Smoke — nessuna pagina bianca", () => {
  test("login page ha contenuto visibile", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("#root")).toBeVisible();
    await expect(page.getByText(/Tecma|Followup|Accedi/i).first()).toBeVisible({ timeout: 8000 });
  });

  test("login page contiene il logo o titolo", async ({ page }) => {
    await page.goto("/login");
    const hasLogoOrTitle =
      (await page.getByRole("heading", { name: /Accedi|Followup|Scegli/i }).isVisible()) ||
      (await page.locator('svg[aria-hidden]').first().isVisible());
    expect(hasLogoOrTitle).toBe(true);
  });
});
