import { test, expect } from "@playwright/test";

/** Intercetta API indipendentemente da VITE_API_BASE_URL (path relativo o host assoluto). */
function routeAuthJson(
  page: import("@playwright/test").Page,
  pathEndsWith: string,
  body: object,
  status = 200
) {
  return page.route(
    (url) => url.pathname.endsWith(pathEndsWith),
    async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
      });
    }
  );
}

test.describe("Identity (mock API)", () => {
  test("set-password da invito: submit con API mockata", async ({ page }) => {
    await routeAuthJson(page, "/auth/set-password-from-invite", {
      accessToken: "e2e-access",
      refreshToken: "e2e-refresh",
      user: { email: "e2e-invite@test.local", isAdmin: false },
      expiresIn: "15m",
    });

    await page.goto("/set-password?token=playwright-invite-token");

    const pwd = page.locator('form input[type="password"]');
    await pwd.nth(0).fill("E2eValidPass99");
    await pwd.nth(1).fill("E2eValidPass99");
    await page.getByRole("button", { name: /attiva account/i }).click();

    await page.waitForFunction(
      () => sessionStorage.getItem("followup3.accessToken") === "e2e-access",
      null,
      { timeout: 15_000 }
    );
  });

  test("login: dopo POST mock compare scelta ambiente", async ({ page }) => {
    await routeAuthJson(page, "/auth/login", {
      accessToken: "e2e-at",
      refreshToken: "e2e-rt",
      user: { email: "e2e-login@test.local", isAdmin: false },
      expiresIn: "15m",
    });

    await page.goto("/login");
    await page.getByPlaceholder(/nome\.cognome@azienda\.it/i).fill("e2e-login@test.local");
    await page.getByPlaceholder(/inserisci la password/i).fill("any");
    await page.getByRole("button", { name: /^Accedi$/i }).click();

    await expect(page.getByText(/scegli.*ambiente/i).first()).toBeVisible({ timeout: 15_000 });
  });
});
