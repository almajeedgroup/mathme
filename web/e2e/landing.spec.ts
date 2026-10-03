import { expect, test } from '@playwright/test';

test('landing page opens the studio', async ({ page }) => {
  await page.goto('/landing/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Generative 3D Art');
  await expect(page.getByText('Seven patterns, endless art')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.getByRole('link', { name: 'Start creating' }).click();
  await expect(page.getByTestId('object-count')).toBeVisible();
  await page.getByRole('link', { name: 'Home page' }).click();
  await expect(page).toHaveURL(/\/landing\/$/);
});
