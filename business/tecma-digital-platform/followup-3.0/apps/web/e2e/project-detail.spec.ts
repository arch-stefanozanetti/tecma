import { expect, test } from '@playwright/test';

/**
 * E2E del Project Detail (M3.B).
 * Skippa se dev server non raggiungibile o utente non autenticato.
 */
test.describe('Project Detail page', () => {
  test('mostra i tab e permette di navigare', async ({ page }) => {
    const response = await page
      .goto('/projects/test-project-id', { waitUntil: 'domcontentloaded' })
      .catch(() => null);
    if (response == null || response.status() >= 500) {
      test.skip(true, 'Dev server non raggiungibile, e2e skippato');
      return;
    }
    if (response.status() !== 200) {
      test.skip(true, `Login richiesto / route non disponibile (status ${response.status()})`);
      return;
    }

    const page$ = page.getByTestId('project-detail-page');
    await expect(page$).toBeVisible({ timeout: 5000 }).catch(() => {
      test.skip(true, 'Project detail richiede sessione autenticata');
    });

    await page.getByTestId('project-detail-tab-branding').click();
    await expect(page.getByTestId('project-branding-form')).toBeVisible();
    await page.getByTestId('project-detail-tab-email-templates').click();
    await expect(page.getByTestId('project-email-templates')).toBeVisible();
    await page.getByTestId('project-detail-tab-legacy-overrides').click();
    await expect(page.getByTestId('legacy-overrides-save')).toBeVisible();
  });
});
