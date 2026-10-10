// Renders diagrams/*.svg to diagrams/png/*.png (2x) with Chromium, for the Word file.
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../web/package.json'));
const { chromium } = require('@playwright/test');

export async function rasterize() {
  const dir = path.join(here, 'diagrams');
  const out = path.join(dir, 'png');
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.svg'))) {
    const svg = readFileSync(path.join(dir, f), 'utf8');
    const [, w, h] = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    await page.setViewportSize({ width: Number(w), height: Number(h) });
    await page.setContent(`<html><body style="margin:0">${svg}</body></html>`);
    await page.screenshot({ path: path.join(out, f.replace('.svg', '.png')), clip: { x: 0, y: 0, width: Number(w), height: Number(h) } });
  }
  await browser.close();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await rasterize();
