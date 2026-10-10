// Builds MathMe_Internship_Report.pdf:
//   1. the body (executive summary → bibliography) is printed with Chromium;
//   2. pdftotext finds the page of every heading, figure and table;
//   3. the front matter (cover → lists) is printed with those page numbers;
//   4. pdf-lib joins them and draws the sample's double border on every page and "Page N of M" on the body.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

import { body, frontMatter } from './content/index.mjs';
import { locate, outline, pdfPages } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(here, '../../web/package.json'));
const { chromium } = require('@playwright/test');
const BUILD = path.join(here, 'build');
mkdirSync(BUILD, { recursive: true });

const MM = 72 / 25.4;

// ---------------------------------------------------------------- inline text
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function inline(text) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(?<![\w])_([^_]+?)_(?![\w])/g, '<i>$1</i>')
    .replace(/(https?:\/\/[^\s,]+)/g, '<span class="url">$1</span>');
}
// ---------------------------------------------------------------- HTML
const CSS = `
@page { size: A4; margin: 24mm 22mm 27mm 26mm; }
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: 'Liberation Serif', 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.72; color: #000; }
p { margin: 0 0 7pt; text-align: justify; hyphens: auto; }
p.center { text-align: center; }
.break { break-after: page; }
.center-line { text-align: center; margin: 0 0 4pt; line-height: 1.35; }
.right-line { text-align: right; margin: 0 0 4pt; }
.chapter { text-align: center; font-weight: 700; font-size: 16pt; line-height: 1.35; margin: 0 0 16pt; }
.chapter div + div { margin-top: 2pt; }
.title { text-align: center; font-weight: 700; font-size: 16pt; margin: 0 0 14pt; letter-spacing: 0.02em; }
h2 { font-size: 13pt; margin: 14pt 0 6pt; break-after: avoid; }
h3 { font-size: 12pt; margin: 11pt 0 5pt; break-after: avoid; }
ul, ol { margin: 0 0 8pt; padding-left: 22pt; }
li { margin: 0 0 3pt; text-align: justify; }
ol.compact { font-size: 11.5pt; line-height: 1.38; }
ol.compact li { margin: 0 0 2pt; text-align: left; }
.cap { text-align: center; font-size: 11pt; margin: 4pt 0 10pt; line-height: 1.3; }
.tcap { text-align: center; font-size: 11pt; font-weight: 700; margin: 8pt 0 4pt; break-after: avoid; }
table.t { width: 100%; border-collapse: collapse; margin: 0 0 12pt; font-size: 11pt; line-height: 1.3; }
table.t th, table.t td { border: 0.9pt solid #000; padding: 3pt 6pt; vertical-align: top; text-align: left; }
table.t th { font-weight: 700; text-align: center; background: #fff; }
table.t tr { break-inside: avoid; }
.fig { text-align: center; margin: 8pt 0 2pt; break-inside: avoid; }
.fig img { border: 0.75pt solid #555; max-width: 100%; }
.fig img.dia { border: none; }
.figwrap { break-inside: avoid; }
.code { break-inside: avoid; margin: 4pt 0 12pt; }
.code .ccap { font-size: 10.5pt; font-style: italic; margin-bottom: 3pt; }
.code pre { margin: 0; padding: 6pt 8pt; border: 0.75pt solid #000; background: #f3f3f3; font-family: 'Liberation Mono', 'Courier New', monospace; font-size: 9pt; line-height: 1.35; white-space: pre-wrap; }
.signs { display: flex; justify-content: space-between; gap: 30pt; margin: 6pt 0; break-inside: avoid; }
.sign { flex: 1; text-align: center; font-size: 11.5pt; line-height: 1.4; }
.sign .line { border-top: 0.9pt solid #000; margin: 0 10pt 4pt; height: 0; }
.sign.blankline .line { visibility: visible; }
.toc { width: 100%; border-collapse: collapse; font-size: 11.5pt; line-height: 1.45; }
.toc td { padding: 1pt 0; vertical-align: bottom; }
.toc td.n { width: 30pt; text-align: right; }
.toc .l0 td { font-weight: 700; padding-top: 5pt; }
.toc .l1 td.x { padding-left: 16pt; }
.toc .l2 td.x { padding-left: 34pt; font-size: 11pt; }
.toc td.x { position: relative; }
.dots { display: flex; align-items: baseline; }
.dots .lab { flex: 0 1 auto; padding-right: 4pt; }
.dots .fill { flex: 1 1 auto; border-bottom: 1.2pt dotted #444; margin-bottom: 3pt; min-width: 12pt; }
.listhead { display: flex; justify-content: space-between; font-weight: 700; font-size: 11.5pt; border-bottom: 0.9pt solid #000; margin-bottom: 4pt; }
.logo { text-align: center; margin: 2mm 0; }
.logo .word { font-family: 'Liberation Sans', Arial, sans-serif; font-weight: 700; letter-spacing: 0.12em; font-size: 15pt; color: #3e1d8f; margin-top: 2mm; }
.url { word-break: break-all; }
`;

function imgSrc(src) {
  const svg = path.join(here, 'diagrams', `${src}.svg`);
  try {
    return { url: `data:image/svg+xml;base64,${readFileSync(svg).toString('base64')}`, dia: true };
  } catch {
    return { url: `data:image/jpeg;base64,${readFileSync(path.join(here, 'img', `${src}.jpg`)).toString('base64')}`, dia: false };
  }
}

function logoSvg(mm) {
  const svg = readFileSync(path.resolve(here, '../../web/public/brand/mathme-logo.svg'), 'utf8').replace(
    'fill="currentColor"',
    'fill="#6a35e0"',
  );
  return `<div class="logo"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="height:${mm}mm"><div class="word">MATHME</div></div>`;
}

const dotsRow = (cls, label, page) =>
  `<tr class="${cls}"><td class="x"><div class="dots"><span class="lab">${inline(label)}</span><span class="fill"></span></div></td><td class="n">${page ?? ''}</td></tr>`;

function renderHtml(blocks, lists) {
  const out = [];
  let olIndex = 0;
  for (const b of blocks) {
    switch (b.t) {
      case 'page':
        break;
      case 'break':
        out.push('<div class="break"></div>');
        break;
      case 'space':
        out.push(`<div style="height:${b.mm}mm"></div>`);
        break;
      case 'center':
      case 'right': {
        const style = `font-size:${b.size}pt;${b.bold ? 'font-weight:700;' : ''}${b.italic ? 'font-style:italic;' : ''}`;
        out.push(`<div class="${b.t}-line" style="${style}">${inline(b.text)}</div>`);
        break;
      }
      case 'logo':
        out.push(logoSvg(b.mm));
        break;
      case 'title':
        out.push(`<div class="title">${inline(b.text)}</div>`);
        break;
      case 'chapter':
        out.push(`<div class="chapter"><div>${esc(b.label)}</div><div>${esc(b.title)}</div></div>`);
        break;
      case 'h2':
        out.push(`<h2>${esc(b.num)} ${inline(b.text)}</h2>`);
        break;
      case 'h3':
        out.push(`<h3>${esc(b.num)} ${inline(b.text)}</h3>`);
        break;
      case 'p': {
        const cls = b.center ? ' class="center"' : '';
        out.push(`<p${cls}>${inline(b.text)}</p>`);
        break;
      }
      case 'ul':
        out.push(`<ul>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`);
        break;
      case 'ol':
        olIndex++;
        out.push(`<ol${b.compact ? ' class="compact"' : ''}>${b.items.map((i) => `<li>${inline(i)}</li>`).join('')}</ol>`);
        break;
      case 'table': {
        const cols = b.widths.map((w) => `<col style="width:${(w * 100).toFixed(1)}%">`).join('');
        const head = `<thead><tr>${b.head.map((h) => `<th>${inline(h)}</th>`).join('')}</tr></thead>`;
        const rows = b.rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
        out.push(`<div class="tcap">Table ${b.num}: ${inline(b.caption)}</div><table class="t"><colgroup>${cols}</colgroup>${head}<tbody>${rows}</tbody></table>`);
        break;
      }
      case 'fig': {
        const { url, dia } = imgSrc(b.src);
        out.push(
          `<div class="figwrap"><div class="fig"><img class="${dia ? 'dia' : ''}" src="${url}" style="width:${(b.width * 100).toFixed(0)}%"></div><div class="cap"><b>Figure ${b.num}:</b> ${inline(b.caption)}</div></div>`,
        );
        break;
      }
      case 'code':
        out.push(`<div class="code"><div class="ccap">${inline(b.caption)}</div><pre>${esc(b.text)}</pre></div>`);
        break;
      case 'signs':
        out.push(
          `<div class="signs">${b.items
            .map(([label, name]) => `<div class="sign"><div class="line"></div><div>${inline(label)}</div>${name ? `<div>${inline(name)}</div>` : ''}</div>`)
            .join('')}</div>`,
        );
        break;
      case 'toc':
        out.push(
          `<table class="toc"><tr><td></td><td class="n"><b>Page</b></td></tr>${lists.toc
            .map((e) => dotsRow(`l${e.level}`, e.label, e.page))
            .join('')}</table>`,
        );
        break;
      case 'lof':
        out.push(`<table class="toc"><tr><td></td><td class="n"><b>Page</b></td></tr>${lists.figs.map((e) => dotsRow('l1', e.label, e.page)).join('')}</table>`);
        break;
      case 'lot':
        out.push(`<table class="toc"><tr><td></td><td class="n"><b>Page</b></td></tr>${lists.tabs.map((e) => dotsRow('l1', e.label, e.page)).join('')}</table>`);
        break;
      default:
        throw new Error(`unknown block ${b.t}`);
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${out.join('\n')}</body></html>`;
}

async function print(browser, html, file) {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.close();
}

// ---------------------------------------------------------------- build
const lists = outline(body);
const browser = await chromium.launch();
const bodyPdf = path.join(BUILD, 'body.pdf');
const frontPdf = path.join(BUILD, 'front.pdf');
await print(browser, renderHtml(body, lists), bodyPdf);
const pages = pdfPages(bodyPdf);
locate(pages, lists.toc);
locate(pages, lists.figs);
locate(pages, lists.tabs);
writeFileSync(path.join(BUILD, 'outline.json'), JSON.stringify(lists, null, 1));
await print(browser, renderHtml(frontMatter, lists), frontPdf);
await browser.close();

// join, then borders and page numbers
const out = await PDFDocument.create();
const times = await out.embedFont(StandardFonts.TimesRoman);
const timesBold = await out.embedFont(StandardFonts.TimesRomanBold);
const front = await PDFDocument.load(readFileSync(frontPdf));
const main = await PDFDocument.load(readFileSync(bodyPdf));
const frontCount = front.getPageCount();
for (const p of await out.copyPages(front, front.getPageIndices())) out.addPage(p);
for (const p of await out.copyPages(main, main.getPageIndices())) out.addPage(p);
const total = main.getPageCount();
out.getPages().forEach((page, i) => {
  const { width, height } = page.getSize();
  const o = 11 * MM;
  page.drawRectangle({ x: o, y: o, width: width - 2 * o, height: height - 2 * o, borderColor: rgb(0, 0, 0), borderWidth: 2.4 });
  const g = 3.6;
  page.drawRectangle({ x: o + g, y: o + g, width: width - 2 * (o + g), height: height - 2 * (o + g), borderColor: rgb(0, 0, 0), borderWidth: 0.8 });
  if (i >= frontCount) {
    const n = i - frontCount + 1;
    const parts = [
      ['Page ', times],
      [String(n), timesBold],
      [' of ', times],
      [String(total), timesBold],
    ];
    const size = 10.5;
    const w = parts.reduce((s, [t, f]) => s + f.widthOfTextAtSize(t, size), 0);
    let x = width - o - 13 * MM - w;
    const y = o + 9 * MM;
    for (const [t, f] of parts) {
      page.drawText(t, { x, y, size, font: f, color: rgb(0, 0, 0) });
      x += f.widthOfTextAtSize(t, size);
    }
  }
});
out.setTitle('MathMe 3D Studio: Internship Project Report');
out.setAuthor('Sulaimaan');
out.setSubject('BCA Semester III internship project report');
const file = path.join(here, 'MathMe_Internship_Report.pdf');
writeFileSync(file, await out.save());
console.log(`PDF: ${frontCount} front pages + ${total} numbered pages = ${frontCount + total} pages`);
const missing = [...lists.toc, ...lists.figs, ...lists.tabs].filter((e) => e.page === '?');
if (missing.length) console.log('not found:', missing.map((e) => e.find));
