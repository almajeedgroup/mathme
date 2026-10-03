import { expect, test } from '@playwright/test';

test.describe('first visit', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows the welcome tour once', async ({ page }) => {
    await page.goto('/');
    const welcome = page.getByRole('dialog', { name: 'Welcome to MathMe 3D Studio' });
    await expect(welcome).toBeVisible();
    await expect(welcome.getByText('1. Add a shape')).toBeVisible();
    await welcome.getByRole('button', { name: 'Next' }).click();
    await welcome.getByRole('button', { name: 'Next' }).click();
    await welcome.getByRole('button', { name: 'Start making!' }).click();
    await expect(welcome).toBeHidden();
    await page.reload();
    await expect(page.getByTestId('object-count')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Welcome to MathMe 3D Studio' })).toBeHidden();
  });
});

test('help explains maths words and keys', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Help' }).click();
  const help = page.getByRole('dialog', { name: 'Help' });
  await help.getByRole('tab', { name: 'Maths words' }).click();
  await expect(help.getByText('Golden angle')).toBeVisible();
  await help.getByRole('tab', { name: 'Keys' }).click();
  await expect(help.getByText('Fit everything in view')).toBeVisible();
});

test('works on a tablet (portrait)', async ({ page }) => {
  await page.setViewportSize({ width: 820, height: 1180 });
  await page.goto('/');
  await expect(page.getByTestId('object-count')).toHaveText('100 objects');
  // the shape panel stays; the details panel folds away and opens from the top bar
  await expect(page.getByTestId('add-shape-box')).toBeVisible();
  await page.getByRole('button', { name: 'Show details panel' }).click();
  await expect(page.getByTestId('inspector')).toBeVisible();
});
