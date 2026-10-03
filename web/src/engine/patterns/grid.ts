import { num } from '../fields';
import { fmt } from '../math';
import type { Params } from '../types';
import { lengthOpts, numberField } from './shared';
import type { BasePlacement, PatternDefinition } from './types';

function gridCell(p: Params, i: number, n: number) {
  const cols = Math.max(1, Math.round(num(p, 'columns', 10)));
  const rows = Math.max(1, Math.round(num(p, 'rows', 10)));
  const gap = num(p, 'spacing', 3);
  const perLayer = cols * rows;
  const col = i % cols;
  const row = Math.floor(i / cols) % rows;
  const layer = Math.floor(i / perLayer);
  const usedCols = Math.min(cols, n);
  const usedRows = Math.min(rows, Math.ceil(n / cols));
  const x = (col - (usedCols - 1) / 2) * gap;
  const z = (row - (usedRows - 1) / 2) * gap;
  const y = layer * gap;
  return { cols, rows, gap, col, row, layer, x, y, z, usedCols, usedRows };
}

export const grid: PatternDefinition = {
  type: 'grid',
  label: 'Grid',
  icon: '🔲',
  description: 'Rows and columns, like a chessboard. Extra objects stack up into new layers.',
  fields: [
    numberField('columns', 'Columns', 'How many objects in each row (left to right).', {
      unit: 'count',
      min: 1,
      max: 50,
      step: 1,
      hardMax: 500,
      integer: true,
      aliases: ['columns', 'cols'],
    }),
    numberField('rows', 'Rows', 'How many rows in each layer (front to back).', {
      unit: 'count',
      min: 1,
      max: 50,
      step: 1,
      hardMax: 500,
      integer: true,
      aliases: ['rows'],
    }),
    numberField('spacing', 'Spacing', 'Distance between neighbouring objects.', {
      ...lengthOpts,
      max: 20,
      aliases: ['spacing', 'gap'],
    }),
  ],
  defaults: { columns: 10, rows: 10, spacing: 3 },
  defaultCount: 100,
  generate(p, n) {
    const out: BasePlacement[] = [];
    for (let i = 0; i < n; i++) {
      const c = gridCell(p, i, n);
      out.push({ position: [c.x, c.y, c.z] });
    }
    return out;
  },
  explain(p, n) {
    const c0 = gridCell(p, 0, n);
    return {
      idea: 'Objects are placed in rows and columns with the same gap between them. When a layer is full, a new layer starts on top.',
      formulas: [
        `column = i mod ${c0.cols}   (the remainder after dividing by ${c0.cols})`,
        `row = ⌊i ÷ ${c0.cols}⌋ mod ${c0.rows}`,
        `layer = ⌊i ÷ ${c0.cols * c0.rows}⌋`,
        `x = (column − ${fmt((c0.usedCols - 1) / 2)}) × ${fmt(c0.gap)}`,
        `z = (row − ${fmt((c0.usedRows - 1) / 2)}) × ${fmt(c0.gap)}`,
        `y = layer × ${fmt(c0.gap)}`,
      ],
      worked: (i) => {
        const c = gridCell(p, i, n);
        return [
          `column = ${i} mod ${c.cols} = ${c.col}`,
          `row = ${c.row}, layer = ${c.layer}`,
          `x = ${fmt(c.x)}, y = ${fmt(c.y)}, z = ${fmt(c.z)}`,
        ];
      },
    };
  },
};
