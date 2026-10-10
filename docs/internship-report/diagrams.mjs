// Draws the report's diagrams as SVG (black and white, report style) into diagrams/.
// Run: node diagrams.mjs   (build-docx.mjs rasterises them to PNG for Word)
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, 'diagrams');
mkdirSync(OUT, { recursive: true });

const FONT = "'Liberation Serif','Times New Roman',Times,serif";
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function svg(w, h, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" font-family="${FONT}">
<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="#111"/>
  </marker>
</defs>
<rect width="${w}" height="${h}" fill="#fff"/>
${body}
</svg>`;
}

/** Centred multi-line text. */
function text(x, y, lines, { size = 15, weight = 400, anchor = 'middle', style = '' } = {}) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const lh = size * 1.25;
  const y0 = y - ((arr.length - 1) * lh) / 2;
  return arr
    .map(
      (l, i) =>
        `<text x="${x}" y="${y0 + i * lh}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" dominant-baseline="middle"${style ? ` font-style="${style}"` : ''}>${esc(l)}</text>`,
    )
    .join('\n');
}

function box(x, y, w, h, lines, { fill = '#fff', size = 15, weight = 400, rx = 4, dash = false, title } = {}) {
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="#111" stroke-width="1.4"${dash ? ' stroke-dasharray="6 4"' : ''}/>`;
  if (title) {
    out += `<rect x="${x}" y="${y}" width="${w}" height="26" rx="${rx}" fill="#e6e6e6" stroke="#111" stroke-width="1.4"/>`;
    out += text(x + w / 2, y + 13, title, { size: 15, weight: 700 });
    out += text(x + w / 2, y + 26 + (h - 26) / 2, lines, { size, weight });
  } else out += text(x + w / 2, y + h / 2, lines, { size, weight });
  return out;
}

function line(x1, y1, x2, y2, { arrow = true, both = false, dash = false, label, lx, ly, size = 13 } = {}) {
  let out = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#111" stroke-width="1.3"${arrow ? ' marker-end="url(#arrow)"' : ''}${both ? ' marker-start="url(#arrow)"' : ''}${dash ? ' stroke-dasharray="6 4"' : ''}/>`;
  if (label) {
    const tx = lx ?? (x1 + x2) / 2;
    const ty = ly ?? (y1 + y2) / 2 - 9;
    const arr = Array.isArray(label) ? label : [label];
    const w = Math.max(...arr.map((l) => l.length)) * size * 0.5 + 8;
    const h = arr.length * size * 1.25 + 2;
    out += `<rect x="${tx - w / 2}" y="${ty - h / 2}" width="${w}" height="${h}" fill="#fff"/>`;
    out += text(tx, ty, arr, { size, style: 'italic' });
  }
  return out;
}

/** Two opposite flows between a and b, drawn side by side, each labelled on its own side. */
function pair(ax, ay, bx, by, toB, toA, { gap = 9, off = 26, size = 13 } = {}) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  let out = line(ax + nx * gap, ay + ny * gap, bx + nx * gap, by + ny * gap);
  out += line(bx - nx * gap, by - ny * gap, ax - nx * gap, ay - ny * gap);
  const lab = (lines, sx, sy) => {
    const arr = Array.isArray(lines) ? lines : [lines];
    const w = Math.max(...arr.map((l) => l.length)) * size * 0.25;
    return text(sx + Math.sign(nx || 0.0001) * 0 + (nx > 0 ? w : -w) * Math.abs(nx), sy, arr, { size, style: 'italic' });
  };
  out += lab(toB, mx + nx * off, my + ny * off);
  out += lab(toA, mx - nx * off, my - ny * off);
  return out;
}

function poly(points, { arrow = true, dash = false } = {}) {
  return `<polyline points="${points.map((p) => p.join(',')).join(' ')}" fill="none" stroke="#111" stroke-width="1.3"${arrow ? ' marker-end="url(#arrow)"' : ''}${dash ? ' stroke-dasharray="6 4"' : ''}/>`;
}

function circleProc(cx, cy, r, lines, num) {
  let out = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" stroke="#111" stroke-width="1.4"/>`;
  if (num) {
    out += `<line x1="${cx - r * 0.82}" y1="${cy - r * 0.42}" x2="${cx + r * 0.82}" y2="${cy - r * 0.42}" stroke="#111" stroke-width="1"/>`;
    out += text(cx, cy - r * 0.63, num, { size: 13, weight: 700 });
    out += text(cx, cy + r * 0.18, lines, { size: 14 });
  } else out += text(cx, cy, lines, { size: 15, weight: 700 });
  return out;
}

function store(x, y, w, id, name) {
  return `<line x1="${x}" y1="${y}" x2="${x + w}" y2="${y}" stroke="#111" stroke-width="1.4"/>
<line x1="${x}" y1="${y + 30}" x2="${x + w}" y2="${y + 30}" stroke="#111" stroke-width="1.4"/>
<line x1="${x + 40}" y1="${y}" x2="${x + 40}" y2="${y + 30}" stroke="#111" stroke-width="1.4"/>
<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 30}" stroke="#111" stroke-width="1.4"/>
${text(x + 20, y + 15, id, { size: 13, weight: 700 })}
${text(x + 40 + (w - 40) / 2, y + 15, name, { size: 14 })}`;
}

const save = (name, content) => writeFileSync(path.join(OUT, `${name}.svg`), content);

// ---------------------------------------------------------------- 1. architecture
save(
  'architecture',
  svg(
    960,
    600,
    [
      box(20, 30, 250, 230, ['React 19 + TypeScript', 'react-three-fiber (Three.js)', 'Mantine UI, zustand store', 'Maths engine (patterns,', 'formulas, recipes, sketch)', 'Exports: GLB, STL, OBJ,', 'PNG, SVG, DXF, PDF'], {
        title: 'Browser: MathMe web app',
        size: 14,
      }),
      box(20, 300, 250, 90, ['Projects saved on the device', '(localStorage / IndexedDB)'], { title: 'Browser storage', size: 14 }),
      line(145, 260, 145, 300, { both: true }),
      box(355, 30, 270, 230, ['FastAPI app (Python)', 'Sign-in, sessions, cloud projects', 'Plans, limits and usage', 'Cashfree checkout + webhooks', 'GST invoices, Campus licences', 'Owner dashboard metrics', 'Serves the web app files'], {
        title: 'Cloudflare Python Worker',
        size: 14,
      }),
      line(270, 120, 355, 120, { both: true, label: 'HTTPS  /api/*', ly: 105 }),
      box(355, 300, 112, 70, ['D1 (SQLite)', 'users, plans…'], { size: 14 }),
      box(513, 300, 112, 70, ['R2 storage', 'project files'], { size: 14 }),
      line(411, 260, 411, 300, { both: true }),
      line(569, 260, 569, 300, { both: true }),
      box(700, 30, 240, 100, ['Google OAuth', '(sign-in)'], { size: 15 }),
      box(700, 150, 240, 100, ['Cashfree Payments', 'UPI AutoPay, orders, links'], { size: 15 }),
      box(700, 270, 240, 80, ['Resend (email)', 'receipts, reminders'], { size: 15 }),
      line(625, 80, 700, 80, { both: true }),
      line(625, 190, 700, 190, { both: true, label: 'webhooks', ly: 176 }),
      line(625, 245, 700, 300, { arrow: true }),
      box(355, 440, 270, 140, ['FastAPI + trimesh + manifold3d', 'Measure, join, cut, overlap', 'Print-ready STL, heart slicer', 'AI chat helper (Claude API)'], {
        title: 'Geometry service (Docker)',
        size: 14,
      }),
      line(490, 260, 490, 440),
      text(570, 405, ['quota checked,', 'shared secret'], { size: 13, style: 'italic' }),
      box(700, 470, 240, 80, ['Claude API', '(optional AI answers)'], { size: 15, dash: true }),
      line(625, 510, 700, 510, { arrow: true }),
      box(20, 440, 250, 140, ['Without accounts (demo,', 'self-hosting) the browser', 'calls the geometry service', 'directly and everything', 'stays on the device.'], { size: 14, dash: true }),
    ].join('\n'),
  ),
);

// ---------------------------------------------------------------- 2. DFD level 0
save(
  'dfd0',
  svg(
    960,
    560,
    [
      circleProc(480, 280, 115, ['MathMe', '3D Studio', 'System'], '0'),
      box(20, 70, 200, 70, ['Student / Maker'], { size: 16, weight: 700 }),
      box(20, 420, 200, 70, ['Teacher'], { size: 16, weight: 700 }),
      box(740, 70, 200, 70, ['Owner (admin)'], { size: 16, weight: 700 }),
      box(740, 245, 200, 70, ['Google OAuth'], { size: 16, weight: 700 }),
      box(740, 420, 200, 70, ['Cashfree / Resend'], { size: 16, weight: 700 }),
      pair(220, 120, 392, 205, ['shapes, patterns,', 'recipes, sketches'], ['3D view, formulas,', 'exported files'], { off: 62 }),
      pair(220, 440, 392, 355, ['class page,', 'shared projects'], ['join code,', 'class actions'], { off: 62 }),
      pair(740, 120, 568, 205, ['licences,', 'enquiry status'], ['metrics,', 'payments'], { off: 62 }),
      line(595, 280, 740, 280, { both: true }),
      text(668, 262, 'identity', { size: 13, style: 'italic' }),
      pair(740, 440, 568, 355, ['payment events'], ['orders, emails'], { off: 50 }),
    ].join('\n'),
  ),
);

// ---------------------------------------------------------------- 3. DFD level 1
save(
  'dfd1',
  svg(
    1100,
    760,
    [
      box(20, 80, 170, 60, ['Student / Maker'], { size: 15, weight: 700 }),
      box(20, 530, 170, 60, ['Teacher'], { size: 15, weight: 700 }),
      box(900, 600, 170, 60, ['Owner'], { size: 15, weight: 700 }),
      box(930, 300, 160, 60, ['Cashfree'], { size: 15, weight: 700 }),
      circleProc(340, 110, 60, ['Build', 'scene'], '1.0'),
      circleProc(580, 110, 60, ['Export', 'files'], '2.0'),
      circleProc(340, 330, 60, ['Geometry', 'jobs'], '3.0'),
      circleProc(580, 330, 60, ['Sign in &', 'cloud save'], '4.0'),
      circleProc(820, 330, 60, ['Billing', '& GST'], '5.0'),
      circleProc(340, 560, 60, ['Campus', 'class'], '6.0'),
      circleProc(640, 630, 60, ['Owner', 'dashboard'], '7.0'),
      store(40, 300, 200, 'D1', 'Device projects'),
      store(480, 460, 200, 'D2', 'Users & projects'),
      store(740, 460, 200, 'D3', 'Payments'),
      store(240, 690, 200, 'D4', 'Orgs & members'),
      line(190, 110, 280, 110),
      text(235, 96, 'recipe', { size: 13, style: 'italic' }),
      line(400, 110, 520, 110),
      text(460, 96, 'scene', { size: 13, style: 'italic' }),
      poly([
        [580, 50],
        [580, 28],
        [105, 28],
        [105, 80],
      ]),
      text(340, 16, 'GLB / STL / OBJ / PNG / PDF files', { size: 13, style: 'italic' }),
      line(298, 153, 190, 300, { both: true }),
      line(340, 170, 340, 270),
      text(362, 220, 'mesh', { size: 13, style: 'italic', anchor: 'start' }),
      line(580, 170, 580, 270),
      text(592, 220, 'export ticket', { size: 13, style: 'italic', anchor: 'start' }),
      line(640, 330, 760, 330),
      text(700, 316, 'plan', { size: 13, style: 'italic' }),
      line(880, 330, 930, 330, { both: true }),
      text(905, 290, ['payment', 'events'], { size: 12, style: 'italic' }),
      line(580, 390, 580, 460, { both: true }),
      line(820, 390, 830, 460),
      line(190, 560, 280, 560, { both: true }),
      text(235, 542, 'join code', { size: 13, style: 'italic' }),
      line(394, 533, 480, 482, { both: true }),
      text(410, 490, 'shared projects', { size: 13, style: 'italic', anchor: 'end' }),
      line(340, 620, 340, 690, { both: true }),
      line(615, 575, 590, 490),
      line(690, 600, 800, 490),
      text(770, 560, 'payments', { size: 13, style: 'italic', anchor: 'start' }),
      line(582, 652, 440, 700, { both: true }),
      line(900, 630, 700, 630, { both: true }),
      text(800, 614, 'licences, metrics', { size: 13, style: 'italic' }),
    ].join('\n'),
  ),
);

// ---------------------------------------------------------------- 4. ER diagram
function entity(x, y, name, attrs, w = 190) {
  const h = 30 + attrs.length * 21 + 8;
  let out = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#fff" stroke="#111" stroke-width="1.4"/>`;
  out += `<rect x="${x}" y="${y}" width="${w}" height="30" fill="#e6e6e6" stroke="#111" stroke-width="1.4"/>`;
  out += text(x + w / 2, y + 15, name, { size: 15, weight: 700 });
  attrs.forEach((a, i) => {
    const pk = a.startsWith('*');
    const fk = a.startsWith('#');
    const label = a.replace(/^[*#]/, '');
    out += `<text x="${x + 10}" y="${y + 47 + i * 21}" font-size="14" dominant-baseline="middle"${pk ? ' text-decoration="underline" font-weight="700"' : ''}${fk ? ' font-style="italic"' : ''}>${esc(label)}${fk ? ' (FK)' : ''}</text>`;
  });
  return { svg: out, x, y, w, h };
}
function rel(x1, y1, x2, y2, m1, m2, label) {
  let out = line(x1, y1, x2, y2, { arrow: false });
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  const ux = dx / len;
  const uy = dy / len;
  out += text(x1 + ux * 16 - uy * 10, y1 + uy * 16 + ux * 10, m1, { size: 14, weight: 700 });
  out += text(x2 - ux * 16 - uy * 10, y2 - uy * 16 + ux * 10, m2, { size: 14, weight: 700 });
  if (label) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    out += `<polygon points="${mx},${my - 16} ${mx + 42},${my} ${mx},${my + 16} ${mx - 42},${my}" fill="#fff" stroke="#111" stroke-width="1.2"/>`;
    out += text(mx, my, label, { size: 12 });
  }
  return out;
}
{
  const parts = [
    entity(40, 40, 'SESSIONS', ['*token_hash', '#user_id', 'expires_at']),
    entity(380, 40, 'USAGE', ['*user_id, kind, period', 'count']),
    entity(720, 40, 'SUBSCRIPTIONS', ['*id', '#user_id', 'plan, period', 'status', 'current_period_end']),
    entity(380, 230, 'USERS', ['*id', 'google_sub', 'email', 'name', 'role', 'created_at']),
    entity(40, 300, 'PROJECTS', ['*id', '#owner_id', 'name', 'objects', 'version', '#shared_org_id']),
    entity(720, 300, 'PAYMENTS', ['*id', '#user_id / #org_id', 'base, cgst, sgst, igst', 'total', 'provider_ref']),
    entity(380, 480, 'ORG_MEMBERS', ['*org_id, user_id', 'role', 'joined_at']),
    entity(720, 560, 'INVOICES', ['*id', 'number', '#payment_id', 'billing_state', 'lines']),
    entity(380, 650, 'ORGS', ['*id', 'name', 'status', 'student_seats', 'ends_at']),
  ].map((e) => e.svg);
  parts.push(
    rel(380, 262, 230, 110, '1', 'N', 'has'),
    rel(475, 230, 475, 120, '1', 'N', ''),
    rel(570, 262, 720, 110, '1', 'N', 'buys'),
    rel(380, 340, 230, 380, '1', 'N', 'owns'),
    rel(570, 340, 720, 380, '1', 'N', 'pays'),
    rel(475, 394, 475, 480, '1', 'N', ''),
    rel(475, 650, 475, 581, '1', 'N', ''),
    rel(815, 443, 815, 560, '1', '1', 'bills'),
    rel(190, 464, 380, 712, 'N', '1', 'shared'),
    rel(570, 712, 720, 430, '1', 'N', 'pays'),
  );
  parts.push(text(490, 178, 'counts', { size: 12, style: 'italic', anchor: 'start' }));
  parts.push(text(490, 440, 'joins', { size: 12, style: 'italic', anchor: 'start' }));
  parts.push(text(490, 618, 'has', { size: 12, style: 'italic', anchor: 'start' }));
  save('er', svg(960, 810, parts.join('\n')));
}

// ---------------------------------------------------------------- 5. use cases
function actor(x, y, name) {
  return `<circle cx="${x}" cy="${y}" r="14" fill="#fff" stroke="#111" stroke-width="1.4"/>
<line x1="${x}" y1="${y + 14}" x2="${x}" y2="${y + 52}" stroke="#111" stroke-width="1.4"/>
<line x1="${x - 22}" y1="${y + 28}" x2="${x + 22}" y2="${y + 28}" stroke="#111" stroke-width="1.4"/>
<line x1="${x}" y1="${y + 52}" x2="${x - 18}" y2="${y + 80}" stroke="#111" stroke-width="1.4"/>
<line x1="${x}" y1="${y + 52}" x2="${x + 18}" y2="${y + 80}" stroke="#111" stroke-width="1.4"/>
${text(x, y + 98, name, { size: 15, weight: 700 })}`;
}
function uc(cx, cy, label) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="112" ry="24" fill="#fff" stroke="#111" stroke-width="1.3"/>${text(cx, cy, label, { size: 14 })}`;
}
{
  const student = [
    'Create / open a project',
    'Add shapes, apply patterns',
    'Learn the formulas',
    'Draw with the pencil',
    'Sketch in 2D',
    'Cut the heart model',
    'Export files',
    'Sign in with Google',
    'Save projects in the cloud',
    'Upgrade (pay with GST)',
    'Join a class with a code',
    'Share a project with class',
  ].map((l, i) => [330, 62 + i * 50, l]);
  const teacher = ['Join with the teacher code', 'See the class page', 'Open a copy of a project', 'Remove a student'].map(
    (l, i) => [660, 80 + i * 55, l],
  );
  const owner = ['Answer enquiries', 'Manage Campus licences', 'Record payments, links', 'View metrics & revenue'].map(
    (l, i) => [660, 370 + i * 55, l],
  );
  const parts = [
    `<rect x="200" y="30" width="590" height="640" fill="none" stroke="#111" stroke-width="1.4"/>`,
    text(495, 655, 'MathMe 3D Studio', { size: 15, weight: 700, style: 'italic' }),
    ...[...student, ...teacher, ...owner].map(([x, y, l]) => uc(x, y, l)),
    actor(90, 270, 'Student'),
    actor(890, 130, 'Teacher'),
    actor(890, 400, 'Owner'),
    text(890, 255, ['(a teacher can also', 'do everything a', 'student can)'], { size: 12, style: 'italic' }),
  ];
  for (const [x, y] of student) parts.push(line(112, 300, x - 112, y, { arrow: false }));
  for (const [x, y] of teacher) parts.push(line(868, 160, x + 112, y, { arrow: false }));
  for (const [x, y] of owner) parts.push(line(868, 430, x + 112, y, { arrow: false }));
  save('usecase', svg(980, 690, parts.join('\n')));
}

// ---------------------------------------------------------------- 6. modules
{
  const col = (x, title, items, h) => box(x, 110, 225, h, items, { title, size: 14 });
  save(
    'modules',
    svg(
      980,
      520,
      [
        box(330, 20, 320, 50, ['MathMe repository (monorepo)'], { size: 17, weight: 700, fill: '#e6e6e6' }),
        col(10, 'web/src/engine', ['shapes/  (24 shapes)', 'patterns/  (7 patterns)', 'math.ts, expr.ts, rng.ts', 'command/  (recipe parser)', 'sketch/  (2D solver)', 'project/  (schema, presets)', 'measureShape.ts'], 230),
        col(250, 'web/src (app)', ['viewport/  (3D view)', 'ui/  (panels, dialogs)', 'state/  (zustand stores,', '      undo, persistence)', 'export/  (GLB STL OBJ', '      PNG SVG DXF PDF)', 'account/  (plans, cloud)'], 230),
        col(500, 'geometry-service', ['app/main.py  (FastAPI)', 'app/geometry.py', '(trimesh + manifold3d)', 'app/anatomy/', '(heart atlas, slicer)', 'app/assistant.py', 'tests/  (pytest)'], 230),
        col(745, 'account-service', ['routes/  auth, projects,', 'usage, billing, campus,', 'admin', 'cashfree.py, gst.py', 'db.py (D1 / SQLite)', 'migrations/  (SQL)', 'tests/  (pytest)'], 230),
        line(490, 70, 122, 110, { arrow: true }),
        line(490, 70, 362, 110, { arrow: true }),
        line(490, 70, 612, 110, { arrow: true }),
        line(490, 70, 857, 110, { arrow: true }),
        box(10, 370, 965, 140, ['shared/plans.json: one list of plans, prices and limits, read by the web app, the account service and the tests', 'web/landing/: landing page and policy pages',
          'docs/: plan, deployment guide and this report', '.github/workflows/ci.yml: lint, format, type check, unit tests, build, browser tests and pytest on every push'], {
          title: 'Shared files',
          size: 14,
        }),
      ].join('\n'),
    ),
  );
}

// ---------------------------------------------------------------- 7. checkout sequence
{
  const cols = [
    [90, 'User'],
    [270, 'Web app'],
    [470, 'Worker (API)'],
    [680, 'Cashfree'],
    [870, 'D1 + email'],
  ];
  const parts = [];
  for (const [x, name] of cols) {
    parts.push(box(x - 75, 20, 150, 40, [name], { size: 15, weight: 700, fill: '#e6e6e6' }));
    parts.push(`<line x1="${x}" y1="60" x2="${x}" y2="640" stroke="#111" stroke-width="1" stroke-dasharray="5 4"/>`);
  }
  const msg = (y, a, b, label, dash = false) => {
    const xa = cols[a][0];
    const xb = cols[b][0];
    return line(xa, y, xb + (xb > xa ? -2 : 2), y, { dash, label, ly: y - 12 });
  };
  parts.push(
    msg(100, 0, 1, 'Choose Plus, state, mobile'),
    msg(150, 1, 2, 'POST /api/billing/checkout'),
    msg(200, 2, 4, 'subscription (pending)'),
    msg(250, 2, 3, 'create subscription / order'),
    msg(300, 3, 2, 'session id', true),
    msg(350, 2, 1, 'session id', true),
    msg(400, 1, 3, 'Cashfree checkout (UPI / card)'),
    msg(450, 3, 2, 'signed webhook: payment success'),
    msg(500, 2, 4, 'payment + GST invoice, receipt'),
    msg(550, 2, 1, '/api/me: plan = Plus', true),
    msg(600, 1, 0, 'Plus features unlocked', true),
  );
  save('sequence', svg(960, 660, parts.join('\n')));
}

console.log('diagrams written');
