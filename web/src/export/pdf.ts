import { jsPDF } from 'jspdf';
import { Vector3 } from 'three';

import { countObjects } from '../engine/evaluate';
import { fmt } from '../engine/math';
import { measureNode } from '../engine/measureNode';
import { getPattern } from '../engine/patterns/registry';
import type { Project, Units } from '../engine/types';
import { describeNode } from './describe';
import { blobToDataUrl, renderImages, VIEW_LABELS, type ViewName } from './image';

/**
 * The built-in PDF fonts only have Western European letters, so maths symbols are
 * written out (π → pi, √ → sqrt, θ → theta …).
 */
const PDF_REPLACEMENTS: [RegExp, string][] = [
  [/π/g, 'pi'],
  [/θ/g, 'theta'],
  [/∛/g, 'cbrt'],
  [/√/g, 'sqrt'],
  [/Σ/g, 'sum'],
  [/⅓/g, '1/3'],
  [/≈/g, '~'],
  [/↔/g, '<->'],
  [/↕/g, 'up/down'],
  [/→/g, '->'],
  [/…/g, '...'],
  [/⌊/g, 'floor('],
  [/⌋/g, ')'],
  [/ᵢ₊₁/g, '_(i+1)'],
  [/ᵢ/g, '_i'],
  [/₁/g, '1'],
  [/₂/g, '2'],
  [/−/g, '-'],
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
];

export function pdfSafe(text: string): string {
  let out = text;
  for (const [re, rep] of PDF_REPLACEMENTS) out = out.replace(re, rep);
  // drop anything else the PDF font cannot draw (emoji etc.), keep Latin-1 like × ÷ ° ² ³ ½ ·
  return out.replace(/[^\x20-\x7e\xa0-\xff\n–—•]/gu, '');
}

const sup = (p: 1 | 2 | 3) => (p === 3 ? '³' : p === 2 ? '²' : '');
const amount = (v: number, p: 1 | 2 | 3, units: Units) =>
  `${Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : fmt(v)} ${units}${sup(p)}`;

class Writer {
  y = 20;
  readonly left = 16;
  readonly width = 178;
  constructor(readonly doc: jsPDF) {}
  ensure(h: number) {
    if (this.y + h > 280) {
      this.doc.addPage();
      this.y = 20;
    }
  }
  heading(text: string, size = 15) {
    this.ensure(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(size);
    this.doc.setTextColor(40, 50, 120);
    this.doc.text(pdfSafe(text), this.left, this.y);
    this.y += size * 0.5 + 2;
    this.doc.setTextColor(30, 30, 30);
  }
  para(
    text: string,
    opts: { size?: number; bold?: boolean; mono?: boolean; indent?: number; color?: number } = {},
  ) {
    const size = opts.size ?? 10;
    this.doc.setFont(opts.mono ? 'courier' : 'helvetica', opts.bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(opts.color ?? 30);
    const indent = opts.indent ?? 0;
    const lines = this.doc.splitTextToSize(pdfSafe(text), this.width - indent) as string[];
    const lh = size * 0.42 + 0.8;
    for (const line of lines) {
      this.ensure(lh);
      this.doc.text(line, this.left + indent, this.y);
      this.y += lh;
    }
    this.doc.setTextColor(30);
  }
  gap(h = 3) {
    this.y += h;
  }
}

export async function exportPdf(project: Project): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const w = new Writer(doc);
  const units = project.units;
  const count = countObjects(project);

  // ---- pictures
  const views: ViewName[] = ['front', 'top', 'side', 'iso'];
  const { blobs, bounds } = await renderImages(
    project,
    [
      { view: 'current', width: 1800, height: 1200 },
      ...views.map((view) => ({ view, width: 900, height: 900 })),
    ],
    { type: 'image/jpeg' },
  );
  const images = await Promise.all(blobs.map(blobToDataUrl));
  const size = bounds.isEmpty() ? new Vector3() : bounds.getSize(new Vector3());

  // ---- page 1: title and big picture
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(40, 50, 120);
  doc.text(pdfSafe(project.name || 'My 3D artwork'), w.left, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(90);
  const by = project.author ? `Made by ${project.author}` : 'Made';
  doc.text(pdfSafe(`${by} with MathMe 3D Studio · ${new Date().toLocaleDateString('en-GB')}`), w.left, 31);
  doc.addImage(images[0], 'JPEG', w.left, 38, w.width, (w.width * 2) / 3);
  w.y = 38 + (w.width * 2) / 3 + 10;
  w.heading('About this artwork', 13);
  w.para(
    `${count.toLocaleString('en-US')} objects. Overall size: ${fmt(size.x)} × ${fmt(size.y)} × ${fmt(size.z)} ${units} (width × height × depth).`,
  );
  w.gap(2);
  const tops = project.nodes.filter((n) => n.parentId === null);
  for (const n of tops) {
    const d =
      n.kind === 'pattern' ? `${n.count} × ${getPattern(n.pattern.type).label.toLowerCase()}` : n.kind;
    w.para(`• ${n.name} (${d})`, { indent: 2 });
  }

  // ---- page 2: views
  doc.addPage();
  w.y = 20;
  w.heading('Views from the front, top and side');
  const cell = 86;
  views.forEach((view, i) => {
    const x = w.left + (i % 2) * (cell + 6);
    const y = 32 + Math.floor(i / 2) * (cell + 14);
    doc.addImage(images[i + 1], 'JPEG', x, y, cell, cell);
    doc.setDrawColor(200);
    doc.rect(x, y, cell, cell);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(pdfSafe(VIEW_LABELS[view]), x, y + cell + 6);
  });
  w.y = 32 + 2 * (cell + 14) + 4;
  w.para(
    `The front, top and side views are drawn without perspective (like a technical drawing), so sizes can be compared. Width ${fmt(size.x)} ${units}, height ${fmt(size.y)} ${units}, depth ${fmt(size.z)} ${units}.`,
    { size: 9, color: 80 },
  );

  // ---- page 3+: how it was made and the maths
  doc.addPage();
  w.y = 20;
  w.heading('How it was made');
  for (const node of project.nodes) {
    const d = describeNode(node, project);
    w.ensure(20);
    w.para(d.title, { bold: true, size: 11 });
    for (const line of d.lines) w.para(line, { indent: 3, size: 9.5 });
    if (node.kind === 'pattern') {
      const def = getPattern(node.pattern.type);
      const ex = def.explain({ ...def.defaults, ...node.pattern.params }, node.count);
      w.ensure(24);
      w.para('The maths:', { indent: 3, size: 9.5, bold: true });
      w.para(ex.idea, { indent: 6, size: 9 });
      for (const f of ex.formulas) w.para(f, { indent: 6, size: 9, mono: true });
    }
    if (node.kind !== 'group') {
      const totals = measureNode(node, project);
      if (totals) {
        w.ensure(16);
        w.para('Measurements (one object):', { indent: 3, size: 9.5, bold: true });
        for (const l of totals.one.lines) {
          w.para(`${l.quantity}: ${l.formula}   ->   ${l.working} = ${amount(l.value, l.power, units)}`, {
            indent: 6,
            size: 9,
            mono: true,
          });
        }
        if (totals.one.method === 'mesh') {
          w.para(
            `Measured from the mesh (${totals.one.triangles.toLocaleString('en-US')} triangles): ` +
              (totals.one.volume !== null ? `volume ~ ${amount(totals.one.volume, 3, units)}, ` : '') +
              `surface area ~ ${amount(totals.one.area, 2, units)}`,
            { indent: 6, size: 9 },
          );
        }
        if (totals.count > 1 || totals.stretch !== 1) {
          w.para(
            `All ${totals.count.toLocaleString('en-US')}: ` +
              (totals.totalVolume !== null ? `volume ~ ${amount(totals.totalVolume, 3, units)}, ` : '') +
              `surface area ~ ${amount(totals.totalArea, 2, units)} (overlaps counted twice)`,
            { indent: 6, size: 9 },
          );
        }
      }
    }
    w.gap(4);
  }

  // ---- page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(pdfSafe(`${project.name} · page ${i} of ${pages}`), 105, 290, { align: 'center' });
  }
  return doc.output('blob');
}
