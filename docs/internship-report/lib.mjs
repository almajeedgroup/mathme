// Shared by the PDF and Word builders: the outline (contents, figures, tables) and finding pages in a PDF.
import { execFileSync } from 'node:child_process';

/** Text without the **bold** / _italic_ markers. */
export const plain = (text) => String(text).replace(/\*\*/g, '').replace(/(?<![\w])_([^_]+?)_(?![\w])/g, '$1');

export function outline(blocks) {
  const toc = [];
  const figs = [];
  const tabs = [];
  for (const b of blocks) {
    if (b.t === 'chapter') toc.push({ level: 0, label: `${b.label}: ${b.title}`, find: b.title });
    else if (b.t === 'title') toc.push({ level: 0, label: b.text, find: b.text });
    else if (b.t === 'h2') toc.push({ level: 1, label: `${b.num} ${b.text}`, find: `${b.num} ${b.text}` });
    else if (b.t === 'h3') toc.push({ level: 2, label: `${b.num} ${b.text}`, find: `${b.num} ${b.text}` });
    else if (b.t === 'fig') figs.push({ label: `Figure ${b.num}: ${b.caption}`, find: `Figure ${b.num}:` });
    else if (b.t === 'table') tabs.push({ label: `Table ${b.num}: ${b.caption}`, find: `Table ${b.num}:` });
  }
  return { toc, figs, tabs };
}

/** The text of every page of a PDF, with white space squeezed. */
export function pdfPages(pdfPath) {
  return execFileSync('pdftotext', ['-layout', pdfPath, '-'], { maxBuffer: 64 << 20 })
    .toString()
    .split('\f')
    .map((p) => p.replace(/\s+/g, ' '));
}

/** Sets entry.page (1-based, counted from page `start`) for each entry, searching in order. */
export function locate(pages, entries, start = 0) {
  const norm = (s) => plain(s).replace(/\s+/g, ' ').trim();
  let from = start;
  for (const e of entries) {
    const key = norm(e.find);
    let at = pages.findIndex((p, i) => i >= from && p.includes(key));
    if (at < 0) at = pages.findIndex((p, i) => i >= start && p.includes(key));
    e.page = at >= 0 ? at - start + 1 : '?';
    if (at >= 0) from = at;
  }
}
