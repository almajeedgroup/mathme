import { expect, type Page, test } from '@playwright/test';

async function drag(page: Page, points: [number, number][]) {
  const box = (await page.getByTestId('viewport').boundingBox())!;
  const at = ([x, y]: [number, number]) => [box.x + box.width * x, box.y + box.height * y] as const;
  await page.mouse.move(...at(points[0]));
  await page.mouse.down();
  for (const p of points.slice(1)) await page.mouse.move(...at(p), { steps: 8 });
  await page.mouse.up();
}

test('draw a solid and a 3D pen tube with the pencil', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-draw').click();
  await expect(page.getByTestId('draw-toolbar')).toBeVisible();

  // a closed loop becomes a solid
  await drag(page, [
    [0.4, 0.6],
    [0.6, 0.6],
    [0.6, 0.8],
    [0.4, 0.8],
    [0.4, 0.605],
  ]);
  await expect(page.getByRole('treeitem', { name: /Drawn shape/ })).toBeVisible();
  await expect(page.getByTestId('object-count')).toHaveText('1 object');

  // a line becomes a tube
  await page.getByTestId('draw-toolbar').getByText('Tube', { exact: true }).click();
  await drag(page, [
    [0.3, 0.5],
    [0.5, 0.45],
    [0.7, 0.5],
  ]);
  await expect(page.getByRole('treeitem', { name: /Pen line/ })).toBeVisible();
  await expect(page.getByTestId('object-count')).toHaveText('2 objects');

  // straight lines: click corners, click the first one again to close
  await page.getByTestId('draw-toolbar').getByText('Solid', { exact: true }).click();
  await page.getByTestId('draw-toolbar').locator('label', { hasText: 'Lines' }).click();
  const box = (await page.getByTestId('viewport').boundingBox())!;
  const click = (x: number, y: number) => page.mouse.click(box.x + box.width * x, box.y + box.height * y);
  await click(0.15, 0.7);
  await click(0.3, 0.7);
  await click(0.22, 0.85);
  await click(0.15, 0.7);
  await expect(page.getByTestId('object-count')).toHaveText('3 objects');

  await page.getByTestId('draw-done').click();
  await expect(page.getByTestId('draw-toolbar')).toBeHidden();
  // undo removes the last drawing
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('object-count')).toHaveText('2 objects');
});
