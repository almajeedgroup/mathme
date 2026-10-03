import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

test('the recipe from the brief makes 100 objects, and undo removes them', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'File menu' }).click();
  await page.getByRole('menuitem', { name: 'New empty scene' }).click();
  await expect(page.getByTestId('object-count')).toHaveText('0 objects');

  const input = page.getByTestId('command-input');
  await input.fill('100 objects → Spiral → Radius 20 → Rotation 30° → Scale 0.5–2');
  await input.press('Enter');
  await expect(page.getByTestId('object-count')).toHaveText('100 objects');
  await expect(page.getByRole('treeitem', { name: /Spiral of spheres/ })).toBeVisible();
  // the inspector shows the numbers from the recipe
  await expect(page.getByRole('textbox', { name: 'Radius' })).toHaveValue('20');
  await expect(page.getByRole('textbox', { name: 'Turn between objects' })).toHaveValue('30');

  await page.waitForTimeout(500); // let the undo history settle
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByTestId('object-count')).toHaveText('0 objects');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByTestId('object-count')).toHaveText('100 objects');
});

test('a recipe with a typo shows a friendly error', async ({ page }) => {
  await page.goto('/');
  const input = page.getByTestId('command-input');
  await input.fill('100 blorps spiral');
  await input.press('Enter');
  await expect(page.getByTestId('command-error')).toContainText('blorps');
});

test('ideas, save a project file, and open it again', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ideas' }).click();
  await page.getByTestId('preset-dna').click();
  await expect(page.getByTestId('object-count')).toHaveText('120 objects');

  await page.getByRole('button', { name: 'File menu' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Save project file' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('dna-double-helix.mathme.json');
  const path = await download.path();
  const saved = JSON.parse(readFileSync(path, 'utf8'));
  expect(saved.app).toBe('mathme-3d-studio');
  expect(saved.nodes).toHaveLength(3);

  await page.getByRole('button', { name: 'File menu' }).click();
  await page.getByRole('menuitem', { name: 'New empty scene' }).click();
  await expect(page.getByTestId('object-count')).toHaveText('0 objects');

  await page.getByRole('button', { name: 'File menu' }).click();
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('menuitem', { name: 'Open project file…' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path);
  await expect(page.getByTestId('object-count')).toHaveText('120 objects');
});

test('work is autosaved and comes back after a reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ideas' }).click();
  await page.getByTestId('preset-snowflake').click();
  await expect(page.getByTestId('object-count')).toHaveText('37 objects');
  await page.waitForTimeout(1000);
  await page.reload();
  await expect(page.getByTestId('object-count')).toHaveText('37 objects');
  await expect(page.getByRole('treeitem', { name: /Arm/ })).toBeVisible();
});
