// Builds MathMe_Internship_Report.pdf, following the college's report rules: Times New Roman, headings
// 16 pt bold, text 12 pt, 1.5 line spacing, two named colour screenshots per output page, and page
// numbers from the cover (page 1), with the contents starting at the Executive Summary.
//   1. the body (executive summary → bibliography) is printed with Chromium;
//   2. pdftotext finds the page of every heading, figure and table;
//   3. the front matter (cover → lists) is printed to learn its length, then again with the real page numbers;
//   4. pdf-lib joins them and draws the double border and "Page N of M" on every page.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

import { body, frontMatter } from './content/index.mjs';
import { chapterLine, locate, numbered, outline, pdfPages } from './lib.mjs';

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
/* Rules: Times New Roman; text 12 pt normal; headings 16 pt bold; 1.5 line spacing on every line
   (Word's 1.5 lines = 1.5 × the font's natural line of 1.149 em). */
body { margin: 0; font-family: 'Times New Roman', 'DejaVu Serif', Times, serif; font-size: 12pt; line-height: 1.72; color: #000; }
p { margin: 0 0 6pt; text-align: justify; hyphens: auto; }
p.center { text-align: center; }
.break { break-after: page; }
.center-line { text-align: center; margin: 0 0 2pt; }
.right-line { text-align: right; margin: 0 0 2pt; }
.chapter, .title { text-align: center; font-weight: 700; font-size: 16pt; margin: 0 0 12pt; }
h2, h3 { font-size: 16pt; font-weight: 700; margin: 12pt 0 4pt; break-after: avoid; }
ul, ol { margin: 0 0 6pt; padding-left: 22pt; }
li { margin: 0 0 2pt; text-align: justify; }
ol.compact li { text-align: left; }
.cap { text-align: center; margin: 2pt 0 8pt; }
.tcap { text-align: center; margin: 6pt 0 2pt; break-after: avoid; }
table.t { width: 100%; border-collapse: collapse; margin: 0 0 10pt; }
table.t th, table.t td { border: 0.9pt solid #000; padding: 1pt 5pt; vertical-align: top; text-align: left; }
table.t th { font-weight: 700; text-align: center; }
table.t tr { break-inside: avoid; }
.fig { text-align: center; margin: 6pt 0 0; break-inside: avoid; }
.fig img { max-width: 100%; }
.figwrap { break-inside: avoid; }
.shotpage { break-before: page; break-after: page; display: flex; flex-direction: column; justify-content: space-around; height: 244mm; }
.shot { text-align: center; }
.shot img { width: 100%; border: 0.75pt solid #555; }
.shot .cap { margin: 3pt 0 0; }
.code { break-inside: avoid; margin: 2pt 0 10pt; }
.code .ccap { font-style: italic; margin-bottom: 2pt; }
.code pre { margin: 0; padding: 4pt 8pt; border: 0.75pt solid #000; background: #f3f3f3; font-family: 'Times New Roman', 'DejaVu Serif', serif; font-size: 12pt; line-height: 1.72; white-space: pre-wrap; tab-size: 4; }
.signs { display: flex; justify-content: space-between; gap: 30pt; margin: 6pt 0; break-inside: avoid; }
.sign { flex: 1; text-align: center; }
.sign .line { border-top: 0.9pt solid #000; margin: 0 10pt 2pt; height: 0; }
.toc { width: 100%; border-collapse: collapse; }
.toc td { padding: 0; vertical-align: bottom; }
.toc td.n { width: 34pt; text-align: right; }
.toc .l0 td { font-weight: 700; }
.toc .l1 td.x { padding-left: 16pt; }
.toc .l2 td.x { padding-left: 34pt; }
.dots { display: flex; align-items: baseline; }
.dots .lab { flex: 0 1 auto; padding-right: 4pt; }
.dots .fill { flex: 1 1 auto; border-bottom: 1.2pt dotted #444; margin-bottom: 4pt; min-width: 12pt; }
.logo { text-align: center; margin: 2mm 0; }
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
  return `<div class="logo"><img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}" style="height:${mm}mm"></div>`;
}

const dotsRow = (cls, label, page) =>
  `<tr class="${cls}"><td class="x"><div class="dots"><span class="lab">${inline(label)}</span><span class="fill"></span></div></td><td class="n">${page ?? ''}</td></tr>`;

function renderHtml(blocks, lists) {
  const out = [];
  let olIndex = 0;
  for (const [i, b] of blocks.entries()) {
    switch (b.t) {
      case 'page':
        break;
      case 'break':
        // a screenshot page already ends its page
        if (blocks[i - 1]?.t !== 'shots') out.push('<div class="break"></div>');
        break;
      case 'space':
        out.push(`<div style="height:${b.mm}mm"></div>`);
        break;
      case 'center':
      case 'right': {
        const style = `font-size:${b.size >= 16 ? 16 : 12}pt;${b.bold ? 'font-weight:700;' : ''}${b.italic ? 'font-style:italic;' : ''}`;
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
        out.push(`<div class="chapter">${esc(chapterLine(b))}</div>`);
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
        out.push(`<div class="tcap"><b>Table ${b.num}:</b> ${inline(b.caption)}</div><table class="t"><colgroup>${cols}</colgroup>${head}<tbody>${rows}</tbody></table>`);
        break;
      }
      case 'fig': {
        const { url, dia } = imgSrc(b.src);
        out.push(
          `<div class="figwrap"><div class="fig"><img class="${dia ? 'dia' : ''}" src="${url}" style="width:${(b.width * 100).toFixed(0)}%"></div><div class="cap"><b>Figure ${b.num}:</b> ${inline(b.caption)}</div></div>`,
        );
        break;
      }
      case 'shots':
        out.push(
          `<div class="shotpage">${b.items
            .map((sh) => {
              const { url } = imgSrc(sh.src);
              return `<div class="shot"><img src="${url}"><div class="cap"><b>Figure ${sh.num}:</b> ${inline(sh.caption)}</div></div>`;
            })
            .join('')}</div>`,
        );
        break;
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
  writeFileSync(file.replace(/\.pdf$/, '.html'), html); // kept for checking the typography
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: file, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await page.close();
}

// ---------------------------------------------------------------- build
const bodyBlocks = numbered(body);
const lists = outline(bodyBlocks);
const browser = await chromium.launch();
const bodyPdf = path.join(BUILD, 'body.pdf');
const frontPdf = path.join(BUILD, 'front.pdf');
await print(browser, renderHtml(bodyBlocks, lists), bodyPdf);
const pages = pdfPages(bodyPdf);
for (const l of [lists.toc, lists.figs, lists.tabs]) locate(pages, l);
// the front matter's length does not depend on the numbers, so print it once to count its pages,
// then make every number count from the cover and print it again
await print(browser, renderHtml(frontMatter, lists), frontPdf);
const frontCount = (await PDFDocument.load(readFileSync(frontPdf))).getPageCount();
for (const e of [...lists.toc, ...lists.figs, ...lists.tabs]) if (typeof e.page === 'number') e.page += frontCount;
await print(browser, renderHtml(frontMatter, lists), frontPdf);
writeFileSync(path.join(BUILD, 'outline.json'), JSON.stringify(lists, null, 1));
await browser.close();

// join, then borders and "Page N of M" on every page, counted from the cover
const out = await PDFDocument.create();
out.registerFontkit(fontkit);
const TNR = '/usr/share/fonts/truetype/msttcorefonts';
const embed = async (file, fallback) => {
  try {
    return await out.embedFont(readFileSync(path.join(TNR, file)), { subset: true });
  } catch {
    return out.embedFont(fallback); // Times New Roman not installed: PDF's standard Times
  }
};
const times = await embed('Times.TTF', StandardFonts.TimesRoman);
const timesBold = await embed('Timesbd.TTF', StandardFonts.TimesRomanBold);
const front = await PDFDocument.load(readFileSync(frontPdf));
const main = await PDFDocument.load(readFileSync(bodyPdf));
if (front.getPageCount() !== frontCount) throw new Error('The front matter changed length between prints.');
for (const p of await out.copyPages(front, front.getPageIndices())) out.addPage(p);
for (const p of await out.copyPages(main, main.getPageIndices())) out.addPage(p);
const total = out.getPageCount();
out.getPages().forEach((page, i) => {
  const { width, height } = page.getSize();
  const o = 11 * MM;
  page.drawRectangle({ x: o, y: o, width: width - 2 * o, height: height - 2 * o, borderColor: rgb(0, 0, 0), borderWidth: 2.4 });
  const g = 3.6;
  page.drawRectangle({ x: o + g, y: o + g, width: width - 2 * (o + g), height: height - 2 * (o + g), borderColor: rgb(0, 0, 0), borderWidth: 0.8 });
  const parts = [
    ['Page ', times],
    [String(i + 1), timesBold],
    [' of ', times],
    [String(total), timesBold],
  ];
  const size = 12;
  const w = parts.reduce((s, [t, f]) => s + f.widthOfTextAtSize(t, size), 0);
  let x = width - o - 13 * MM - w;
  const y = o + 8 * MM;
  for (const [t, f] of parts) {
    page.drawText(t, { x, y, size, font: f, color: rgb(0, 0, 0) });
    x += f.widthOfTextAtSize(t, size);
  }
});
out.setTitle('MathMe 3D Studio: Internship Project Report');
out.setAuthor('Sulaimaan');
out.setSubject('BCA Semester III internship project report');
const file = path.join(here, 'MathMe_Internship_Report.pdf');
writeFileSync(file, await out.save());
console.log(`PDF: ${total} pages (${frontCount} front pages); numbered from the cover`);
const missing = [...lists.toc, ...lists.figs, ...lists.tabs].filter((e) => e.page === '?');
if (missing.length) console.log('not found:', missing.map((e) => e.find));
