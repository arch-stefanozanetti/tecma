import { test, expect } from "@playwright/test";

/**
 * Callback OIDC senza Keycloak reale: in dev le VITE_KEYCLOAK_* non sono settate,
 * la pagina mostra messaggio di configurazione mancante (stesso percorso usato in prod finché non si abilita SSO).
 */
test.describe("Keycloak callback (senza IdP configurato)", () => {
  test("mostra messaggio se variabili VITE_KEYCLOAK_* assenti", async ({ page }) => {
    await page.goto("/login/keycloak-callback");
    await expect(page.getByText(/Keycloak non è configurato/i)).toBeVisible({ timeout: 15_000 });
  });
});
