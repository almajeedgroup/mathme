import { expect, test } from '@playwright/test';

test('group shapes, save as my shape, and make a pattern from it', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Delete Spiral of spheres' }).click();
  await page.getByTestId('add-shape-cone').click();
  await page.getByTestId('add-shape-sphere').click();
  const rows = page.getByTestId('outliner-row');
  await rows.nth(0).click();
  await rows.nth(1).click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Group them' }).click();
  await page.getByLabel('Name', { exact: true }).last().fill('Snowman');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Saved “Snowman” to Mine.')).toBeVisible();

  await page.getByRole('tab', { name: /Mine/ }).click();
  await page.getByRole('button', { name: 'Add Snowman' }).click();
  await page.getByTestId('pattern-circle').click();
  // 2 (group) + 12 snowmen × 2 parts
  await expect(page.getByTestId('object-count')).toHaveText('26 objects');
});

test('spun shape profile editor and symmetry', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Make' }).click();
  await page.getByTestId('add-shape-lathe').click();
  await expect(page.getByRole('application', { name: 'Side outline drawing board' })).toBeVisible();
  await page.getByTestId('tab-mirror').click();
  await page.getByLabel('X (left ↔ right)').check();
  await expect(page.getByTestId('object-count')).toHaveText('102 objects');
});
