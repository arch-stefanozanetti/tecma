import { test, expect } from "@playwright/test";

/**
 * Visual regression: login page.
 * Prima esecuzione genera i baseline in e2e/visual/login.spec.ts-snapshots.
 * Per aggiornare: npx playwright test e2e/visual --update-snapshots
 */
test.describe("Visual — login page", () => {
  test("login page screenshot", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Accedi/i })).toBeVisible({
      timeout: 8000,
    });
    await expect(page).toHaveScreenshot("login-page.png");
  });
});
