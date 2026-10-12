// Building blocks for the report. Both renderers (PDF and Word) read the same blocks.
// Inline markup in text: **bold**, _italic_, and references {fig:id} / {tab:id}, which become
// "3.7" etc. when the report is numbered (figures and tables are numbered per chapter, in order).

export const BLANK = '____________________';
export const SHORT = '____________';

export const P = (text, opts = {}) => ({ t: 'p', text, ...opts });
export const H2 = (num, text) => ({ t: 'h2', num, text });
export const H3 = (num, text) => ({ t: 'h3', num, text });
export const UL = (items) => ({ t: 'ul', items });
export const OL = (items, opts = {}) => ({ t: 'ol', items, ...opts });
export const BREAK = { t: 'break' };
export const SPACE = (mm = 6) => ({ t: 'space', mm });
export const CENTER = (text, opts = {}) => ({ t: 'center', text, size: 12, ...opts });
export const RIGHT = (text, opts = {}) => ({ t: 'right', text, size: 12, ...opts });
export const LOGO = (mm = 38) => ({ t: 'logo', mm });

/** A chapter opening on one line, e.g. "CHAPTER I: INTRODUCTION" (16 pt bold, centred). */
export const CHAPTER = (label, title) => ({ t: 'chapter', label, title });
/** A page title (CERTIFICATE, DECLARATION, …): 16 pt bold, centred. */
export const TITLE = (text) => ({ t: 'title', text });

/** Ruled table. widths are fractions that add up to 1. */
export const TABLE = (id, caption, head, rows, widths, opts = {}) => ({ t: 'table', id, caption, head, rows, widths, ...opts });
/** A diagram (diagrams/<src>.svg) inside the text. width is a fraction of the text width. */
export const FIG = (src, caption, width = 1) => ({ t: 'fig', id: src, src, caption, width });
/**
 * A page of exactly two colour screenshots (img/<src>.jpg), each captioned with the name of the screen.
 * shots: [[src, name], [src, name]]
 */
export const SHOTS = (shots) => {
  if (shots.length !== 2) throw new Error('A screenshot page holds exactly two screenshots.');
  return { t: 'shots', items: shots.map(([src, caption]) => ({ id: src, src, caption })) };
};
export const CODE = (caption, text) => ({ t: 'code', caption, text });
/** Signature lines side by side: [[label, name], …] */
export const SIGNS = (items) => ({ t: 'signs', items });
/** Placeholders the build fills in (table of contents, list of figures, list of tables). */
export const TOC = { t: 'toc' };
export const LOF = { t: 'lof' };
export const LOT = { t: 'lot' };
