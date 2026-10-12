// Shared by the PDF and Word builders: numbering of figures and tables, cross-references, the outline
// (contents, figures, tables) and finding pages in a printed PDF.
import { execFileSync } from 'node:child_process';

/** Text without the **bold** / _italic_ markers. */
export const plain = (text) => String(text).replace(/\*\*/g, '').replace(/(?<![\w])_([^_]+?)_(?![\w])/g, '$1');

/**
 * Numbers figures and tables per chapter, in reading order (Figure 3.1, 3.2, …), and replaces the
 * {fig:id} / {tab:id} references in every text with those numbers. Returns new blocks.
 */
export function numbered(blocks) {
  const nums = { fig: new Map(), tab: new Map() };
  let chapter = 0;
  let fig = 0;
  let tab = 0;
  const out = blocks.map((b) => {
    if (b.t === 'chapter') {
      chapter++;
      fig = 0;
      tab = 0;
      return b;
    }
    if (b.t === 'fig') {
      const num = `${chapter}.${++fig}`;
      nums.fig.set(b.id, num);
      return { ...b, num };
    }
    if (b.t === 'shots') {
      return {
        ...b,
        items: b.items.map((s) => {
          const num = `${chapter}.${++fig}`;
          nums.fig.set(s.id, num);
          return { ...s, num };
        }),
      };
    }
    if (b.t === 'table') {
      const num = `${chapter}.${++tab}`;
      nums.tab.set(b.id, num);
      return { ...b, num };
    }
    return b;
  });
  const resolve = (s) =>
    typeof s !== 'string'
      ? s
      : s.replace(/\{(fig|tab):([\w-]+)\}/g, (m, kind, id) => {
          const n = nums[kind].get(id);
          if (!n) throw new Error(`Unknown reference ${m}`);
          return n;
        });
  return out.map((b) => {
    const r = { ...b };
    for (const k of ['text', 'caption', 'title', 'label']) if (k in r) r[k] = resolve(r[k]);
    if (r.items && Array.isArray(r.items)) r.items = r.items.map((i) => (typeof i === 'string' ? resolve(i) : i));
    if (r.rows) r.rows = r.rows.map((row) => row.map(resolve));
    return r;
  });
}

/** The one-line chapter heading, exactly as the college rules write it. */
export const chapterLine = (b) => `${b.label}: ${b.title}`;

export function outline(blocks) {
  const toc = [];
  const figs = [];
  const tabs = [];
  for (const b of blocks) {
    if (b.t === 'chapter') toc.push({ level: 0, label: chapterLine(b), find: chapterLine(b) });
    else if (b.t === 'title') toc.push({ level: 0, label: b.text, find: b.text });
    else if (b.t === 'h2') toc.push({ level: 1, label: `${b.num} ${b.text}`, find: `${b.num} ${b.text}` });
    // the contents list chapters and main sections (1.1, 3.4 …); sub-sections are left out to keep it short
    else if (b.t === 'fig') figs.push({ label: `Figure ${b.num}: ${b.caption}`, find: `Figure ${b.num}:` });
    else if (b.t === 'shots') for (const s of b.items) figs.push({ label: `Figure ${s.num}: ${s.caption}`, find: `Figure ${s.num}:` });
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

/**
 * Sets entry.page for each entry: the 1-based page index in `pages`, plus `offset`. The search starts at
 * page index `from` (to skip the contents pages, which repeat every heading) and goes forward in order.
 */
export function locate(pages, entries, { from = 0, offset = 0 } = {}) {
  const norm = (s) => plain(s).replace(/\s+/g, ' ').trim();
  let at0 = from;
  for (const e of entries) {
    const key = norm(e.find);
    let at = pages.findIndex((p, i) => i >= at0 && p.includes(key));
    if (at < 0) at = pages.findIndex((p, i) => i >= from && p.includes(key));
    e.page = at >= 0 ? at + 1 + offset : '?';
    if (at >= 0) at0 = at;
  }
}
