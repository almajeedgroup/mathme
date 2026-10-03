import { expect, test } from '@playwright/test';

test('app loads with the spec example (100 spheres in a spiral)', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('MathMe 3D Studio').first()).toBeVisible();
  await expect(page.getByTestId('object-count')).toHaveText('100 objects');
  await expect(page.locator('canvas')).toBeVisible();
});

test('add a shape and turn it into a pattern', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('add-shape-box').click();
  await expect(page.getByTestId('object-count')).toHaveText('101 objects');
  await page.getByTestId('pattern-grid').click();
  await expect(page.getByTestId('object-count')).toHaveText('200 objects');
  await expect(page.getByRole('treeitem', { name: /Grid of Cuboids/ })).toBeVisible();
});
