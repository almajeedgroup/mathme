// Builds MathMe_Internship_Report.docx from the same content as the PDF.
// Pass 1 writes the file with the PDF's page numbers in the contents; LibreOffice then renders it, the
// real Word page numbers are read back, and pass 2 writes the final file with those numbers.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  ImageRun,
  LevelFormat,
  NumberFormat,
  Packer,
  PageBorderDisplay,
  PageBorderOffsetFrom,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TabStopType,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

import JSZip from 'jszip';

import { body, frontMatter } from './content/index.mjs';
import { locate, outline, pdfPages } from './lib.mjs';
import { rasterize } from './rasterize.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(here, 'build');
mkdirSync(BUILD, { recursive: true });

const FONT = 'Times New Roman';
const MM = 56.7; // twips per millimetre
const PAGE = { width: 11906, height: 16838 };
const MARGIN = { top: Math.round(24 * MM), bottom: Math.round(27 * MM), left: Math.round(26 * MM), right: Math.round(22 * MM) };
const TEXT_W = PAGE.width - MARGIN.left - MARGIN.right; // twips
const TEXT_PX = Math.round((TEXT_W / 1440) * 96); // image pixels at 96 dpi
const LINE = 360; // 1.5 lines

// ---------------------------------------------------------------- inline text
function runs(text, base = {}) {
  const out = [];
  const re = /\*\*(.+?)\*\*|(?<![\w])_([^_]+?)_(?![\w])/g;
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    if (m[1] !== undefined) out.push(new TextRun({ text: m[1], ...base, bold: true }));
    else out.push(new TextRun({ text: m[2], ...base, italics: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

// ---------------------------------------------------------------- images
function pngSize(buf) {
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}
function jpgSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    i += 2 + len;
  }
  return null;
}
function image(src) {
  const png = path.join(here, 'diagrams', 'png', `${src}.png`);
  try {
    const data = readFileSync(png);
    return { data, type: 'png', ...pngSize(data), dia: true };
  } catch {
    const data = readFileSync(path.join(here, 'img', `${src}.jpg`));
    return { data, type: 'jpg', ...jpgSize(data), dia: false };
  }
}

// ---------------------------------------------------------------- blocks → Word
const thin = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin };
const noBorders = { top: none, bottom: none, left: none, right: none };

let listCount = 0;

function tocParagraphs(entries, levels = true) {
  const head = new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { after: 60 },
    children: [new TextRun({ text: 'Page', bold: true, size: 23 })],
  });
  return [
    head,
    ...entries.map(
      (e) =>
        new Paragraph({
          tabStops: [{ type: TabStopType.RIGHT, position: TEXT_W, leader: 'dot' }],
          indent: { left: levels ? [0, 320, 680][e.level ?? 1] : 0 },
          spacing: { line: 300, before: levels && e.level === 0 ? 100 : 0, after: 0 },
          children: [
            ...runs(e.label, { size: e.level === 2 ? 22 : 23, bold: levels && e.level === 0 }),
            new TextRun({ text: `\t${e.page ?? ''}`, size: 23, bold: levels && e.level === 0 }),
          ],
        }),
    ),
  ];
}

function convert(blocks, lists) {
  const out = [];
  for (const b of blocks) {
    switch (b.t) {
      case 'page':
        break;
      case 'break':
        out.push(new Paragraph({ pageBreakBefore: true, spacing: { after: 0, line: 240 }, children: [] }));
        break;
      case 'space':
        out.push(new Paragraph({ spacing: { before: Math.round(b.mm * MM * 0.6), after: 0, line: 240 }, children: [] }));
        break;
      case 'center':
      case 'right':
        out.push(
          new Paragraph({
            alignment: b.t === 'center' ? AlignmentType.CENTER : AlignmentType.RIGHT,
            spacing: { after: 50, line: 276 },
            children: runs(b.text, { size: Math.round(b.size * 2), bold: b.bold, italics: b.italic }),
          }),
        );
        break;
      case 'logo': {
        const data = readFileSync(path.join(BUILD, 'logo.png'));
        const { w, h } = pngSize(data);
        const hPx = Math.round(((b.mm * 0.85) / 25.4) * 96);
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [new ImageRun({ data, type: 'png', transformation: { width: Math.round((hPx * w) / h), height: hPx } })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [new TextRun({ text: 'MATHME', font: 'Arial', bold: true, size: 30, color: '3E1D8F', characterSpacing: 60 })],
          }),
        );
        break;
      }
      case 'title':
        out.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 280 },
            children: runs(b.text),
          }),
        );
        break;
      case 'chapter':
        out.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            spacing: { after: 320 },
            children: [new TextRun({ text: b.label }), new TextRun({ text: b.title, break: 1 })],
          }),
        );
        break;
      case 'h2':
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, children: runs(`${b.num} ${b.text}`) }));
        break;
      case 'h3':
        out.push(new Paragraph({ heading: HeadingLevel.HEADING_3, keepNext: true, children: runs(`${b.num} ${b.text}`) }));
        break;
      case 'p':
        out.push(
          new Paragraph({
            alignment: b.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
            children: runs(b.text),
          }),
        );
        break;
      case 'ul':
        for (const item of b.items)
          out.push(
            new Paragraph({
              numbering: { reference: 'bullets', level: 0 },
              alignment: AlignmentType.JUSTIFIED,
              spacing: { after: 60 },
              children: runs(item),
            }),
          );
        break;
      case 'ol': {
        listCount++;
        const size = b.compact ? 23 : 24;
        for (const item of b.items)
          out.push(
            new Paragraph({
              numbering: { reference: 'numbers', level: 0, instance: listCount },
              spacing: { after: b.compact ? 30 : 60, line: b.compact ? 300 : LINE },
              children: runs(item, { size }),
            }),
          );
        break;
      }
      case 'table': {
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            keepNext: true,
            spacing: { before: 120, after: 80, line: 276 },
            children: runs(`Table ${b.num}: ${b.caption}`, { bold: true, size: 22 }),
          }),
        );
        const widths = b.widths.map((w) => Math.round(w * TEXT_W));
        widths[widths.length - 1] += TEXT_W - widths.reduce((s, w) => s + w, 0);
        const cell = (text, i, head) =>
          new TableCell({
            width: { size: widths[i], type: WidthType.DXA },
            borders: cellBorders,
            margins: { top: 40, bottom: 40, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: head ? AlignmentType.CENTER : AlignmentType.LEFT,
                spacing: { after: 0, line: 264 },
                children: runs(text, { size: 22, bold: head || undefined }),
              }),
            ],
          });
        out.push(
          new Table({
            width: { size: TEXT_W, type: WidthType.DXA },
            columnWidths: widths,
            layout: TableLayoutType.FIXED,
            rows: [
              new TableRow({ tableHeader: true, cantSplit: true, children: b.head.map((h, i) => cell(h, i, true)) }),
              ...b.rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false)) })),
            ],
          }),
          new Paragraph({ spacing: { after: 120, line: 240 }, children: [] }),
        );
        break;
      }
      case 'fig': {
        const img = image(b.src);
        const w = Math.round(TEXT_PX * b.width);
        const h = Math.round((w * img.h) / img.w);
        out.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            keepNext: true,
            spacing: { before: 120, after: 60, line: 240 },
            children: [new ImageRun({ data: img.data, type: img.type, transformation: { width: w, height: h } })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200, line: 276 },
            children: [new TextRun({ text: `Figure ${b.num}: `, bold: true, size: 22 }), ...runs(b.caption, { size: 22 })],
          }),
        );
        break;
      }
      case 'code':
        out.push(
          new Paragraph({ keepNext: true, spacing: { after: 60, line: 276 }, children: runs(b.caption, { italics: true, size: 21 }) }),
          new Table({
            width: { size: TEXT_W, type: WidthType.DXA },
            columnWidths: [TEXT_W],
            rows: [
              new TableRow({
                cantSplit: true,
                children: [
                  new TableCell({
                    width: { size: TEXT_W, type: WidthType.DXA },
                    borders: cellBorders,
                    shading: { type: ShadingType.CLEAR, color: 'auto', fill: 'F3F3F3' },
                    margins: { top: 80, bottom: 80, left: 140, right: 140 },
                    children: b.text.split('\n').map(
                      (l) =>
                        new Paragraph({
                          spacing: { after: 0, line: 240 },
                          children: [new TextRun({ text: l || ' ', font: 'Courier New', size: 17 })],
                        }),
                    ),
                  }),
                ],
              }),
            ],
          }),
          new Paragraph({ spacing: { after: 160, line: 240 }, children: [] }),
        );
        break;
      case 'signs': {
        const n = b.items.length;
        const w = Math.round(TEXT_W / n);
        out.push(
          new Table({
            width: { size: w * n, type: WidthType.DXA },
            columnWidths: Array(n).fill(w),
            borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none },
            rows: [
              new TableRow({
                cantSplit: true,
                children: b.items.map(
                  ([label, name]) =>
                    new TableCell({
                      width: { size: w, type: WidthType.DXA },
                      borders: noBorders,
                      verticalAlign: VerticalAlign.TOP,
                      margins: { left: 200, right: 200 },
                      children: [
                        new Paragraph({
                          border: { top: { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 4 } },
                          alignment: AlignmentType.CENTER,
                          spacing: { after: 0, line: 276 },
                          children: runs(label || ' ', { size: 23 }),
                        }),
                        ...(name
                          ? [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0, line: 276 }, children: runs(name, { size: 23 }) })]
                          : []),
                      ],
                    }),
                ),
              }),
            ],
          }),
        );
        break;
      }
      case 'toc':
        out.push(...tocParagraphs(lists.toc));
        break;
      case 'lof':
        out.push(...tocParagraphs(lists.figs.map((e) => ({ ...e, level: 1 })), false));
        break;
      case 'lot':
        out.push(...tocParagraphs(lists.tabs.map((e) => ({ ...e, level: 1 })), false));
        break;
      default:
        throw new Error(`unknown block ${b.t}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------- document
const borderLine = (style, size) => ({ style, size, color: '000000', space: 24 });
const pageProps = (extra = {}) => ({
  page: {
    size: PAGE,
    margin: { ...MARGIN, header: Math.round(12 * MM), footer: Math.round(16 * MM) },
    borders: {
      pageBorders: { display: PageBorderDisplay.ALL_PAGES, offsetFrom: PageBorderOffsetFrom.PAGE },
      pageBorderTop: borderLine(BorderStyle.THICK_THIN_SMALL_GAP, 24),
      pageBorderBottom: borderLine(BorderStyle.THIN_THICK_SMALL_GAP, 24),
      pageBorderLeft: borderLine(BorderStyle.THICK_THIN_SMALL_GAP, 24),
      pageBorderRight: borderLine(BorderStyle.THIN_THICK_SMALL_GAP, 24),
    },
    ...extra,
  },
});

function stripLeadingBreak(blocks) {
  // a section break already starts a new page
  const out = [...blocks];
  while (out.length && (out[out.length - 1].t === 'break' || out[out.length - 1].t === 'page')) out.pop();
  return out;
}

function makeDoc(lists) {
  listCount = 0;
  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: 'Page ', size: 21 }),
          new TextRun({ children: [PageNumber.CURRENT], bold: true, size: 21 }),
          new TextRun({ text: ' of ', size: 21 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES_IN_SECTION], bold: true, size: 21 }),
        ],
      }),
    ],
  });
  return new Document({
    creator: 'Sulaimaan',
    title: 'MathMe 3D Studio: Internship Project Report',
    description: 'BCA Semester III internship project report',
    styles: {
      default: {
        document: { run: { font: FONT, size: 24 }, paragraph: { spacing: { line: LINE, after: 120 } } },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 32, bold: true, color: '000000' },
          paragraph: { spacing: { before: 0, after: 280, line: 320 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 26, bold: true, color: '000000' },
          paragraph: { spacing: { before: 240, after: 100, line: 300 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: FONT, size: 24, bold: true, color: '000000' },
          paragraph: { spacing: { before: 200, after: 80, line: 300 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 440, hanging: 260 } } } }],
        },
        {
          reference: 'numbers',
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 440, hanging: 360 } } } }],
        },
      ],
    },
    sections: [
      { properties: pageProps(), children: convert(stripLeadingBreak(frontMatter), lists) },
      {
        properties: pageProps({ pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } }),
        footers: { default: footer },
        children: convert(stripLeadingBreak(body), lists),
      },
    ],
  });
}

/**
 * Final touches docx-js cannot express:
 * - every line spacing is marked "auto" (multiples of a line), as Word assumes; LibreOffice otherwise reads
 *   them as exact heights and clips the pictures;
 * - the "of N" page total gets a stored value, for programs that do not compute SECTIONPAGES themselves
 *   (Word recalculates it anyway).
 */
async function write(lists, file, bodyTotal = '') {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(makeDoc(lists)));
  for (const name of Object.keys(zip.files).filter((n) => /^word\/(document|styles|footer\d*)\.xml$/.test(n))) {
    let xml = await zip.file(name).async('string');
    xml = xml.replace(/<w:spacing ([^>]*?)\/>/g, (m, attrs) =>
      /w:line=/.test(attrs) && !/w:lineRule=/.test(attrs) ? `<w:spacing ${attrs} w:lineRule="auto"/>` : m,
    );
    if (bodyTotal)
      xml = xml.replace(
        /(<w:instrText xml:space="preserve">SECTIONPAGES<\/w:instrText><w:fldChar w:fldCharType="separate"\/>)/,
        `$1<w:t>${bodyTotal}</w:t>`,
      );
    zip.file(name, xml);
  }
  writeFileSync(file, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));
}

function renderWithLibreOffice(docx) {
  execFileSync('soffice', [`-env:UserInstallation=file://${BUILD}/lo-profile`, '--headless', '--convert-to', 'pdf', '--outdir', BUILD, docx], {
    stdio: 'ignore',
    timeout: 240_000,
    env: { ...process.env, SAL_USE_VCLPLUGIN: 'svp' },
  });
  return path.join(BUILD, path.basename(docx).replace(/\.docx$/, '.pdf'));
}

// the logo for the cover, rendered from the SVG in the brand colour
await rasterize();
{
  const { createRequire } = await import('node:module');
  const require = createRequire(path.resolve(here, '../../web/package.json'));
  const { chromium } = require('@playwright/test');
  const svg = readFileSync(path.resolve(here, '../../web/public/brand/mathme-logo.svg'), 'utf8').replace('fill="currentColor"', 'fill="#6a35e0"');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 400, height: 435 }, deviceScaleFactor: 2 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', '<svg width="400" height="435" ')}</body></html>`);
  await page.screenshot({ path: path.join(BUILD, 'logo.png'), omitBackground: true });
  await browser.close();
}

const lists = outline(body);
// pass 1: page numbers from the PDF build if it exists, so the contents have the right length
try {
  const prev = JSON.parse(readFileSync(path.join(BUILD, 'outline.json'), 'utf8'));
  for (const k of ['toc', 'figs', 'tabs']) lists[k].forEach((e, i) => (e.page = prev[k][i]?.page ?? 0));
} catch {
  /* no PDF build yet */
}
const draft = path.join(BUILD, 'draft.docx');
await write(lists, draft);
const pages = pdfPages(renderWithLibreOffice(draft));
const start = pages.findIndex((p) => p.includes('This report presents the internship project'));
locate(pages, lists.toc, start);
locate(pages, lists.figs, start);
locate(pages, lists.tabs, start);
const file = path.join(here, 'MathMe_Internship_Report.docx');
await write(lists, file, String(pages.length - 1 - start));
const check = pdfPages(renderWithLibreOffice(file));
console.log(`Word: ${check.length - 1} pages when rendered (${start} front pages)`);
const missing = [...lists.toc, ...lists.figs, ...lists.tabs].filter((e) => e.page === '?');
if (missing.length) console.log('not found:', missing.map((e) => e.find));
