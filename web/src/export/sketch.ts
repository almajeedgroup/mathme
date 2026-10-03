import { fmt } from '../engine/math';
import { findLoops, loopCoords, perimeter, pointMap, signedArea } from '../engine/sketch/geometry';
import type { Project, Sketch, Units } from '../engine/types';

/**
 * Files made from the 2D sketch: SVG (laser cutters, Inkscape), PNG (a picture), PDF (a printable sheet
 * with the measurements) and DXF (CAD programs and CNC machines). Sizes are in the project's units.
 */

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function sketchBounds(sketch: Sketch): Bounds {
  const byId = pointMap(sketch);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of sketch.points) {
    xs.push(p.x);
    ys.push(p.y);
  }
  for (const c of sketch.circles) {
    const p = byId.get(c.c);
    if (!p) continue;
    xs.push(p.x - c.r, p.x + c.r);
    ys.push(p.y - c.r, p.y + c.r);
  }
  if (!xs.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

const n = (v: number) => Number(v.toFixed(4));
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** An SVG of the sketch, drawn at real size (1 sketch unit = 1 project unit). */
export function sketchToSvg(sketch: Sketch, units: Units, opts: { measures?: boolean } = {}): string {
  const b = sketchBounds(sketch);
  const size = Math.max(b.maxX - b.minX, b.maxY - b.minY, 1);
  const pad = size * 0.08;
  const w = b.maxX - b.minX + 2 * pad;
  const h = b.maxY - b.minY + 2 * pad;
  const stroke = n(size / 250);
  const font = n(size / 40);
  // SVG's y goes down the page, so flip it: (x, y) → (x, −y)
  const X = (x: number) => n(x);
  const Y = (y: number) => n(-y);
  const byId = pointMap(sketch);
  const out: string[] = [];
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}${units}" height="${n(h)}${units}" viewBox="${n(b.minX - pad)} ${n(-b.maxY - pad)} ${n(w)} ${n(h)}">`,
    `<title>${esc('MathMe sketch')}</title>`,
    `<g fill="none" stroke="#5a2db3" stroke-width="${stroke}" stroke-linecap="round">`,
  );
  for (const l of sketch.lines) {
    const a = byId.get(l.a);
    const c = byId.get(l.b);
    if (a && c) out.push(`<line x1="${X(a.x)}" y1="${Y(a.y)}" x2="${X(c.x)}" y2="${Y(c.y)}"/>`);
  }
  for (const k of sketch.circles) {
    const c = byId.get(k.c);
    if (c) out.push(`<circle cx="${X(c.x)}" cy="${Y(c.y)}" r="${n(k.r)}"/>`);
  }
  out.push('</g>');
  if (opts.measures) {
    out.push(`<g fill="#6b5d86" font-family="sans-serif" font-size="${font}" text-anchor="middle">`);
    for (const l of sketch.lines) {
      const a = byId.get(l.a);
      const c = byId.get(l.b);
      if (!a || !c) continue;
      out.push(
        `<text x="${X((a.x + c.x) / 2)}" y="${n(Y((a.y + c.y) / 2) - font * 0.6)}">${fmt(Math.hypot(c.x - a.x, c.y - a.y))}</text>`,
      );
    }
    for (const k of sketch.circles) {
      const c = byId.get(k.c);
      if (c) out.push(`<text x="${X(c.x)}" y="${n(Y(c.y) - font * 0.6)}">r = ${fmt(k.r)}</text>`);
    }
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('\n');
}

/** A PNG picture of the sketch, about `pixels` wide, on a white background. */
export async function sketchToPng(
  sketch: Sketch,
  units: Units,
  pixels = 2048,
  measures = true,
): Promise<Blob> {
  const svg = sketchToSvg(sketch, units, { measures });
  const b = sketchBounds(sketch);
  const aspect = Math.max(0.2, Math.min(5, (b.maxY - b.minY || 1) / (b.maxX - b.minX || 1)));
  const w = pixels;
  const h = Math.round(pixels * aspect);
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not make the picture.'))),
      'image/png',
    ),
  );
}

/** DXF $INSUNITS codes. */
const DXF_UNITS: Record<Units, number> = { mm: 4, cm: 5, m: 6 };

/** A DXF (R12, plain text) file: LINE, CIRCLE and POINT entities, read by almost every CAD program. */
export function sketchToDxf(sketch: Sketch, units: Units): string {
  const byId = pointMap(sketch);
  const rows: (string | number)[] = [
    0,
    'SECTION',
    2,
    'HEADER',
    9,
    '$ACADVER',
    1,
    'AC1009',
    9,
    '$INSUNITS',
    70,
    DXF_UNITS[units],
    0,
    'ENDSEC',
    0,
    'SECTION',
    2,
    'ENTITIES',
  ];
  for (const l of sketch.lines) {
    const a = byId.get(l.a);
    const b = byId.get(l.b);
    if (!a || !b) continue;
    rows.push(0, 'LINE', 8, 'MATHME', 10, n(a.x), 20, n(a.y), 30, 0, 11, n(b.x), 21, n(b.y), 31, 0);
  }
  for (const c of sketch.circles) {
    const p = byId.get(c.c);
    if (p) rows.push(0, 'CIRCLE', 8, 'MATHME', 10, n(p.x), 20, n(p.y), 30, 0, 40, n(c.r));
  }
  // points drawn on their own (not line ends or circle centres)
  const used = new Set([...sketch.lines.flatMap((l) => [l.a, l.b]), ...sketch.circles.map((c) => c.c)]);
  for (const p of sketch.points) {
    if (!used.has(p.id)) rows.push(0, 'POINT', 8, 'MATHME', 10, n(p.x), 20, n(p.y), 30, 0);
  }
  rows.push(0, 'ENDSEC', 0, 'EOF');
  // group code and value each on their own line, as DXF expects
  return rows.map(String).join('\n') + '\n';
}

/** A printable A4 sheet: the drawing scaled to fit, a scale bar, and the measurements. */
export async function sketchToPdf(project: Project): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const { pdfSafe } = await import('./pdf');
  const sketch = project.sketch!;
  const units = project.units;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(pdfSafe(project.name || 'MathMe sketch'), 16, 20);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(pdfSafe(`2D sketch${project.author ? ` by ${project.author}` : ''} · sizes in ${units}`), 16, 27);

  // fit the drawing into a 178 × 150 mm box
  const b = sketchBounds(sketch);
  const w = b.maxX - b.minX || 1;
  const h = b.maxY - b.minY || 1;
  const scale = Math.min(178 / w, 150 / h);
  const ox = 16 + (178 - w * scale) / 2;
  const oy = 35 + (150 - h * scale) / 2;
  const X = (x: number) => ox + (x - b.minX) * scale;
  const Y = (y: number) => oy + (b.maxY - y) * scale;
  const byId = pointMap(sketch);
  doc.setDrawColor(90, 45, 179);
  doc.setLineWidth(0.5);
  for (const l of sketch.lines) {
    const a = byId.get(l.a);
    const c = byId.get(l.b);
    if (a && c) doc.line(X(a.x), Y(a.y), X(c.x), Y(c.y));
  }
  for (const k of sketch.circles) {
    const c = byId.get(k.c);
    if (c) doc.circle(X(c.x), Y(c.y), k.r * scale, 'S');
  }
  doc.setFillColor(255, 45, 148);
  for (const p of sketch.points) doc.circle(X(p.x), Y(p.y), 0.7, 'F');

  // scale bar: a round number of units about 40 mm long
  const target = 40 / scale;
  const pow = 10 ** Math.floor(Math.log10(target));
  const barUnits = [1, 2, 5, 10].map((m) => m * pow).find((v) => v >= target) ?? target;
  doc.setDrawColor(40, 40, 40);
  doc.line(16, 192, 16 + barUnits * scale, 192);
  doc.line(16, 190.5, 16, 193.5);
  doc.line(16 + barUnits * scale, 190.5, 16 + barUnits * scale, 193.5);
  doc.setFontSize(9);
  doc.text(pdfSafe(`${fmt(barUnits)} ${units}`), 16, 197);

  // measurements
  let y = 208;
  const line = (text: string, bold = false) => {
    if (y > 282) {
      doc.addPage();
      y = 20;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.text(pdfSafe(text), 16, y);
    y += 5.5;
  };
  doc.setFontSize(12);
  line('Measurements', true);
  doc.setFontSize(9.5);
  sketch.lines.forEach((l, i) => {
    const a = byId.get(l.a);
    const c = byId.get(l.b);
    if (!a || !c) return;
    const len = Math.hypot(c.x - a.x, c.y - a.y);
    line(`Line ${i + 1}: L = √(${fmt(c.x - a.x)}² + ${fmt(c.y - a.y)}²) = ${fmt(len)} ${units}`);
  });
  sketch.circles.forEach((k, i) =>
    line(
      `Circle ${i + 1}: r = ${fmt(k.r)} ${units}, C = 2πr = ${fmt(2 * Math.PI * k.r)} ${units}, A = πr² = ${fmt(Math.PI * k.r * k.r)} ${units}²`,
    ),
  );
  findLoops(sketch).forEach((loop, i) => {
    const poly = loopCoords(sketch, loop);
    line(
      `Closed shape ${i + 1} (${poly.length} corners): perimeter ${fmt(perimeter(poly))} ${units}, area (shoelace) ${fmt(Math.abs(signedArea(poly)))} ${units}²`,
    );
  });
  if (sketch.constraints.length) {
    y += 2;
    line('Rules', true);
    for (const c of sketch.constraints) line(`${c.type}${c.value !== undefined ? ` = ${fmt(c.value)}` : ''}`);
  }
  return doc.output('blob');
}
