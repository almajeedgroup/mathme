// Building blocks for the report. Both renderers (PDF and Word) read the same blocks.
// Inline markup in text: **bold**, _italic_.

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

/** A chapter opening, like the sample's course headings: two bold centred lines. */
export const CHAPTER = (label, title) => ({ t: 'chapter', label, title });
/** A front-matter page title (CERTIFICATE, DECLARATION, …). */
export const TITLE = (text) => ({ t: 'title', text });

/** Ruled table. widths are fractions that add up to 1. */
export const TABLE = (num, caption, head, rows, widths, opts = {}) => ({ t: 'table', num, caption, head, rows, widths, ...opts });
/** A screenshot (img/name.jpg) or diagram (diagrams/name.svg). width is a fraction of the text width. */
export const FIG = (num, caption, src, width = 1) => ({ t: 'fig', num, caption, src, width });
export const CODE = (caption, text) => ({ t: 'code', caption, text });
/** Signature lines side by side: [[label, name], …] */
export const SIGNS = (items) => ({ t: 'signs', items });
/** Placeholders the build fills in (table of contents, list of figures, list of tables). */
export const TOC = { t: 'toc' };
export const LOF = { t: 'lof' };
export const LOT = { t: 'lot' };
