// Render GLB files to PNG with three.js in headless Chromium.
// Usage: node web/scripts/render-glb.mjs jobs.json
// jobs.json: [{ "glb": "/abs/path/model.glb", "out": "/abs/path/out.png", "size": 1200,
//               "dir": [0,0,1], "up": [0,1,0], "half": null }]
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const jobs = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const allowed = new Set(jobs.map((j) => resolve(j.glb)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary' };

const server = createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file;
  if (url.startsWith('/glb/')) file = resolve(url.slice(4));
  else file = join(repo, url);
  const ok =
    (file.startsWith(join(repo, 'web')) || allowed.has(file)) && existsSync(file) && statSync(file).isFile();
  if (!ok) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': types[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${port}/web/scripts/render-glb.html`);
  await page.waitForFunction(() => window.ready === true);
  for (const job of jobs) {
    const dataUrl = await page.evaluate((j) => window.renderJob(j), {
      ...job,
      glb: `/glb${resolve(job.glb)}`,
      size: job.size ?? 1200,
      up: job.up ?? [0, 1, 0],
      half: job.half ?? null,
    });
    writeFileSync(job.out, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('rendered', job.out);
  }
} finally {
  await browser.close();
  server.close();
}
