// Takes the MathMe screenshots used in the report (real screens of the app, accounts off and on).
// Run from this folder: `npm run capture` (builds the app first; needs the Python services' .venv folders).
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const web = path.join(root, 'web');
const require = createRequire(path.join(web, 'package.json'));
const { chromium } = require('@playwright/test');

const OUT = path.join(here, 'img');
const WEB = 4301; // accounts off
const WEB_ACC = 4302; // accounts on
const API = 8799;
const GEO = 8000;
const RUN = `/tmp/mathme-report-${process.pid}`;
mkdirSync(OUT, { recursive: true });

const procs = [];
function start(cmd, args, opts) {
  const p = spawn(cmd, args, { stdio: 'ignore', ...opts });
  procs.push(p);
  return p;
}
async function waitFor(url, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`timed out waiting for ${url}`);
}

console.log('building the app (accounts off and on)…');
execSync('npx vite build', { cwd: web, stdio: 'ignore' });
execSync('npx vite build --outDir dist-accounts', { cwd: web, stdio: 'ignore', env: { ...process.env, VITE_ACCOUNTS: 'on' } });

start(path.join(root, 'geometry-service/.venv/bin/python'), ['-m', 'uvicorn', 'app.main:app', '--port', String(GEO)], {
  cwd: path.join(root, 'geometry-service'),
});
start(
  path.join(root, 'account-service/.venv/bin/python'),
  ['-m', 'uvicorn', 'account_service.app:app', '--app-dir', path.join(root, 'account-service/src'), '--port', String(API)],
  {
    env: {
      ...process.env,
      PUBLIC_URL: `http://localhost:${WEB_ACC}`,
      PAYMENTS: 'fake',
      AUTH_TEST_LOGIN: '1',
      COOKIE_SECURE: '0',
      OWNER_EMAILS: 'owner@mathme.app',
      DB_PATH: `${RUN}.sqlite3`,
      BUCKET_DIR: `${RUN}-bucket`,
      SELLER_STATE: 'Karnataka',
      SELLER_GSTIN: '29ABCDE1234F1Z5',
      GEOMETRY_ORIGIN: `http://localhost:${GEO}`,
    },
  },
);
start(path.join(web, 'node_modules/.bin/vite'), ['preview', '--outDir', 'dist', '--port', String(WEB), '--strictPort'], { cwd: web });
start(path.join(web, 'node_modules/.bin/vite'), ['preview', '--outDir', 'dist-accounts', '--port', String(WEB_ACC), '--strictPort'], {
  cwd: web,
  env: { ...process.env, ACCOUNT_SERVICE_URL: `http://localhost:${API}` },
});
await Promise.all([
  waitFor(`http://localhost:${GEO}/health`),
  waitFor(`http://localhost:${API}/api/plans`),
  waitFor(`http://localhost:${WEB}/`),
  waitFor(`http://localhost:${WEB_ACC}/`),
]);

process.on('exit', () => procs.forEach((p) => p.kill()));
process.on('uncaughtException', (e) => {
  console.error(e);
  process.exit(1);
});
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});

async function newPage(base) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 860 },
    deviceScaleFactor: 1,
    baseURL: base,
    storageState: {
      cookies: [],
      origins: [{ origin: base, localStorage: [{ name: 'mathme.tour.done', value: '1' }] }],
    },
  });
  return ctx.newPage();
}
const shot = async (page, name, opts = {}) => {
  // no pop-up messages or tooltips in the pictures
  await page.addStyleTag({
    content: '.mantine-Notification-root, .mantine-Tooltip-tooltip { display: none !important; }',
  });
  if (!opts.keepMouse) await page.mouse.move(1, 1);
  await page.waitForTimeout(opts.wait ?? 900);
  await page.screenshot({ path: path.join(OUT, `${name}.jpg`), type: 'jpeg', quality: 84, ...opts.clip });
  console.log('  ', name);
};
const count = (page, text) =>
  page.getByTestId('object-count').filter({ hasText: text }).waitFor({ timeout: 30_000 });

// ---------------------------------------------------------------- accounts off
const base = `http://localhost:${WEB}`;
let page = await newPage(base);

await page.goto('/landing/');
await shot(page, 'landing', { wait: 1500 });
await page.goto('/landing/#pricing');
await shot(page, 'landing-pricing', { wait: 1200 });

await page.goto('/');
await page.getByTestId('chat-input').fill('50 red spheres in a circle');
await page.getByTestId('chat-send').click();
await count(page, '50 objects');
await page.waitForTimeout(800);
await page.getByTestId('go-home').click();
await page.getByTestId('home-idea-dna').click();
await count(page, '120 objects');
await page.waitForTimeout(800);
await page.getByTestId('go-home').click();
await shot(page, 'home', { wait: 1500 });

await page.goto('/#studio');
await page.getByRole('button', { name: 'File menu' }).click();
await page.getByRole('menuitem', { name: 'New empty scene' }).click();
const recipe = page.getByTestId('command-input');
await recipe.fill('100 spheres → spiral → radius 20 → rotation 30 → scale 0.5-2');
await recipe.press('Enter');
await count(page, '100 objects');
await page.getByTestId('outliner-row').first().click();
await shot(page, 'studio', { wait: 1500 });
await page.getByTestId('tab-learn').click();
await shot(page, 'learn', { wait: 1000 });
await page.getByTestId('tab-pattern').click();
await shot(page, 'pattern-tab', { wait: 800 });

await page.getByTestId('outliner-row').first().click();
await page.getByTestId('tab-measure').click();
const measureAll = page.getByTestId('measure-all');
if (await measureAll.isVisible().catch(() => false)) {
  await measureAll.click();
  await page.getByTestId('measure-result').waitFor({ timeout: 30_000 }).catch(() => undefined);
}
await shot(page, 'measure', { wait: 1200 });

await page.getByRole('button', { name: 'Ideas' }).click();
await shot(page, 'ideas', { wait: 1200 });
await page.getByTestId('preset-wave-field').click();
await page.waitForTimeout(1500);
await shot(page, 'wave-field', { wait: 1200 });

await page.getByTestId('open-export').click();
await shot(page, 'export', { wait: 1000 });
await page.keyboard.press('Escape');

await page.getByRole('button', { name: 'Ideas' }).click();
await page.getByTestId('preset-heart').click();
await count(page, '51 objects');
await page.getByTestId('cut-panel').waitFor();
await page.getByTestId('cut-preset').click();
await page.getByRole('option', { name: 'Four-chamber view' }).click();
await shot(page, 'heart', { wait: 2500 });

await page.goto('/#studio');
await page.getByRole('button', { name: 'File menu' }).click();
await page.getByRole('menuitem', { name: 'New empty scene' }).click();
await page.getByRole('tab', { name: 'Make' }).click();
await page.getByTestId('add-shape-lathe').click();
await shot(page, 'custom-shape', { wait: 1500 });

// pencil
await page.goto('/');
await page.getByTestId('home-draw').click();
await page.getByTestId('draw-toolbar').waitFor();
{
  const box = await page.getByTestId('viewport').boundingBox();
  const at = ([x, y]) => [box.x + box.width * x, box.y + box.height * y];
  const drag = async (pts) => {
    await page.mouse.move(...at(pts[0]));
    await page.mouse.down();
    for (const p of pts.slice(1)) await page.mouse.move(...at(p), { steps: 10 });
    await page.mouse.up();
  };
  await drag([
    [0.38, 0.55],
    [0.5, 0.48],
    [0.62, 0.55],
    [0.6, 0.75],
    [0.4, 0.75],
    [0.38, 0.56],
  ]);
  await page.getByTestId('draw-toolbar').getByText('Tube', { exact: true }).click();
  await drag([
    [0.2, 0.4],
    [0.35, 0.3],
    [0.5, 0.35],
    [0.7, 0.28],
    [0.82, 0.4],
  ]);
}
await shot(page, 'pencil', { wait: 1200 });

// 2D sketch
await page.goto('/');
await page.getByTestId('home-new-project').click();
await page.getByTestId('mode-switch').getByText('2D').click();
await page.getByTestId('sketch-canvas').waitFor();
{
  const box = await page.getByTestId('sketch-canvas').boundingBox();
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const at = (x, y) => [cx + x * 40, cy - y * 40];
  for (const [x, y] of [
    [0, 0],
    [3, 0],
    [3, 4],
    [0, 0],
  ])
    await page.mouse.click(...at(x, y));
  await page.getByTestId('sketch-tool-circle').click();
  await page.mouse.click(...at(-4, 2));
  await page.getByTestId('sketch-radius-input').fill('2');
  await page.keyboard.press('Enter');
  await page.getByTestId('sketch-tool-select').click();
  await page.mouse.click(...at(2.4, 1));
}
await shot(page, 'sketch', { wait: 1000 });

await page.goto('/#studio');
await page.getByRole('button', { name: 'Settings' }).click();
await shot(page, 'settings', { wait: 900 });
await page.keyboard.press('Escape');
await page.getByRole('button', { name: 'Help' }).click();
await page.getByRole('dialog', { name: 'Help' }).getByRole('tab', { name: 'Maths words' }).click();
await shot(page, 'help', { wait: 900 });
await page.context().close();

// ---------------------------------------------------------------- accounts on
const acc = `http://localhost:${WEB_ACC}`;
async function signIn(p, email, name) {
  const r = await p.request.post('/api/auth/test-login', { data: { email, name }, headers: { 'X-MathMe': '1' } });
  if (!r.ok()) throw new Error(`sign-in failed: ${r.status()}`);
}
const api = (p, method, url, data) =>
  p.request.fetch(url, { method, data, headers: { 'X-MathMe': '1' } }).then((r) => r.json());

page = await newPage(acc);
await signIn(page, 'sulaimaan@example.com', 'Sulaimaan');
await page.goto('/#studio');
await page.getByTestId('open-export').click();
await page.getByTestId('export-stl').click();
await page.getByText('3D printing (STL)').first().waitFor();
await shot(page, 'upgrade-prompt', { wait: 800 });
await page.getByTestId('prompt-see-plans').click();
await shot(page, 'pricing', { wait: 1200 });
await page.getByTestId('choose-plus').click();
await page.getByLabel('Mobile number').fill('9876543210');
await page.getByTestId('checkout-state').click();
await page.getByRole('option', { name: 'Karnataka' }).click();
await shot(page, 'checkout', { wait: 800 });
await page.getByTestId('checkout-pay').click();
await page.getByTestId('fake-pay').click();
await page.getByTestId('plan-badge').filter({ hasText: 'Plus' }).waitFor();
await page.getByTestId('account-settings').waitFor({ timeout: 10_000 }).catch(() => undefined);
await shot(page, 'account-settings', { wait: 1200 });
await page.context().close();

// a Campus licence, a teacher and a student
const owner = await newPage(acc);
await signIn(owner, 'owner@mathme.app', 'Owner');
const org = await api(owner, 'POST', '/api/admin/orgs', { name: 'Green Valley College', status: 'pilot' });
const orgs = await api(owner, 'GET', '/api/admin/orgs');
const codes = Object.fromEntries(orgs.orgs.find((o) => o.id === org.id).codes.map((c) => [c.role, c.code]));
const teacher = await newPage(acc);
await signIn(teacher, 'teacher@example.com', 'Ms Iyer');
await api(teacher, 'POST', '/api/campus/join', { code: codes.teacher });
const projectFile = (name) => ({
  app: 'mathme-3d-studio',
  version: 1,
  name,
  author: '',
  units: 'cm',
  background: '#f6f3ff',
  nodes: [],
  library: [],
  meshes: [],
});
for (const [email, name, project] of [
  ['asha@example.com', 'Asha', 'Sunflower spiral'],
  ['ravi@example.com', 'Ravi', 'DNA helix'],
  ['meera@example.com', 'Meera', 'Wave field'],
]) {
  const s = await newPage(acc);
  await signIn(s, email, name);
  await api(s, 'POST', '/api/campus/join', { code: codes.student });
  const id = `project_${name.toLowerCase()}`;
  await api(s, 'PUT', `/api/projects/${id}`, { name: project, objects: 120, baseVersion: 0, data: projectFile(project) });
  await api(s, 'POST', `/api/projects/${id}/share`, { shared: true });
  await s.context().close();
}
await teacher.goto('/');
await teacher.getByTestId('account-row').click();
await teacher.getByRole('menuitem', { name: 'My class' }).click();
await teacher.getByTestId('class-page').waitFor();
await shot(teacher, 'class-page', { wait: 1200 });

await owner.goto('/#admin');
await owner.getByTestId('metrics').waitFor();
await shot(owner, 'admin', { wait: 1500 });
await owner.getByRole('tab', { name: 'Campus licences' }).click();
await shot(owner, 'admin-campus', { wait: 1000 });
await owner.getByRole('tab', { name: 'Revenue calculator' }).click();
await shot(owner, 'admin-calculator', { wait: 1000 });

await browser.close();
for (const p of procs) p.kill();
rmSync(`${RUN}.sqlite3`, { force: true });
rmSync(`${RUN}-bucket`, { recursive: true, force: true });
console.log('done');
process.exit(0);
