import { readFileSync } from 'node:fs';

import { expect, type Page, test } from '@playwright/test';

/** Screen position of a sketch point (the board starts centred on 0,0 at 40 pixels per unit). */
async function board(page: Page) {
  const box = (await page.getByTestId('sketch-canvas').boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return (x: number, y: number) => [cx + x * 40, cy - y * 40] as [number, number];
}

test('sketch in 2D: lines, a circle, measurements, rules, 3D and files', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-new-project').click();
  await page.getByTestId('mode-switch').getByText('2D').click();
  await expect(page.getByTestId('sketch-canvas')).toBeVisible();
  const at = await board(page);

  // a 3-4-5 right triangle with the line tool (clicking the first corner closes it)
  for (const [x, y] of [
    [0, 0],
    [3, 0],
    [3, 4],
    [0, 0],
  ] as const)
    await page.mouse.click(...at(x, y));
  await expect(page.getByTestId('sketch-line')).toHaveCount(3);

  // click inside it to measure it
  await page.getByTestId('sketch-tool-select').click();
  await page.mouse.click(...at(2.4, 1));
  await expect(page.getByTestId('measure-area')).toHaveText('6 cm²');
  await expect(page.getByTestId('measure-perimeter')).toHaveText('12 cm');

  // a circle: click the centre, type the radius
  await page.getByTestId('sketch-tool-circle').click();
  await page.mouse.click(...at(-4, 2));
  await page.getByTestId('sketch-radius-input').fill('2');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('sketch-circle')).toHaveCount(1);
  await expect(page.getByTestId('measure-area')).toHaveText('12.57 cm²');

  // the long side, made horizontal; its corners move and the other lines follow
  await page.getByTestId('sketch-tool-select').click();
  await page.mouse.click(...at(1.5, 2));
  await expect(page.getByTestId('sketch-line-length')).toHaveValue('5');
  await page.getByTestId('sketch-horizontal').click();
  await expect(page.getByTestId('measure-angle-from-horizontal')).toHaveText('0°');
  await expect(page.getByTestId('sketch-line')).toHaveCount(3);

  // drag a corner: the rule still holds
  const corner = at(3, 0);
  await page.mouse.move(...corner);
  await page.mouse.down();
  await page.mouse.move(...at(5, -1), { steps: 6 });
  await page.mouse.up();
  await page.mouse.click(...at(1.5, 2));
  await expect(page.getByTestId('measure-angle-from-horizontal')).toHaveText('0°');

  // undo the drag
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('sketch-line')).toHaveCount(3);

  // files
  await page.getByTestId('open-export').click();
  const [svg] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-sketch-svg').click(),
  ]);
  expect(svg.suggestedFilename()).toMatch(/sketch\.svg$/);
  expect(readFileSync(await svg.path(), 'utf8').match(/<line /g)).toHaveLength(3);
  const [dxf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-sketch-dxf').click(),
  ]);
  const dxfText = readFileSync(await dxf.path(), 'utf8');
  expect(dxfText).toContain('CIRCLE');
  expect(dxfText.trim().endsWith('EOF')).toBe(true);
  const [png] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PNG' }).click(),
  ]);
  expect(
    readFileSync(await png.path())
      .subarray(1, 4)
      .toString(),
  ).toBe('PNG');
  const [pdf] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download PDF' }).click(),
  ]);
  expect(
    readFileSync(await pdf.path())
      .subarray(0, 4)
      .toString(),
  ).toBe('%PDF');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();

  // into 3D: click inside the circle (away from its centre point) and push it up
  await page.mouse.click(...at(-3.2, 2.6));
  await page.getByTestId('sketch-push-up').click();
  await expect(page.getByTestId('object-count')).toHaveText('1 object');

  // the sketch is saved with the project
  await page.reload();
  await page.getByTestId('mode-switch').getByText('2D').click();
  await expect(page.getByTestId('sketch-line')).toHaveCount(3);
  await expect(page.getByTestId('sketch-circle')).toHaveCount(1);
});
