import { expect, test } from '@playwright/test';

test('loads login page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Accedi a Followup 3.0')).toBeVisible();
});

test('login form has email and password fields', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByPlaceholder('nome.cognome@azienda.it')).toBeVisible();
  await expect(page.getByPlaceholder('Inserisci la password')).toBeVisible();
});
