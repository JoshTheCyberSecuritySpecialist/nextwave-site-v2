import { expect, test } from '@playwright/test';

test.describe('public surface smoke', () => {
  test('home page loads Next Wave brand', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/NextWave/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test('CRM login is reachable without auth', async ({ page }) => {
    await page.goto('/crm/login');
    await expect(page.getByRole('heading', { name: /Workspace sign in/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('#crm-email')).toBeVisible();
  });

  test('checkout routes for both sellable packages render', async ({ page }) => {
    for (const packageId of ['business-website', 'website-crm']) {
      await page.goto(`/checkout?package=${packageId}`);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/Continue to secure checkout|Live checkout is not enabled|Choose a package/i).first()).toBeVisible();
    }
  });

  test('missing public site and booking slugs fail closed without crashing the app shell', async ({ page }) => {
    await page.goto('/site/not-a-real-published-site');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/Website unavailable|could not be loaded|Loading/i).first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/book/not-a-real-booking-slug');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByText(/not available|could not be loaded|Loading/i).first()).toBeVisible({ timeout: 20_000 });
  });
});
