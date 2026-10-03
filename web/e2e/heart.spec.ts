import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

test('open the real heart and pick standard cutting views', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ideas' }).click();
  await page.getByTestId('preset-heart').click();
  await expect(page.getByTestId('object-count')).toHaveText('51 objects', { timeout: 30_000 });
  await expect(page.getByTestId('cut-panel')).toBeVisible();
  await page.getByTestId('cut-preset').click();
  await page.getByRole('option', { name: 'Four-chamber view' }).click();
  // the plane matches the atlas: n ≈ (0.054, 0.881, 0.47)
  await expect(page.getByTestId('cut-panel')).toContainText('n = (0.054, 0.881, 0.47)');
  await page.getByTestId('cut-preset').click();
  await page.getByRole('option', { name: /Short axis, mid/ }).click();
  await expect(page.getByTestId('cut-panel')).toContainText('n = (-0.534, 0.424, -0.732)');
  // the heart is linked, not copied, so the autosave stays small
  await page.waitForTimeout(1000);
  const saved = await page.evaluate(() => localStorage.getItem('mathme.autosave.v1') ?? '');
  expect(saved.length).toBeLessThan(200_000);
  expect(saved).toContain('models/heart.glb');
  // and it comes back after a reload
  await page.reload();
  await expect(page.getByTestId('object-count')).toHaveText('51 objects');
});

test('import an STL model as a shape', async ({ page }) => {
  // a 10 mm cube as ASCII STL
  const f = (a: number[], b: number[], c: number[]) =>
    `facet normal 0 0 0\nouter loop\nvertex ${a.join(' ')}\nvertex ${b.join(' ')}\nvertex ${c.join(' ')}\nendloop\nendfacet\n`;
  const v = (x: number, y: number, z: number) => [x * 10, y * 10, z * 10];
  const quads = [
    [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)],
    [v(0, 0, 1), v(0, 1, 1), v(1, 1, 1), v(1, 0, 1)],
    [v(0, 0, 0), v(0, 0, 1), v(1, 0, 1), v(1, 0, 0)],
    [v(0, 1, 0), v(1, 1, 0), v(1, 1, 1), v(0, 1, 1)],
    [v(0, 0, 0), v(0, 1, 0), v(0, 1, 1), v(0, 0, 1)],
    [v(1, 0, 0), v(1, 0, 1), v(1, 1, 1), v(1, 1, 0)],
  ];
  const stl = `solid cube\n${quads.map(([a, b, c, d]) => f(a, c, b) + f(a, d, c)).join('')}endsolid cube\n`;
  const file = join(tmpdir(), 'cube10mm.stl');
  writeFileSync(file, stl);

  await page.goto('/');
  await page.getByRole('button', { name: 'File menu' }).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: /Import 3D model/ }).click();
  await (await chooser).setFiles(file);
  await expect(page.getByText(/Imported 1 part from cube10mm.stl/)).toBeVisible();
  await expect(page.getByTestId('object-count')).toHaveText('101 objects');
  // 10 mm = 1 cm cube: the Measure tab works it out from the triangles
  await page
    .getByRole('treeitem', { name: /cube10mm part 1/ })
    .getByTestId('outliner-row')
    .click();
  await page.getByTestId('tab-measure').click();
  await expect(page.getByText('Volume ≈ 1 cm³')).toBeVisible();
});

test('export a cut through the geometry service', async ({ page, request }) => {
  const ok = await request
    .get('/api/health')
    .then((r) => r.ok())
    .catch(() => false);
  test.skip(!ok, 'geometry service is not running');
  await page.goto('/');
  await page.getByTestId('open-cut').click();
  await expect(page.getByTestId('export-cut')).toBeEnabled({ timeout: 10_000 });
  const download = page.waitForEvent('download', { timeout: 60_000 });
  await page.getByTestId('export-cut').click();
  const d = await download;
  expect(d.suggestedFilename()).toBe('my-3d-artwork-cut.zip');
  const zip = readFileSync(await d.path());
  expect(zip.subarray(0, 2).toString()).toBe('PK');
  expect(zip.toString('latin1')).toContain('my-3d-artwork-cut-side-A.stl');
});
