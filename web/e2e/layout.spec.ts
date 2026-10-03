import { expect, test } from '@playwright/test';

test('both sidebars hide and come back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('add-shape-box')).toBeVisible();
  await page.getByRole('button', { name: 'Hide sidebar' }).click();
  await expect(page.getByTestId('add-shape-box')).toBeHidden();
  // the folded sidebar opens straight at a section
  await page.getByRole('button', { name: 'Make a pattern' }).click();
  await expect(page.getByTestId('pattern-grid')).toBeVisible();

  await page.getByRole('button', { name: 'Hide details panel' }).click();
  // the panel slides out of view
  await expect(page.getByTestId('inspector')).not.toBeInViewport();
  await page.getByRole('button', { name: 'Show details panel' }).click();
  await expect(page.getByTestId('inspector')).toBeInViewport();

  // remembered after a reload
  await page.getByRole('button', { name: 'Hide sidebar' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Show sidebar' })).toBeVisible();
});

test('sidebar sections fold', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('section-shapes').click();
  await expect(page.getByTestId('add-shape-box')).toBeHidden();
  await page.getByTestId('section-shapes').click();
  await expect(page.getByTestId('add-shape-box')).toBeVisible();
});

test('settings page changes the project and the 3D view', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('open-settings').click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await settings.getByRole('textbox', { name: 'Made by' }).fill('Sulaimaan');
  await settings.getByRole('tab', { name: '3D view' }).click();
  const grid = settings.getByRole('switch', { name: 'Show the grid' });
  await expect(grid).toBeChecked();
  await grid.click({ force: true });
  await expect(grid).not.toBeChecked();
  await settings.getByRole('tab', { name: 'Appearance' }).click();
  await settings.getByText('Dark', { exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-mantine-color-scheme', 'dark');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Made by')).toHaveValue('Sulaimaan');
});
