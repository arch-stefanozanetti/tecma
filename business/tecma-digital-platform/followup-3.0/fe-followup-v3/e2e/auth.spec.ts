import { test, expect } from "@playwright/test";

test.describe("Login e accesso", () => {
  test("pagina login si carica e mostra il form", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /Accedi a Followup 3\.0/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Accedi", exact: true })).toBeVisible();
  });

  test("visitando / senza token reindirizza al login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("nessuna pagina bianca: root mostra qualcosa", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response?.status()).toBe(200);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("#root")).toBeVisible();
    const rootText = await page.locator("#root").textContent();
    expect(rootText?.length).toBeGreaterThan(10);
  });
});
