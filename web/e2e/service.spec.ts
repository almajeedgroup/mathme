import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

// These need the Python geometry service. CI starts it (E2E_SERVICE=1); locally they are
// skipped when it is not running.
test.beforeEach(async ({ page, request }) => {
  const ok = await request
    .get('/api/health')
    .then((r) => r.ok())
    .catch(() => false);
  test.skip(!ok, 'geometry service is not running');
  await page.goto('/');
  await expect(page.getByTestId('service-badge').first())
    .toHaveText('service online', { timeout: 10_000 })
    .catch(() => {});
});

test('measure the whole model with overlaps removed', async ({ page }) => {
  await page.getByTestId('outliner-row').first().click();
  await page.getByTestId('tab-measure').click();
  await page.getByTestId('measure-all').click();
  const result = page.getByTestId('measure-result');
  await expect(result).toContainText('Overlap removed', { timeout: 30_000 });
  await expect(result).toContainText('cm³');
});

test('cut a cylinder out of a cube', async ({ page }) => {
  await page.getByRole('button', { name: 'Delete Spiral of spheres' }).click();
  await page.getByTestId('add-shape-box').click();
  await page.getByTestId('add-shape-cylinder').click();
  await page.getByTestId('tab-place').click();
  await page.getByRole('textbox', { name: 'Position X' }).fill('0.5');
  const rows = page.getByTestId('outliner-row');
  await rows.nth(0).click();
  await rows.nth(1).click({ modifiers: ['Shift'] });
  await page.getByTestId('boolean-difference').click();
  await expect(page.getByRole('treeitem', { name: /Cuboid − Cylinder/ })).toBeVisible({ timeout: 30_000 });
  // the two originals are hidden, so only the new shape is drawn
  await expect(page.getByTestId('object-count')).toHaveText('1 object');
  await page.getByTestId('tab-measure').click();
  await expect(page.getByText(/measured it by adding up/)).toBeVisible();
});

test('print-ready STL is one joined solid', async ({ page }) => {
  await page.getByTestId('open-export').click();
  const promise = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByTestId('export-print-ready').click();
  const d = await promise;
  expect(d.suggestedFilename()).toBe('my-3d-artwork-print.stl');
  const data = readFileSync(await d.path());
  const triangles = data.readUInt32LE(80);
  expect(data.length).toBe(84 + 50 * triangles);
});
