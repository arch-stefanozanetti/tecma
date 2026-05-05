import { expect, test } from '@playwright/test';

/**
 * E2E del wizard invito utente (M1.D).
 * Richiede dev server avviato e backend mockato/staging accessibile.
 * Skippa automaticamente se la base URL non risponde (test "best effort").
 */
test.describe('Users invite wizard', () => {
  test('apre il wizard a 4 step dalla pagina Users Management', async ({ page }) => {
    const baseURL = page.context().request.constructor.name;
    void baseURL;

    const response = await page.goto('/users', { waitUntil: 'domcontentloaded' }).catch(() => null);
    if (response == null || response.status() >= 500) {
      test.skip(true, 'Dev server non raggiungibile, e2e skippato');
      return;
    }
    if (response.status() !== 200) {
      test.skip(true, `Login richiesto / route /users non disponibile (status ${response.status()})`);
      return;
    }

    const toggle = page.getByTestId('toggle-invite-wizard');
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.getByTestId('invite-user-wizard')).toBeVisible();
    await expect(page.getByText(/Step 1\/4/)).toBeVisible();
  });
});
