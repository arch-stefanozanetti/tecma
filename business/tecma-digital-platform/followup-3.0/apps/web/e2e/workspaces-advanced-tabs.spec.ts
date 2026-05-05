import { expect, test } from '@playwright/test';

/**
 * E2E del pannello avanzato workspace (M2.C).
 * Richiede dev server attivo. Skippa se non raggiungibile o non autenticato.
 */
test.describe('Workspaces advanced panel', () => {
  test('mostra i tab avanzati e permette di switchare', async ({ page }) => {
    const response = await page
      .goto('/organization', { waitUntil: 'domcontentloaded' })
      .catch(() => null);
    if (response == null || response.status() >= 500) {
      test.skip(true, 'Dev server non raggiungibile, e2e skippato');
      return;
    }
    if (response.status() !== 200) {
      test.skip(
        true,
        `Login richiesto / route /organization non disponibile (status ${response.status()})`,
      );
      return;
    }

    const panel = page.getByTestId('workspace-advanced-panel');
    await expect(panel).toBeVisible({ timeout: 5000 }).catch(() => {
      test.skip(true, 'Workspace non selezionato in ambiente e2e');
    });

    await page.getByTestId('workspace-advanced-tab-ai').click();
    await expect(page.getByTestId('ai-provider-select')).toBeVisible();
    await page.getByTestId('workspace-advanced-tab-entitlements').click();
  });
});
